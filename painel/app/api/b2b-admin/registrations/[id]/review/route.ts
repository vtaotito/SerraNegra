import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { reviewB2BRegistration } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/b2b-admin/registrations/:id/review — assume análise (in_review). */
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

    const data = await reviewB2BRegistration(regId, {
      notes: typeof body?.notes === "string" ? body.notes : undefined,
      reviewedBy,
      notifyCustomer: body?.notifyCustomer !== false,
    });

    await logActivity(session.sub, "B2B_REGISTRATION_IN_REVIEW", {
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
    console.error("[B2B_ADMIN_REGISTRATION_REVIEW]", error);
    const msg = error instanceof Error ? error.message : "Erro ao assumir análise";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
