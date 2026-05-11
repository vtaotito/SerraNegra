import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import { runSapToRdSync, getRecentSyncLogs } from "@/lib/rd-sync-sap";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * POST /api/integrations/rd-marketing/sync-sap
 *
 * Sincroniza clientes SAP → RD Station Marketing como conversões.
 * Body opcional: { dryRun?: boolean, conversionIdentifier?: string, maxContacts?: number }
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole("admin", "supervisor");
  } catch (err) {
    const code =
      err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      {
        success: false,
        error: code === 403 ? "Sem permissão" : "Não autenticado",
      },
      { status: code },
    );
  }

  let body: {
    dryRun?: boolean;
    conversionIdentifier?: string;
    maxContacts?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // body vazio é ok
  }

  try {
    const result = await runSapToRdSync({
      triggeredBy: session.sub,
      dryRun: body.dryRun ?? false,
      conversionIdentifier: body.conversionIdentifier ?? "sync-sap-cliente",
      maxContacts: Math.min(body.maxContacts ?? 500, 1000),
    });

    await logActivity(
      session.sub,
      "INTEGRATION_RD_SAP_SYNC",
      {
        dryRun: result.dryRun,
        total: result.totalSapCustomers,
        withEmail: result.withEmail,
        sent: result.sent,
        succeeded: result.succeeded,
        failed: result.failed,
        elapsedMs: result.elapsedMs,
      },
      clientIp(request),
    );

    return NextResponse.json({
      success: true,
      data: {
        totalSapCustomers: result.totalSapCustomers,
        withEmail: result.withEmail,
        sent: result.sent,
        succeeded: result.succeeded,
        failed: result.failed,
        skippedNoEmail: result.skippedNoEmail,
        dryRun: result.dryRun,
        elapsedMs: result.elapsedMs,
        sampleDetails: result.details.slice(0, 20).map((d) => ({
          cardCode: d.cardCode,
          email: d.email,
          tags: d.tags,
          ok: d.ok,
          reason: d.reason,
          tagsApplied: d.tagsApplied,
          tagsNote: d.tagsNote,
        })),
      },
    });
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "Falha no sync SAP → RD";
    await logActivity(
      session.sub,
      "INTEGRATION_RD_SAP_SYNC",
      { error: reason },
      clientIp(request),
    );
    return NextResponse.json(
      { success: false, error: reason },
      { status: 502 },
    );
  }
}

/**
 * GET /api/integrations/rd-marketing/sync-sap
 *
 * Retorna o log das últimas sincronizações.
 */
export async function GET() {
  try {
    await requireRole("admin", "supervisor");
  } catch (err) {
    const code =
      err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      {
        success: false,
        error: code === 403 ? "Sem permissão" : "Não autenticado",
      },
      { status: code },
    );
  }

  try {
    const logs = await getRecentSyncLogs(50);
    return NextResponse.json({ success: true, data: { logs } });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Falha ao consultar logs",
      },
      { status: 500 },
    );
  }
}
