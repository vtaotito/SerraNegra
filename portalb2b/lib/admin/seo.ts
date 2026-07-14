// Tipos e helpers da funcionalidade de SEO (IA + ranqueamento GSC) do admin.
// Espelham os DTOs do gateway (seoAiService / searchConsoleService / seoQuality).

import { adminGet, adminPost } from "@/lib/admin/api";

// ─── Sugestões de IA ─────────────────────────────────────────────────

export interface ProductSeoSuggestion {
  seo_title: string;
  seo_description: string;
  seo_slug: string;
  description_rich: string;
  keywords: string[];
  attributes: { name: string; value: string }[];
}

export interface CategorySeoSuggestion {
  seo_title: string;
  seo_description: string;
  intro_text: string;
  keywords: string[];
}

// ─── Score determinístico ────────────────────────────────────────────

export type SeoGrade = "A" | "B" | "C" | "D" | "E";
export type SeoCheckSeverity = "critical" | "warning" | "info";

export interface SeoCheck {
  id: string;
  label: string;
  ok: boolean;
  severity: SeoCheckSeverity;
  hint: string;
}

export interface SeoScoreResult {
  score: number;
  grade: SeoGrade;
  checks: SeoCheck[];
}

// ─── Métricas GSC ────────────────────────────────────────────────────

export interface SeoMetric {
  scope: "product" | "category";
  ref_key: string;
  url: string | null;
  period_start: string;
  period_end: string;
  position: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
  fetched_at: string;
}

export interface SeoQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ProductMetricsResponse {
  ok: boolean;
  error?: string;
  code?: string;
  data: {
    canonicalUrl: string | null;
    hasPublicUrl: boolean;
    metric: SeoMetric | null;
    history: SeoMetric[];
    queries: SeoQuery[];
  };
}

// ─── Dashboard ───────────────────────────────────────────────────────

export interface SeoDashboardProduct {
  sku: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  canonicalUrl: string | null;
  hasPublicUrl: boolean;
  score: number;
  grade: SeoGrade;
  position: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
}

export interface SeoDashboard {
  config: {
    openaiConfigured: boolean;
    gscConfigured: boolean;
    gscSiteUrl: string | null;
  };
  summary: {
    totalProducts: number;
    withPublicUrl: number;
    withoutPublicUrl: number;
    avgScore: number;
    gradeDistribution: Record<SeoGrade, number>;
    avgPosition: number | null;
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number | null;
    metricsFetchedAt: string | null;
  };
  products: SeoDashboardProduct[];
}

export interface SeoConfig {
  openaiConfigured: boolean;
  openaiModel: string;
  gscConfigured: boolean;
  gscSiteUrl: string | null;
  windowDays: number;
}

// ─── Helpers de API ──────────────────────────────────────────────────

export function suggestProductSeo(sku: string): Promise<{ ok: boolean; data: ProductSeoSuggestion }> {
  return adminPost<{ ok: boolean; data: ProductSeoSuggestion }>(
    `/b2b/admin/catalog/products/${encodeURIComponent(sku)}/seo/suggest`,
  );
}

export function suggestCategorySeo(
  name: string,
): Promise<{ ok: boolean; data: CategorySeoSuggestion }> {
  return adminPost<{ ok: boolean; data: CategorySeoSuggestion }>(
    `/b2b/admin/catalog/categories/${encodeURIComponent(name)}/seo/suggest`,
  );
}

export function fetchSeoConfig(): Promise<{ ok: boolean; data: SeoConfig }> {
  return adminGet<{ ok: boolean; data: SeoConfig }>("/b2b/admin/catalog/seo/config");
}

export function fetchSeoDashboard(category?: string): Promise<{ ok: boolean; data: SeoDashboard }> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return adminGet<{ ok: boolean; data: SeoDashboard }>(`/b2b/admin/catalog/seo/dashboard${qs}`);
}

export function fetchProductScore(sku: string): Promise<{ ok: boolean; data: SeoScoreResult }> {
  return adminGet<{ ok: boolean; data: SeoScoreResult }>(
    `/b2b/admin/catalog/products/${encodeURIComponent(sku)}/seo/score`,
  );
}

export function fetchProductMetrics(sku: string, refresh = false): Promise<ProductMetricsResponse> {
  const qs = refresh ? "?refresh=1" : "";
  return adminGet<ProductMetricsResponse>(
    `/b2b/admin/catalog/products/${encodeURIComponent(sku)}/seo/metrics${qs}`,
  );
}

export function refreshSeoMetrics(): Promise<{ ok: boolean; data: { periodStart: string; periodEnd: string } }> {
  return adminPost<{ ok: boolean; data: { periodStart: string; periodEnd: string } }>(
    "/b2b/admin/catalog/seo/metrics/refresh",
  );
}

// ─── Formatação / cores ──────────────────────────────────────────────

// ─── Score determinístico (espelho do backend, para preview ao vivo) ──

