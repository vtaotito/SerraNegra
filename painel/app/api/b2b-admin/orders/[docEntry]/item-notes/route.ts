import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import {
  listB2BOrderItemNotes,
  createB2BOrderItemNote,
  type B2BItemFlag,
} from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string }> };

const VALID_FLAGS: B2BItemFlag[] = ["falta", "substituicao", "observacao"];

/** GET /api/b2b-admin/orders/:docEntry/item-notes — sinalizações por item. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const data = await listB2BOrderItemNotes(Number(docEntry));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleError(error, "listar sinalizações dos itens");
  }
}

/** POST /api/b2b-admin/orders/:docEntry/item-notes — cria sinalização por item. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const body = await request.json().catch(() => ({}));
    const sku = typeof body?.sku === "string" ? body.sku : "";
    const flag = body?.flag as B2BItemFlag;
    if (!sku || !VALID_FLAGS.includes(flag)) {
      return NextResponse.json(
        { success: false, error: "sku e flag (falta|substituicao|observacao) obrigatórios" },
        { status: 400 },
      );
    }
    const data = await createB2BOrderItemNote(Number(docEntry), {
      sku,
      flag,
      note: typeof body?.note === "string" ? body.note : null,
    });
    await logActivity(session.sub, "B2B_ORDER_ITEM_NOTE_CREATED", {
      docEntry: Number(docEntry),
      sku,
      flag,
      actorRole: session.role,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleError(error, "criar sinalização do item");
  }
}

function handleError(error: unknown, ctx: string) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED")
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    if (error.message === "FORBIDDEN")
      return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
  }
  console.error("[B2B_ADMIN_ORDER_ITEM_NOTES]", error);
  const msg = error instanceof Error ? error.message : `Erro ao ${ctx}`;
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}
