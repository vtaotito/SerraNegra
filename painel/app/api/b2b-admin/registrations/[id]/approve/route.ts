import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { approveB2BRegistration } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/b2b-admin/registrations/:id/approve — aprova cadastro pendente. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const regId = Number(id);
    if (!Number.isFinite(regId)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reviewedBy = session.displayName ?? session.username ?? undefined;

    const data = await approveB2BRegistration(regId, {
      notes: typeof body?.notes === "string" ? body.notes : undefined,
      reviewedBy,
    });

    await logActivity(session.sub, "B2B_REGISTRATION_APPROVED", {
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
    console.error("[B2B_ADMIN_REGISTRATION_APPROVE]", error);
    const msg = error instanceof Error ? error.message : "Erro ao aprovar cadastro";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
