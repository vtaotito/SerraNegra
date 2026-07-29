import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { publishB2BRegistration } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/b2b-admin/registrations/:id/publish — aprova+publica BP no SAP. */
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

    const data = await publishB2BRegistration(regId, {
      notes: typeof body?.notes === "string" ? body.notes : undefined,
      reviewedBy,
      priceListNum:
        body?.priceListNum != null ? Number(body.priceListNum) : undefined,
      salesPersonCode:
        body?.salesPersonCode != null ? Number(body.salesPersonCode) : undefined,
      sapConfig:
        body?.sapConfig && typeof body.sapConfig === "object"
          ? body.sapConfig
          : undefined,
    });

    await logActivity(session.sub, "B2B_REGISTRATION_PUBLISHED", {
      registrationId: regId,
      cardCode: data.cardCode ?? null,
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
    console.error("[B2B_ADMIN_REGISTRATION_PUBLISH]", error);
    const msg = error instanceof Error ? error.message : "Erro ao publicar cadastro no SAP";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
