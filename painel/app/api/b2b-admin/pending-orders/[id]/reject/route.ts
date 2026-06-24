import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { rejectB2BPendingOrder } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/b2b-admin/pending-orders/:id/reject — recusa o pedido do portal. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const pendingId = Number(id);
    if (!Number.isFinite(pendingId)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : undefined;

    const result = await rejectB2BPendingOrder(pendingId, reason);

    await logActivity(session.sub, "B2B_PENDING_ORDER_REJECTED", {
      pendingId,
      actorRole: session.role,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_PENDING_ORDER_REJECT]", error);
    const msg = error instanceof Error ? error.message : "Erro ao recusar pedido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
