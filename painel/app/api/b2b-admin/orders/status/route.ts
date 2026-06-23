import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchB2BOrderStatusMap } from "@/lib/b2b-admin";

/**
 * GET /api/b2b-admin/orders/status?docEntries=1,2,3
 * Retorna o mapa doc_entry → status do funil e-commerce (colunas/KPIs).
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const raw = request.nextUrl.searchParams.get("docEntries") ?? "";
    const docEntries = raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const data = await fetchB2BOrderStatusMap(docEntries);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_ORDER_STATUS_MAP]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar status dos pedidos" },
      { status: 500 },
    );
  }
}
