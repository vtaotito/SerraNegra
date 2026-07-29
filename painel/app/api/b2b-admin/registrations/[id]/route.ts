import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { getB2BRegistration, updateB2BRegistration } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/b2b-admin/registrations/:id — detalhe do cadastro B2B. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const regId = Number(id);
    if (!Number.isFinite(regId)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }

    const data = await getB2BRegistration(regId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
      if (error.message.includes("404") || /nao encontrado|não encontrado/i.test(error.message))
        return NextResponse.json({ success: false, error: "Cadastro não encontrado" }, { status: 404 });
    }
    console.error("[B2B_ADMIN_REGISTRATION GET]", error);
    const msg = error instanceof Error ? error.message : "Erro ao buscar cadastro";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/** PATCH /api/b2b-admin/registrations/:id — atualiza UDFs / dados do cadastro. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { id } = await params;
    const regId = Number(id);
    if (!Number.isFinite(regId)) {
      return NextResponse.json({ success: false, error: "id inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reviewedBy = session.displayName ?? session.username ?? null;

    const data = await updateB2BRegistration(regId, {
      ...body,
      reviewedBy: typeof body?.reviewedBy === "string" ? body.reviewedBy : reviewedBy,
    });

    await logActivity(session.sub, "B2B_REGISTRATION_UPDATED", {
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
    console.error("[B2B_ADMIN_REGISTRATION PATCH]", error);
    const msg = error instanceof Error ? error.message : "Erro ao atualizar cadastro";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
