import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listB2BEmailRequests } from "@/lib/b2b-admin";

/**
 * GET /api/b2b-admin/email-requests?status=pending
 * Lista solicitações de acesso por e-mail (clientes SAP sem e-mail cadastrado).
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "supervisor");
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const data = await listB2BEmailRequests(status);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_EMAIL_REQUESTS GET]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao listar solicitações de acesso" },
      { status: 500 },
    );
  }
}
