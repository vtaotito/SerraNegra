import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, logActivity } from "@/lib/auth";
import { setB2BCredentialSalesperson } from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ cnpj: string }> };

const bodySchema = z.object({
  // null = remover o vendedor associado
  salesPersonCode: z.union([z.number().int().min(0), z.null()]),
});

/**
 * PATCH /api/b2b-admin/credentials/:cnpj/salesperson
 * Associa (ou remove) o vendedor de um cliente B2B (grava local + SAP).
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

    const result = await setB2BCredentialSalesperson(digits, parsed.data.salesPersonCode);

    await logActivity(session.sub, "B2B_SALESPERSON_ASSIGNED", {
      cnpj: digits,
      salesPersonCode: parsed.data.salesPersonCode,
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
    console.error("[B2B_ADMIN_ASSIGN_SALESPERSON]", error);
    const msg = error instanceof Error ? error.message : "Erro ao associar vendedor";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
