import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { convertB2BQuotation } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** POST — converte cotação SAP em pedido (ORDR). */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const qId = Number(id);
    if (!Number.isFinite(qId)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }

    const data = await convertB2BQuotation(qId);
    await logActivity(session.sub, "B2B_QUOTATION_CONVERTED", {
      quotationId: qId,
      docEntry: data.docEntry,
      docNum: data.docNum,
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
    console.error("[B2B_ADMIN_QUOTATION_CONVERT]", error);
    const msg = error instanceof Error ? error.message : "Erro ao converter cotação";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
