import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { approveB2BEmailRequest } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/b2b-admin/email-requests/:id/approve
 * Aprova a solicitação: grava o e-mail na credencial e notifica o cliente.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const notes = typeof body?.notes === "string" ? body.notes : undefined;

    const result = await approveB2BEmailRequest(Number(id), notes);

    await logActivity(session.sub, "B2B_EMAIL_ACCESS_APPROVED", {
      requestId: Number(id),
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
    console.error("[B2B_ADMIN_EMAIL_REQUEST_APPROVE]", error);
    const msg = error instanceof Error ? error.message : "Erro ao aprovar solicitação";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
