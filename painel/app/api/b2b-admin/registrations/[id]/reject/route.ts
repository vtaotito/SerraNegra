import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { rejectB2BRegistration } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/b2b-admin/registrations/:id/reject — rejeita cadastro pendente. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const regId = Number(id);
    if (!Number.isFinite(regId)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    if (!notes) {
      return NextResponse.json(
        { success: false, error: "Motivo da rejeição é obrigatório" },
        { status: 400 },
      );
    }

    const reviewedBy = session.displayName ?? session.username ?? undefined;

    const data = await rejectB2BRegistration(regId, { notes, reviewedBy });

    await logActivity(session.sub, "B2B_REGISTRATION_REJECTED", {
      registrationId: regId,
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
    console.error("[B2B_ADMIN_REGISTRATION_REJECT]", error);
    const msg = error instanceof Error ? error.message : "Erro ao rejeitar cadastro";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
