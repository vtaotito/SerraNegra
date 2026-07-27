import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { cancelB2BOrder } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string }> };

/**
 * POST /api/b2b-admin/orders/:docEntry/cancel — cancela o pedido no SAP
 * (Service Layer). O gateway rejeita (409) se o pedido já estiver faturado.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const id = Number(docEntry);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "docEntry inválido" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : undefined;

    const result = await cancelB2BOrder(id, reason);

    await logActivity(session.sub, "B2B_ORDER_CANCELLED", {
      docEntry: id,
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
    console.error("[B2B_ADMIN_ORDER_CANCEL]", error);
    const msg = error instanceof Error ? error.message : "Erro ao cancelar pedido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
