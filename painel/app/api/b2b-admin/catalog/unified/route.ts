import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchB2BAdminCatalogUnified } from "@/lib/b2b-admin";

/**
 * GET /api/b2b-admin/catalog/unified?search=&inStock=&page=&limit=
 * Catálogo unificado (produto + embalagens) para venda assistida.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const sp = request.nextUrl.searchParams;
    const inStockRaw = sp.get("inStock");
    const data = await fetchB2BAdminCatalogUnified({
      search: sp.get("search") ?? undefined,
      category: sp.get("category") ?? undefined,
      inStock: inStockRaw === "true" ? true : inStockRaw === "false" ? false : undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_CATALOG_UNIFIED]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar catálogo" },
      { status: 500 },
    );
  }
}
