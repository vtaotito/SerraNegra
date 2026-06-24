import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { deleteB2BOrderItemNote } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string; id: string }> };

/** DELETE /api/b2b-admin/orders/:docEntry/item-notes/:id — remove sinalização. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry, id } = await params;
    const data = await deleteB2BOrderItemNote(Number(docEntry), Number(id));
    await logActivity(session.sub, "B2B_ORDER_ITEM_NOTE_DELETED", {
      docEntry: Number(docEntry),
      noteId: Number(id),
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
    console.error("[B2B_ADMIN_ORDER_ITEM_NOTE_DELETE]", error);
    const msg = error instanceof Error ? error.message : "Erro ao remover sinalização";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
