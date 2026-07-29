import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { rejectB2BQuotation } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** POST — recusa/cancela cotação no SAP. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const qId = Number(id);
    if (!Number.isFinite(qId)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const data = await rejectB2BQuotation(
      qId,
      typeof body?.reason === "string" ? body.reason : undefined,
    );

    await logActivity(session.sub, "B2B_QUOTATION_REJECTED", {
      quotationId: qId,
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
    console.error("[B2B_ADMIN_QUOTATION_REJECT]", error);
    const msg = error instanceof Error ? error.message : "Erro ao recusar cotação";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
