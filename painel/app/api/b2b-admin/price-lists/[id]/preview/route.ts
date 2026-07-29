import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { previewB2BPriceList } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/b2b-admin/price-lists/:id/preview — amostra de preços da lista. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const priceListNo = Number(id);
    if (!Number.isFinite(priceListNo)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }

    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const data = await previewB2BPriceList(priceListNo, { search, limit });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_PRICE_LIST_PREVIEW]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao pré-visualizar lista de preço" },
      { status: 500 },
    );
  }
}
