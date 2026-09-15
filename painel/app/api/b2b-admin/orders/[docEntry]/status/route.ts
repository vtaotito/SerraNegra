import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import {
  setB2BOrderStatus,
  fetchB2BOrderStatusMap,
  sendImperiumCargas,
  sendImperiumNotas,
  B2B_ORDER_STATUSES,
  type B2BOrderStatus,
} from "@/lib/b2b-admin";

type RouteParams = { params: Promise<{ docEntry: string }> };

function asStatus(value: unknown): B2BOrderStatus | null {
  if (typeof value !== "string") return null;
  return B2B_ORDER_STATUSES.includes(value as B2BOrderStatus)
    ? (value as B2BOrderStatus)
    : null;
}

/** PUT /api/b2b-admin/orders/:docEntry/status — move o pedido no funil e-commerce. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin", "supervisor", "comercial");
    const { docEntry } = await params;
    const body = await request.json().catch(() => ({}));
    const status = body?.status as B2BOrderStatus;
    if (!B2B_ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status inválido" },
        { status: 400 },
      );
    }

    const entry = Number(docEntry);
    const fromBody = asStatus(body?.fromStatus);
    let previous = fromBody;
    if (!previous) {
      try {
        const current = await fetchB2BOrderStatusMap([entry]);
        previous =
          asStatus(current.map[String(entry)]) ??
          asStatus((current.map as Record<number, B2BOrderStatus>)[entry]);
      } catch {
        previous = null;
      }
    }

    const result = await setB2BOrderStatus(entry, {
      status,
      cardCode: typeof body?.cardCode === "string" ? body.cardCode : null,
      updatedBy: session.displayName ?? session.username ?? null,
    });

    await logActivity(session.sub, "B2B_ORDER_STATUS_CHANGED", {
      docEntry: entry,
      status,
      fromStatus: previous,
      actorRole: session.role,
    });

    let wms: {
      ok: boolean;
      kind?: "nf" | "carga";
      codCarga?: string;
      numeroNf?: number;
      nfSent?: number;
      error?: string;
    } | null = null;
    const docNum = Number(body?.docNum);
    const hasDocNum = Number.isFinite(docNum) && docNum > 0;

    if (status === "faturado" && previous !== "faturado") {
      if (!hasDocNum) {
        wms = {
          ok: false,
          kind: "nf",
          error: "Número do pedido ausente — não foi possível sincronizar a NF",
        };
      } else {
        try {
          const sent = await sendImperiumNotas({ docNums: [docNum], docEntry: entry });
          wms = {
            ok: true,
            kind: "nf",
            numeroNf: sent.numeroNf,
            nfSent: sent.sent,
          };
        } catch (err) {
          wms = {
            ok: false,
            kind: "nf",
            error: err instanceof Error ? err.message : "Falha ao sincronizar a NF no WMS",
          };
        }
      }
    } else if (previous === "faturado" && status === "separacao") {
      if (!hasDocNum) {
        wms = {
          ok: false,
          kind: "carga",
          error: "Número do pedido ausente — não foi possível enviar ao WMS",
        };
      } else {
        try {
          const sent = await sendImperiumCargas([docNum]);
          wms = { ok: true, kind: "carga", codCarga: sent.codCarga };
        } catch (err) {
          wms = {
            ok: false,
            kind: "carga",
            error: err instanceof Error ? err.message : "Falha ao enviar ao WMS",
          };
        }
      }
    }

    return NextResponse.json({ success: true, data: result, wms });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[B2B_ADMIN_ORDER_STATUS]", error);
    const msg = error instanceof Error ? error.message : "Erro ao atualizar status";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
