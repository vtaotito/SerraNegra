import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, logActivity } from "@/lib/auth";
import { updateB2BCredentialEmail } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ cnpj: string }> };

const bodySchema = z.object({
  // string vazia ou null = remover o e-mail
  email: z
    .union([z.string().email("E-mail inválido").max(255), z.literal(""), z.null()])
    .optional(),
});

/**
 * PATCH /api/b2b-admin/credentials/:cnpj/email
 * Atualiza ou remove o e-mail cadastrado de uma credencial B2B.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin");
    const { cnpj } = await params;
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      return NextResponse.json(
        { success: false, error: "CNPJ inválido" },
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

    const rawEmail = parsed.data.email;
    const email = rawEmail && rawEmail.length > 0 ? rawEmail : null;

    const result = await updateB2BCredentialEmail(digits, email);

    await logActivity(
      session.sub,
      email ? "B2B_EMAIL_UPDATED_BY_ADMIN" : "B2B_EMAIL_REMOVED_BY_ADMIN",
      { cnpj: digits, actorRole: session.role },
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_UPDATE_EMAIL]", error);
    const msg = error instanceof Error ? error.message : "Erro ao atualizar e-mail";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
