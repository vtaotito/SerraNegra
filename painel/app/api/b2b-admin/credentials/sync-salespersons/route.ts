import { NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { syncB2BCredentialSalespersons } from "@/lib/b2b-admin";

/**
 * POST /api/b2b-admin/credentials/sync-salespersons
 * Sincroniza SalesPersonCode do SAP → b2b_credentials (só preenche vazios).
 */
export async function POST() {
  try {
    const session = await requireRole("admin");
    const data = await syncB2BCredentialSalespersons();

    await logActivity(session.sub, "B2B_SALESPERSONS_SYNCED", {
      updated: data.updated,
      alreadySet: data.alreadySet,
      missingInSap: data.missingInSap,
      total: data.total,
      actorRole: session.role,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_SYNC_SALESPERSONS]", error);
    const msg = error instanceof Error ? error.message : "Erro ao sincronizar vendedores";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
