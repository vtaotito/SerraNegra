import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { setB2BOrderStatus, B2B_ORDER_STATUSES, type B2BOrderStatus } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string }> };

/** PUT /api/b2b-admin/orders/:docEntry/status — move o pedido no funil e-commerce. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const body = await request.json().catch(() => ({}));
    const status = body?.status as B2BOrderStatus;
    if (!B2B_ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status inválido" },
        { status: 400 },
      );
    }

    const result = await setB2BOrderStatus(Number(docEntry), {
      status,
      cardCode: typeof body?.cardCode === "string" ? body.cardCode : null,
      updatedBy: session.displayName ?? session.username ?? null,
    });

    await logActivity(session.sub, "B2B_ORDER_STATUS_CHANGED", {
      docEntry: Number(docEntry),
      status,
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
    console.error("[B2B_ADMIN_ORDER_STATUS]", error);
    const msg = error instanceof Error ? error.message : "Erro ao atualizar status";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
