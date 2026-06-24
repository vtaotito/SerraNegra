import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { resolveB2BOrderRequest } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string; id: string }> };

/** POST /api/b2b-admin/orders/:docEntry/requests/:id/resolve — atende/recusa solicitação. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry, id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    if (status !== "resolvido" && status !== "recusado") {
      return NextResponse.json(
        { success: false, error: "status inválido (resolvido|recusado)" },
        { status: 400 },
      );
    }
    const data = await resolveB2BOrderRequest(Number(docEntry), Number(id), {
      status,
      note: typeof body?.note === "string" ? body.note : null,
    });
    await logActivity(session.sub, "B2B_ORDER_REQUEST_RESOLVED", {
      docEntry: Number(docEntry),
      requestId: Number(id),
      status,
      actorRole: session.role,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_ORDER_REQUEST_RESOLVE]", error);
    const msg = error instanceof Error ? error.message : "Erro ao resolver solicitação";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
