import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, logActivity } from "@/lib/auth";
import { upsertB2BSalespersonContact } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ code: string }> };

const nullableStr = z.union([z.string().max(255), z.literal(""), z.null()]).optional();

const bodySchema = z.object({
  name: nullableStr,
  phone: nullableStr,
  whatsapp: nullableStr,
  email: nullableStr,
});

/** PUT /api/b2b-admin/salespersons/:code/contact — contato do vendedor. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin");
    const { code: raw } = await params;
    const code = Number(raw);
    if (!Number.isFinite(code) || code < 0) {
      return NextResponse.json(
        { success: false, error: "Código de vendedor inválido" },
        { status: 400 },
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 },
      );
    }

    const result = await upsertB2BSalespersonContact(code, parsed.data);

    await logActivity(session.sub, "B2B_SALESPERSON_CONTACT_UPDATED", {
      code,
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
    console.error("[B2B_ADMIN_SALESPERSON_CONTACT PUT]", error);
    const msg = error instanceof Error ? error.message : "Erro ao salvar contato";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
