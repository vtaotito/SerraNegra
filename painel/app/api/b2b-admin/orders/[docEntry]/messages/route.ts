import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { listB2BOrderMessages, replyB2BOrderMessage } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string }> };

/** GET /api/b2b-admin/orders/:docEntry/messages — fio da conversa do pedido. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const data = await listB2BOrderMessages(Number(docEntry));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleError(error, "listar mensagens do pedido");
  }
}

/** POST /api/b2b-admin/orders/:docEntry/messages — vendedor responde no fio. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const body = await request.json().catch(() => ({}));
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json({ success: false, error: "Mensagem vazia" }, { status: 400 });
    }
    const data = await replyB2BOrderMessage(Number(docEntry), {
      body: text,
      authorName: session.displayName ?? session.username ?? null,
    });
    await logActivity(session.sub, "B2B_ORDER_MESSAGE_SENT", {
      docEntry: Number(docEntry),
      actorRole: session.role,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleError(error, "responder mensagem do pedido");
  }
}

function handleError(error: unknown, ctx: string) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }
  console.error("[B2B_ADMIN_ORDER_MESSAGES]", error);
  const msg = error instanceof Error ? error.message : `Erro ao ${ctx}`;
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}
