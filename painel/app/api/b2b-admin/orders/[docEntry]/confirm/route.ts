import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { confirmB2BOrder } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string }> };

/**
 * POST /api/b2b-admin/orders/:docEntry/confirm — confirma um pedido SAP como
 * estado operacional local (não altera o documento no SAP) e o coloca no funil.
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

    const result = await confirmB2BOrder(id, {
      cardCode: typeof body?.cardCode === "string" ? body.cardCode : null,
      confirmedBy: session.displayName ?? session.username ?? null,
    });

    await logActivity(session.sub, "B2B_ORDER_CONFIRMED", {
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
    console.error("[B2B_ADMIN_ORDER_CONFIRM]", error);
    const msg = error instanceof Error ? error.message : "Erro ao confirmar pedido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
