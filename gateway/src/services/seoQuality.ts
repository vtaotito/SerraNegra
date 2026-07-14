// Score de qualidade de SEO — heurística determinística (SEM IA).
//
// Recebe os campos editáveis do produto/categoria e devolve um score 0–100,
// uma "nota" (A–E) e uma lista de checks acionáveis. Usado tanto no dashboard
// de ranqueamento quanto no drawer de detalhe. Sem chamadas externas: é barato
// e reutilizável no backend e (espelhado) no frontend.

export type SeoCheckSeverity = "critical" | "warning" | "info";

export interface SeoCheck {
  id: string;
  label: string;
  ok: boolean;
  severity: SeoCheckSeverity;
  hint: string;
}

export type SeoGrade = "A" | "B" | "C" | "D" | "E";

export interface SeoScoreResult {
  score: number;
  grade: SeoGrade;
  checks: SeoCheck[];
}

export interface SeoScoreInput {
  name?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoSlug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  ogImageUrl?: string | null;
  keywords?: string[] | null;
}

// Limites recomendados (espelhados no frontend em lib/admin/seo.ts).
export const SEO_TITLE_MIN = 30;
export const SEO_TITLE_IDEAL_MIN = 50;
export const SEO_TITLE_MAX = 60;
export const SEO_DESC_MIN = 120;
export const SEO_DESC_IDEAL_MIN = 150;
export const SEO_DESC_MAX = 160;
export const SEO_RICH_DESC_MIN = 120;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function gradeFor(score: number): SeoGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "E";
}

/**
 * Calcula o score de SEO a partir dos campos do produto. Cada check tem um peso;
 * a soma dos pesos dos checks aprovados (÷ total) vira o score 0–100.
 */
export function computeSeoScore(input: SeoScoreInput): SeoScoreResult {
  const title = (input.seoTitle ?? "").trim();
  const desc = (input.seoDescription ?? "").trim();
  const slug = (input.seoSlug ?? "").trim();
  const rich = (input.description ?? "").trim();
  const hasImage = !!(input.imageUrl && input.imageUrl.trim());
  const hasOg = !!(input.ogImageUrl && input.ogImageUrl.trim());
  const keywords = (input.keywords ?? []).filter((k) => k && k.trim());

  const checks: { check: SeoCheck; weight: number }[] = [];

  // Título de SEO.
  const titleOk = title.length >= SEO_TITLE_IDEAL_MIN && title.length <= SEO_TITLE_MAX;
  checks.push({
    weight: 22,
    check: {
      id: "title",
      label: "Título de SEO",
      ok: titleOk,
      severity: title.length === 0 ? "critical" : "warning",
      hint:
        title.length === 0
          ? "Adicione um título de SEO."
          : title.length < SEO_TITLE_IDEAL_MIN
            ? `Título curto (${title.length}). Ideal entre ${SEO_TITLE_IDEAL_MIN}–${SEO_TITLE_MAX} caracteres.`
            : title.length > SEO_TITLE_MAX
              ? `Título longo (${title.length}). Reduza para até ${SEO_TITLE_MAX} caracteres.`
              : "Tamanho ideal.",
    },
  });

  // Meta descrição.
  const descOk = desc.length >= SEO_DESC_IDEAL_MIN && desc.length <= SEO_DESC_MAX;
  checks.push({
    weight: 22,
    check: {
      id: "description",
      label: "Meta descrição",
      ok: descOk,
      severity: desc.length === 0 ? "critical" : "warning",
      hint:
        desc.length === 0
          ? "Adicione uma meta descrição."
          : desc.length < SEO_DESC_IDEAL_MIN
            ? `Meta descrição curta (${desc.length}). Ideal entre ${SEO_DESC_IDEAL_MIN}–${SEO_DESC_MAX} caracteres.`
            : desc.length > SEO_DESC_MAX
              ? `Meta descrição longa (${desc.length}). Reduza para até ${SEO_DESC_MAX} caracteres.`
              : "Tamanho ideal.",
    },
  });

  // Slug.
  const slugOk = slug.length > 0 && SLUG_RE.test(slug);
  checks.push({
    weight: 12,
    check: {
      id: "slug",
      label: "Slug amigável",
      ok: slugOk,
      severity: "warning",
      hint:
        slug.length === 0
          ? "Defina um slug em kebab-case (ex.: garrafa-750ml)."
          : slugOk
            ? "Slug válido."
            : "Use apenas letras minúsculas, números e hífens.",
    },
  });

  // Descrição rica.
  const richOk = rich.length >= SEO_RICH_DESC_MIN;
  checks.push({
    weight: 18,
    check: {
      id: "richDescription",
      label: "Descrição comercial",
      ok: richOk,
      severity: rich.length === 0 ? "critical" : "info",
      hint:
        rich.length === 0
          ? "Adicione uma descrição comercial do produto."
          : rich.length < SEO_RICH_DESC_MIN
            ? `Descrição curta (${rich.length}). Escreva pelo menos ${SEO_RICH_DESC_MIN} caracteres.`
            : "Boa descrição.",
    },
  });

  // Imagem principal.
  checks.push({
    weight: 12,
    check: {
      id: "image",
      label: "Imagem do produto",
      ok: hasImage,
      severity: "warning",
      hint: hasImage ? "Produto com imagem." : "Adicione uma imagem ao produto.",
    },
  });

  // Imagem Open Graph (usa a imagem principal como fallback aceitável).
  checks.push({
    weight: 6,
    check: {
      id: "ogImage",
      label: "Imagem de compartilhamento",
      ok: hasOg || hasImage,
      severity: "info",
      hint:
        hasOg || hasImage
          ? "Imagem de compartilhamento disponível."
          : "Defina uma imagem Open Graph para redes sociais.",
    },
  });

  // Palavras-chave.
  checks.push({
    weight: 8,
    check: {
      id: "keywords",
      label: "Palavras-chave",
      ok: keywords.length >= 3,
      severity: "info",
      hint:
        keywords.length >= 3
          ? `${keywords.length} palavras-chave definidas.`
          : "Defina ao menos 3 palavras-chave relevantes.",
    },
  });

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const gained = checks.reduce((s, c) => s + (c.check.ok ? c.weight : 0), 0);
  const score = Math.round((gained / totalWeight) * 100);

  return { score, grade: gradeFor(score), checks: checks.map((c) => c.check) };
}
