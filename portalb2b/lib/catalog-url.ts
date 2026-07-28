export type StockFilter = "" | "in" | "out";

export const CATALOG_URL_STORAGE_KEY = "b2b-catalog-url";

export function parseStockFilter(value: string | null | undefined): StockFilter {
  if (value === "in" || value === "out") return value;
  return "";
}

export function parseCatalogPage(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function buildCatalogHref(opts: {
  q?: string;
  categoria?: string;
  estoque?: StockFilter;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (opts.q) sp.set("q", opts.q);
  if (opts.categoria) sp.set("categoria", opts.categoria);
  if (opts.estoque) sp.set("estoque", opts.estoque);
  if (opts.page && opts.page > 1) sp.set("page", String(opts.page));
  const qs = sp.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

export function rememberCatalogUrl(href: string) {
  try {
    sessionStorage.setItem(CATALOG_URL_STORAGE_KEY, href);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getRememberedCatalogUrl(): string {
  try {
    return sessionStorage.getItem(CATALOG_URL_STORAGE_KEY) ?? "/catalogo";
  } catch {
    return "/catalogo";
  }
}
