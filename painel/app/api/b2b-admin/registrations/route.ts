import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listB2BRegistrations } from "@/lib/b2b-admin";

/** GET /api/b2b-admin/registrations?status=pending — cadastros B2B pendentes. */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const data = await listB2BRegistrations(status);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_REGISTRATIONS GET]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao listar cadastros B2B" },
      { status: 500 },
    );
  }
}
