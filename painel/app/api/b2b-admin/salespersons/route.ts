import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listB2BSalespersons } from "@/lib/b2b-admin";

export async function GET() {
  try {
    await requireRole("admin", "supervisor");
    const data = await listB2BSalespersons();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_SALESPERSONS GET]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao listar vendedores" },
      { status: 500 },
    );
  }
}
