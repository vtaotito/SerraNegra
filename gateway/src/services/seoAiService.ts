// Serviço de IA especialista em SEO (OpenAI/GPT).
//
// Gera SUGESTÕES de conteúdo/metadados de SEO para produtos e categorias do
// catálogo B2B (embalagens/garrafas de vidro — marca Garrafaria Serra Negra /
// GSN). Nada é aplicado automaticamente: as rotas devolvem a sugestão e o
// usuário revisa/aprova no admin antes de salvar.
//
// Degrada graciosamente sem OPENAI_API_KEY: lança SeoAiNotConfiguredError, que
// as rotas convertem em 503 com mensagem clara.

import OpenAI from "openai";
import { z } from "zod";

/** Lançada quando a integração não está configurada (sem OPENAI_API_KEY). */
export class SeoAiNotConfiguredError extends Error {
  constructor(message = "IA de SEO não configurada. Configure OPENAI_API_KEY no gateway.") {
    super(message);
    this.name = "SeoAiNotConfiguredError";
  }
}

/** Lançada quando a IA responde, mas o conteúdo é inválido/irrecuperável. */
export class SeoAiGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoAiGenerationError";
  }
}

const DEFAULT_MODEL = "gpt-4o-mini";

// ─── Schemas de saída (Zod) ──────────────────────────────────────────

const attributeSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

export const productSeoSuggestionSchema = z.object({
  seo_title: z.string().min(1),
  seo_description: z.string().min(1),
  seo_slug: z.string().min(1),
  description_rich: z.string().min(1),
  keywords: z.array(z.string().min(1)).default([]),
  attributes: z.array(attributeSchema).default([]),
});

export const categorySeoSuggestionSchema = z.object({
  seo_title: z.string().min(1),
  seo_description: z.string().min(1),
  intro_text: z.string().min(1),
  keywords: z.array(z.string().min(1)).default([]),
});

export type ProductSeoSuggestion = z.infer<typeof productSeoSuggestionSchema>;
export type CategorySeoSuggestion = z.infer<typeof categorySeoSuggestionSchema>;

export interface ProductSeoInput {
  name: string;
  category?: string | null;
  color?: string | null;
  closure?: string | null;
  capacity?: string | null;
  currentDescription?: string | null;
  ean?: string | null;
  packagingType?: string | null;
  unitsPerPack?: number | null;
}

export interface CategorySeoInput {
  name: string;
  sampleProducts?: string[];
  productCount?: number | null;
}

// ─── Utilidades ──────────────────────────────────────────────────────

/** Normaliza um texto para slug kebab-case pt-BR (sem acentos). */
export function toKebabSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

const SYSTEM_PROMPT = [
  "Você é um especialista sênior em SEO e copywriting B2B em português do Brasil (pt-BR),",
  "com foco no setor de embalagens e garrafas de vidro. Escreve para a marca",
  "\"Garrafaria Serra Negra\" (GSN), atendendo compradores profissionais (indústrias,",
  "cervejarias, vinícolas, destilarias, envasadoras, food service e revendas).",
  "",
  "Diretrizes obrigatórias:",
  "- Idioma: sempre português do Brasil, tom profissional, claro e persuasivo, sem clichês vazios.",
  "- Respeite RIGOROSAMENTE os limites de tamanho pedidos.",
  "- NÃO invente dados técnicos (capacidade, cor, material, medidas, certificações) que não",
  "  constem nos dados fornecidos. Se um dado não foi informado, não o afirme.",
  "- Foque em benefícios B2B: durabilidade, padronização, logística, envase, apresentação de marca.",
  "- Slug em kebab-case, sem acentos, curto e descritivo.",
  "- Responda SOMENTE com JSON válido no formato solicitado, sem texto extra.",
].join("\n");

// ─── Serviço ─────────────────────────────────────────────────────────

