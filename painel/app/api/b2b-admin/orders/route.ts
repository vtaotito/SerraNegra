import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { createB2BAdminOrder } from "@/lib/b2b-admin";

/**
 * POST /api/b2b-admin/orders — venda assistida: cria um pedido no SAP em nome
 * do cliente selecionado pela equipe de vendas.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const body = await request.json().catch(() => ({}));

    const cardCode = typeof body?.cardCode === "string" ? body.cardCode.trim() : "";
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const items = rawItems
      .map((i: any) => ({
        sku: typeof i?.sku === "string" ? i.sku : "",
        quantity: Number(i?.quantity),
        warehouse: typeof i?.warehouse === "string" ? i.warehouse : undefined,
      }))
      .filter((i: any) => i.sku && Number.isFinite(i.quantity) && i.quantity > 0);

    if (!cardCode) {
      return NextResponse.json(
        { success: false, error: "Selecione o cliente" },
        { status: 400 },
      );
    }
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Inclua ao menos um item com quantidade válida" },
        { status: 400 },
      );
    }

    const result = await createB2BAdminOrder({
      cardCode,
      cardName: typeof body?.cardName === "string" ? body.cardName : undefined,
      items,
      notes: typeof body?.notes === "string" ? body.notes : undefined,
      dueDate: typeof body?.dueDate === "string" ? body.dueDate : undefined,
      createdBy: session.displayName ?? session.username ?? undefined,
    });

    await logActivity(session.sub, "B2B_ASSISTED_ORDER_CREATED", {
      cardCode,
      docEntry: result.docEntry,
      items: items.length,
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
    console.error("[B2B_ADMIN_ASSISTED_ORDER]", error);
    const msg = error instanceof Error ? error.message : "Erro ao criar pedido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
