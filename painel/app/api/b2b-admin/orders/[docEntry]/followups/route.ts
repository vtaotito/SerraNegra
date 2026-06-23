import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { listB2BOrderFollowups, createB2BOrderFollowup } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string }> };

/** GET /api/b2b-admin/orders/:docEntry/followups — timeline de anotações. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const data = await listB2BOrderFollowups(Number(docEntry));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleError(error, "listar anotações do pedido");
  }
}

/** POST /api/b2b-admin/orders/:docEntry/followups — cria anotação/interação. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!note) {
      return NextResponse.json(
        { success: false, error: "A anotação é obrigatória" },
        { status: 400 },
      );
    }

    const result = await createB2BOrderFollowup(Number(docEntry), {
      note,
      statusTag: typeof body?.statusTag === "string" ? body.statusTag : null,
      cardCode: typeof body?.cardCode === "string" ? body.cardCode : null,
      createdBy: session.displayName ?? session.username ?? null,
    });

    await logActivity(session.sub, "B2B_ORDER_FOLLOWUP_CREATED", {
      docEntry: Number(docEntry),
      actorRole: session.role,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleError(error, "registrar anotação do pedido");
  }
}

function handleError(error: unknown, ctx: string) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }
  console.error("[B2B_ADMIN_ORDER_FOLLOWUPS]", error);
  const msg = error instanceof Error ? error.message : `Erro ao ${ctx}`;
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}
