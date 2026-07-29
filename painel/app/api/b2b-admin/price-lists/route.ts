import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listB2BPriceLists } from "@/lib/b2b-admin";

/** GET /api/b2b-admin/price-lists — listas de preço ativas no SAP. */
export async function GET() {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const data = await listB2BPriceLists();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_PRICE_LISTS GET]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao listar listas de preço" },
      { status: 500 },
    );
  }
}
