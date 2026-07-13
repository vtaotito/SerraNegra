// Tipos e helpers da Gestão de Catálogo (admin). Espelham os DTOs do gateway
// (gateway/src/services/b2bCatalogService.ts → toAdminCatalogProduct).

import { adminGet } from "@/lib/admin/api";

export interface AdminProduct {
  sku: string;
  name: string;
  category: string | null;
  groupCode: number | null;
  ean: string | null;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoSlug: string | null;
  ogImageUrl: string | null;
  contentLocked: boolean;
  adminHidden: boolean;
  isActive: boolean;
  isInStock: boolean;
  stockQuantity: number;
  unitOfMeasure: string;
  matchConfirmed: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  lastSyncAt: string | null;
}

export interface AdminOverview {
  totalActive: number;
  noImage: number;
  hidden: number;
  locked: number;
  hiddenCategories: number;
  seoIncomplete: number;
}

export interface AdminCategory {
  category_name: string;
  is_visible: boolean;
  product_count: number;
  updated_by: string | null;
  updated_at: string | null;
}

export interface ProductsResponse {
  ok: boolean;
  data: AdminProduct[];
  total: number;
  page: number;
  pages: number;
}

export type VisibilityFilter = "all" | "visible" | "hidden";
export type SortField = "name" | "category" | "updated";
export type SortOrder = "asc" | "desc";

export interface ProductQuery {
  search?: string;
  category?: string;
  visibility?: VisibilityFilter;
  locked?: "all" | "locked" | "unlocked";
  noImage?: boolean;
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export function buildProductsUrl(q: ProductQuery): string {
  const p = new URLSearchParams();
  if (q.search) p.set("search", q.search);
  if (q.category) p.set("category", q.category);
  if (q.visibility && q.visibility !== "all") p.set("visibility", q.visibility);
  if (q.locked === "locked") p.set("locked", "true");
  else if (q.locked === "unlocked") p.set("locked", "false");
  if (q.noImage) p.set("noImage", "true");
  if (q.sort) p.set("sort", q.sort);
  if (q.order) p.set("order", q.order);
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 20));
  return `/b2b/admin/catalog/products?${p.toString()}`;
}

export function fetchProducts(q: ProductQuery): Promise<ProductsResponse> {
  return adminGet<ProductsResponse>(buildProductsUrl(q));
}

export function fetchOverview(): Promise<{ ok: boolean; data: AdminOverview }> {
  return adminGet<{ ok: boolean; data: AdminOverview }>("/b2b/admin/catalog/overview");
}

export function fetchCategories(): Promise<{ ok: boolean; data: AdminCategory[] }> {
  return adminGet<{ ok: boolean; data: AdminCategory[] }>("/b2b/admin/catalog/categories");
}

// Limites recomendados de SEO (usados nos contadores/preview).
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 155;

export function seoIsComplete(p: Pick<AdminProduct, "seoTitle" | "seoDescription">): boolean {
  return !!(p.seoTitle && p.seoTitle.trim() && p.seoDescription && p.seoDescription.trim());
}