export class SeoAiService {
  private client: OpenAI | null;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    this.model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    this.client = apiKey
      ? new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined })
      : null;
  }

  /** True quando a integração está pronta para uso (há OPENAI_API_KEY). */
  isConfigured(): boolean {
    return this.client !== null;
  }

  getModel(): string {
    return this.model;
  }

  private ensureClient(): OpenAI {
    if (!this.client) throw new SeoAiNotConfiguredError();
    return this.client;
  }

  private async complete(userPrompt: string): Promise<unknown> {
    const client = this.ensureClient();
    let content: string | null | undefined;
    try {
      const res = await client.chat.completions.create({
        model: this.model,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });
      content = res.choices[0]?.message?.content;
    } catch (err: any) {
      throw new SeoAiGenerationError(
        `Falha ao chamar a OpenAI: ${err?.message ?? "erro desconhecido"}`,
      );
    }
    if (!content) throw new SeoAiGenerationError("A IA não retornou conteúdo.");
    try {
      return JSON.parse(content);
    } catch {
      throw new SeoAiGenerationError("A IA retornou um JSON inválido.");
    }
  }

  async suggestProductSeo(input: ProductSeoInput): Promise<ProductSeoSuggestion> {
    const facts: string[] = [`Nome do produto (interno): ${input.name}`];
    if (input.category) facts.push(`Categoria: ${input.category}`);
    if (input.capacity) facts.push(`Capacidade/volume: ${input.capacity}`);
    if (input.color) facts.push(`Cor: ${input.color}`);
    if (input.closure) facts.push(`Fechamento: ${input.closure}`);
    if (input.packagingType) {
      facts.push(
        `Embalagem: ${input.packagingType}${input.unitsPerPack ? ` com ${input.unitsPerPack} unidades` : ""}`,
      );
    }
    if (input.ean) facts.push(`EAN: ${input.ean}`);
    if (input.currentDescription?.trim()) {
      facts.push(`Descrição atual (referência): ${input.currentDescription.trim()}`);
    }

    const userPrompt = [
      "Gere metadados e conteúdo de SEO para o produto abaixo.",
      "",
      "Dados do produto:",
      facts.map((f) => `- ${f}`).join("\n"),
      "",
      "Retorne um JSON com EXATAMENTE estas chaves:",
      '- "seo_title": título de SEO atraente, até 60 caracteres.',
      '- "seo_description": meta descrição entre 150 e 160 caracteres.',
      '- "seo_slug": slug em kebab-case, sem acentos, curto.',
      '- "description_rich": descrição comercial rica (2 a 4 frases), foco B2B em embalagens/garrafas de vidro.',
      '- "keywords": array com 5 a 8 palavras-chave relevantes (strings).',
      '- "attributes": array de objetos {"name","value"} com atributos sugeridos apenas a partir dos dados fornecidos.',
    ].join("\n");

    const raw = await this.complete(userPrompt);
    const parsed = productSeoSuggestionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SeoAiGenerationError(
        "A sugestão da IA não seguiu o formato esperado. Tente novamente.",
      );
    }
    const data = parsed.data;
    // Garante slug válido mesmo que o modelo escorregue.
    data.seo_slug = toKebabSlug(data.seo_slug) || toKebabSlug(data.seo_title);
    return data;
  }

  async suggestCategorySeo(input: CategorySeoInput): Promise<CategorySeoSuggestion> {
    const facts: string[] = [`Nome da categoria: ${input.name}`];
    if (input.productCount != null) facts.push(`Nº de produtos: ${input.productCount}`);
    if (input.sampleProducts && input.sampleProducts.length > 0) {
      facts.push(`Exemplos de produtos: ${input.sampleProducts.slice(0, 12).join("; ")}`);
    }

    const userPrompt = [
      "Gere metadados e conteúdo de SEO para a CATEGORIA abaixo de um catálogo B2B de embalagens/garrafas de vidro.",
      "",
      "Dados da categoria:",
      facts.map((f) => `- ${f}`).join("\n"),
      "",
      "Retorne um JSON com EXATAMENTE estas chaves:",
      '- "seo_title": título de SEO da categoria, até 60 caracteres.',
      '- "seo_description": meta descrição entre 150 e 160 caracteres.',
      '- "intro_text": texto de introdução da categoria (2 a 4 frases), foco B2B.',
      '- "keywords": array com 5 a 8 palavras-chave relevantes (strings).',
    ].join("\n");

    const raw = await this.complete(userPrompt);
    const parsed = categorySeoSuggestionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SeoAiGenerationError(
        "A sugestão da IA não seguiu o formato esperado. Tente novamente.",
      );
    }
    return parsed.data;
  }
}
