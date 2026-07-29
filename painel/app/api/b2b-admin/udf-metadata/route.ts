import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { fetchB2BUdfMetadata } from "@/lib/b2b-admin";

/** GET /api/b2b-admin/udf-metadata — metadados de UDFs/SAP para revisão de cadastro. */
export async function GET() {
  try {
    await requireRole("admin", "supervisor", "comercial");
    const data = await fetchB2BUdfMetadata();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_UDF_METADATA GET]", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar metadados UDF" },
      { status: 500 },
    );
  }
}