export interface SeoScoreInput {
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoSlug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  ogImageUrl?: string | null;
  keywords?: string[] | null;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const T_IDEAL_MIN = 50;
const T_MAX = 60;
const D_IDEAL_MIN = 150;
const D_MAX = 160;
const RICH_MIN = 120;

function gradeFor(score: number): SeoGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "E";
}

/** Espelha computeSeoScore do gateway (seoQuality.ts) para o preview ao vivo. */
export function computeSeoScoreLocal(input: SeoScoreInput): SeoScoreResult {
  const title = (input.seoTitle ?? "").trim();
  const desc = (input.seoDescription ?? "").trim();
  const slug = (input.seoSlug ?? "").trim();
  const rich = (input.description ?? "").trim();
  const hasImage = !!(input.imageUrl && input.imageUrl.trim());
  const hasOg = !!(input.ogImageUrl && input.ogImageUrl.trim());
  const keywords = (input.keywords ?? []).filter((k) => k && k.trim());

  const checks: { check: SeoCheck; weight: number }[] = [
    {
      weight: 22,
      check: {
        id: "title",
        label: "Título de SEO",
        ok: title.length >= T_IDEAL_MIN && title.length <= T_MAX,
        severity: title.length === 0 ? "critical" : "warning",
        hint:
          title.length === 0
            ? "Adicione um título de SEO."
            : title.length < T_IDEAL_MIN
              ? `Título curto (${title.length}). Ideal ${T_IDEAL_MIN}–${T_MAX}.`
              : title.length > T_MAX
                ? `Título longo (${title.length}). Máx. ${T_MAX}.`
                : "Tamanho ideal.",
      },
    },
    {
      weight: 22,
      check: {
        id: "description",
        label: "Meta descrição",
        ok: desc.length >= D_IDEAL_MIN && desc.length <= D_MAX,
        severity: desc.length === 0 ? "critical" : "warning",
        hint:
          desc.length === 0
            ? "Adicione uma meta descrição."
            : desc.length < D_IDEAL_MIN
              ? `Curta (${desc.length}). Ideal ${D_IDEAL_MIN}–${D_MAX}.`
              : desc.length > D_MAX
                ? `Longa (${desc.length}). Máx. ${D_MAX}.`
                : "Tamanho ideal.",
      },
    },
    {
      weight: 12,
      check: {
        id: "slug",
        label: "Slug amigável",
        ok: slug.length > 0 && SLUG_RE.test(slug),
        severity: "warning",
        hint:
          slug.length === 0
            ? "Defina um slug em kebab-case."
            : SLUG_RE.test(slug)
              ? "Slug válido."
              : "Use apenas letras minúsculas, números e hífens.",
      },
    },
    {
      weight: 18,
      check: {
        id: "richDescription",
        label: "Descrição comercial",
        ok: rich.length >= RICH_MIN,
        severity: rich.length === 0 ? "critical" : "info",
        hint:
          rich.length === 0
            ? "Adicione uma descrição comercial."
            : rich.length < RICH_MIN
              ? `Curta (${rich.length}). Mín. ${RICH_MIN}.`
              : "Boa descrição.",
      },
    },
    {
      weight: 12,
      check: {
        id: "image",
        label: "Imagem do produto",
        ok: hasImage,
        severity: "warning",
        hint: hasImage ? "Produto com imagem." : "Adicione uma imagem.",
      },
    },
    {
      weight: 6,
      check: {
        id: "ogImage",
        label: "Imagem de compartilhamento",
        ok: hasOg || hasImage,
        severity: "info",
        hint: hasOg || hasImage ? "Disponível." : "Defina uma imagem Open Graph.",
      },
    },
    {
      weight: 8,
      check: {
        id: "keywords",
        label: "Palavras-chave",
        ok: keywords.length >= 3,
        severity: "info",
        hint: keywords.length >= 3 ? `${keywords.length} definidas.` : "Defina ao menos 3.",
      },
    },
  ];

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const gained = checks.reduce((s, c) => s + (c.check.ok ? c.weight : 0), 0);
  const score = Math.round((gained / totalWeight) * 100);
  return { score, grade: gradeFor(score), checks: checks.map((c) => c.check) };
}

export function gradeColor(grade: SeoGrade): string {
  switch (grade) {
    case "A":
      return "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";
    case "B":
      return "text-lime-300 bg-lime-500/15 border-lime-500/30";
    case "C":
      return "text-amber-300 bg-amber-500/15 border-amber-500/30";
    case "D":
      return "text-orange-300 bg-orange-500/15 border-orange-500/30";
    default:
      return "text-rose-300 bg-rose-500/15 border-rose-500/30";
  }
}

export function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  if (score >= 35) return "text-orange-400";
  return "text-rose-400";
}

export function formatCtr(ctr: number | null): string {
  if (ctr == null) return "—";
  return `${(ctr * 100).toFixed(1)}%`;
}

export function formatPosition(pos: number | null): string {
  if (pos == null) return "—";
  return pos.toFixed(1);
}
