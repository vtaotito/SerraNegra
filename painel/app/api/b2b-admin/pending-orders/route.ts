import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listB2BPendingOrders, type B2BPendingOrderStatus } from "@/lib/b2b-admin";

/** GET /api/b2b-admin/pending-orders — pedidos do portal aguardando confirmação. */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const status = request.nextUrl.searchParams.get("status") as
      | B2BPendingOrderStatus
      | null;
    const data = await listB2BPendingOrders(status ?? undefined);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_PENDING_ORDERS]", error);
    const msg = error instanceof Error ? error.message : "Erro ao listar pedidos pendentes";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
