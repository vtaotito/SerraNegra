import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchB2BOrderFollowupCounts } from "@/lib/b2b-admin";

/**
 * GET /api/b2b-admin/orders/followups/counts?docEntries=1,2,3
 * Retorna a contagem de anotações por pedido (badges na lista).
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const raw = request.nextUrl.searchParams.get("docEntries") ?? "";
    const docEntries = raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const data = await fetchB2BOrderFollowupCounts(docEntries);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_ORDER_FOLLOWUP_COUNTS]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar contagem de anotações" },
      { status: 500 },
    );
  }
}
