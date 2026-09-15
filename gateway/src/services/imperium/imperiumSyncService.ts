import type pg from "pg";
import { createSapClient } from "../../config/sap.js";
import { sapConfigStore } from "../../config/sapConfigStore.js";
import { loadImperiumConfig, maskUrl } from "./config.js";
import {
  buildCancelarNotaFiscalXml,
  buildCancelarPedidoXml,
  buildChecarStatusXml,
  buildConsultarCargaXml,
  buildConsultarPedidoXml,
  buildEmptyBody,
  buildEnviarPedidosXml,
  buildFabricanteSalvarXml,
  buildInformarNotaFiscalXml,
  buildListCargasXml,
  buildProdutoSalvarXml,
} from "./builders.js";
import { formatBrDate, extractTag } from "./xml.js";
import { callImperiumSoap, ImperiumNotConfiguredError, probeImperiumWsdl } from "./soapClient.js";
import { mapCargaFromOrders, mapNotasSaida, mapProdutoCadastro, type SapPartner } from "./mappers.js";
import { ensureImperiumSchema } from "./schema.js";
import type { ImperiumSoapResult } from "./types.js";

type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

function silentLogger(): Logger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

async function recordOutbox(
  db: pg.Pool,
  row: {
    entityType: string;
    entityId: string;
    method: string;
    payloadXml?: string;
    result: ImperiumSoapResult;
    idempotencyKey?: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO imperium_outbox
       (entity_type, entity_id, method, payload_xml, response_xml, status, attempts, idempotency_key, error_message)
     VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8)
     ON CONFLICT (idempotency_key)
     DO UPDATE SET
       response_xml = EXCLUDED.response_xml,
       status = EXCLUDED.status,
       attempts = imperium_outbox.attempts + 1,
       error_message = EXCLUDED.error_message,
       updated_at = NOW()`,
    [
      row.entityType,
      row.entityId,
      row.method,
      row.payloadXml ?? null,
      row.result.bodyXml.slice(0, 20000),
      row.result.ok ? "SENT" : "FAILED",
      row.idempotencyKey ?? null,
      row.result.fault ?? (row.result.ok ? null : `HTTP ${row.result.statusCode}`),
    ],
  );
}

function soapError(result: ImperiumSoapResult): Error {
  return new Error(result.fault ?? `Imperium ${result.method} falhou (HTTP ${result.statusCode})`);
}

export class ImperiumSyncService {
  constructor(
    private readonly db: pg.Pool,
    private readonly log: Logger = silentLogger(),
  ) {}

  async init(): Promise<void> {
    await ensureImperiumSchema(this.db);
  }

  health() {
    const cfg = loadImperiumConfig();
    return {
      configured: cfg.configured,
      baseUrl: maskUrl(cfg.baseUrl),
      username: cfg.username ? `${cfg.username.slice(0, 3)}***` : null,
      defaultPlaca: cfg.defaultPlaca,
      defaultGrade: cfg.defaultGrade,
      hasCnpjEmitente: Boolean(cfg.cnpjEmitente),
    };
  }

  async probe() {
    const cfg = loadImperiumConfig();
    const meta = this.health();
    if (!cfg.configured) {
      return { ...meta, healthy: false, responseTimeMs: null, message: "Credenciais Imperium ausentes" };
    }
    const probe = await probeImperiumWsdl("expedicao");
    return {
      ...meta,
      healthy: probe.ok,
      responseTimeMs: probe.durationMs,
      message: probe.message,
      statusCode: probe.statusCode,
    };
  }

  async smokeTest() {
    const cfg = loadImperiumConfig();
    if (!cfg.configured) throw new ImperiumNotConfiguredError();

    const wsdl = await probeImperiumWsdl("produto");
    const listar = await callImperiumSoap("produto", "listar", buildEmptyBody());
    const hoje = new Date();
    const ini = new Date(hoje.getTime() - 7 * 86400000);
    const cargas = await callImperiumSoap(
      "expedicao",
      "listCargas",
      buildListCargasXml(formatBrDate(ini), formatBrDate(hoje)),
    );

    return {
      wsdl,
      produtoListar: {
        ok: listar.ok,
        statusCode: listar.statusCode,
        fault: listar.fault,
        durationMs: listar.durationMs,
        booleanReturn: listar.booleanReturn,
      },
      listCargas: {
        ok: cargas.ok,
        statusCode: cargas.statusCode,
        fault: cargas.fault,
        durationMs: cargas.durationMs,
      },
    };
  }

  async ensureDefaultFabricante() {
    const cfg = loadImperiumConfig();
    const xml = buildFabricanteSalvarXml(cfg.defaultFabricante, "GSN");
    const result = await callImperiumSoap("fabricante", "salvar", xml);
    await recordOutbox(this.db, {
      entityType: "fabricante",
      entityId: cfg.defaultFabricante,
      method: "salvar",
      payloadXml: xml,
      result,
      idempotencyKey: `fabricante:${cfg.defaultFabricante}`,
    });
    return result;
  }

  async syncProducts(opts: { limit?: number } = {}) {
    await this.init();
    await this.ensureDefaultFabricante();

    const items = await this.listLocalCatalog(opts.limit ?? 500);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const mapped = mapProdutoCadastro(item);
        const xml = buildProdutoSalvarXml(mapped);
        const result = await callImperiumSoap("produto", "salvar", xml);
        await recordOutbox(this.db, {
          entityType: "produto",
          entityId: mapped.idProduto,
          method: "salvar",
          payloadXml: xml,
          result,
          idempotencyKey: `produto:${mapped.idProduto}`,
        });
        if (result.ok) sent += 1;
        else {
          failed += 1;
          errors.push(`${mapped.idProduto}: ${result.fault ?? result.statusCode}`);
        }
      } catch (err) {
        failed += 1;
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    await this.db.query(
      `INSERT INTO imperium_sync_state (key, value, updated_at)
       VALUES ('products.last_sync', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [new Date().toISOString()],
    );

    return { ok: failed === 0, fetched: items.length, sent, failed, errors: errors.slice(0, 20) };
  }

  async sendCargas(opts: { docNums: number[]; placa?: string; placaExpedicao?: string }) {
    await this.init();
    const docNums = [...new Set(opts.docNums.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    if (docNums.length === 0) throw new Error("Informe ao menos um número de pedido");

    const orders = await this.loadOrders(docNums);
    if (orders.length === 0) throw new Error("Pedidos não encontrados no espelho SAP local");

    const partnerByCard = await this.loadPartners(
      orders.map((o) => o.header.card_code).filter((c): c is string => Boolean(c)),
    );

    const carga = mapCargaFromOrders(orders, {
      placa: opts.placa,
      placaExpedicao: opts.placaExpedicao,
      partnerByCard,
    });
    const xml = buildEnviarPedidosXml(carga);
    const result = await callImperiumSoap("expedicao", "enviarPedidos", xml);
    await recordOutbox(this.db, {
      entityType: "carga",
      entityId: carga.codCarga,
      method: "enviarPedidos",
      payloadXml: xml,
      result,
      idempotencyKey: `enviarPedidos:${carga.codCarga}`,
    });

    await this.db.query(
      `INSERT INTO imperium_cargas (cod_carga, doc_nums, placa, situacao, last_error, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (cod_carga) DO UPDATE SET
         doc_nums = EXCLUDED.doc_nums,
         placa = EXCLUDED.placa,
         situacao = EXCLUDED.situacao,
         last_error = EXCLUDED.last_error,
         updated_at = NOW()`,
      [
        carga.codCarga,
        carga.pedidos.map((p) => Number(p.codPedido)),
        carga.placa,
        result.ok ? "ENVIADO" : "ERRO",
        result.ok ? null : result.fault ?? `HTTP ${result.statusCode}`,
      ],
    );

    if (!result.ok) throw soapError(result);

    let nf: Awaited<ReturnType<ImperiumSyncService["informarNotas"]>> | null = null;
    try {
      nf = await this.informarNotas(docNums);
    } catch (err) {
      this.log.warn({ err }, "informarNotaFiscal após enviarPedidos falhou");
    }

    return {
      ok: true,
      codCarga: carga.codCarga,
      pedidos: carga.pedidos.map((p) => p.codPedido),
      durationMs: result.durationMs,
      nf,
    };
  }

  async informarNotas(docNums: number[]) {
    await this.init();
    const cfg = loadImperiumConfig();
    const invoices = await this.loadInvoices(docNums);
    if (invoices.length === 0) {
      return { ok: true, sent: 0, skipped: "Nenhuma NF local com chave/número para esses pedidos" };
    }
    const mapped = mapNotasSaida(invoices).filter((n) => n.numeroNf > 0);
    if (mapped.length === 0) {
      return { ok: true, sent: 0, skipped: "NF sem número/chave" };
    }
    if (!cfg.cnpjEmitente) {
      return { ok: false, sent: 0, skipped: "IMPERIUM_CNPJ_EMITENTE não configurado" };
    }

    const xml = buildInformarNotaFiscalXml(mapped);
    const result = await callImperiumSoap("expedicao", "informarNotaFiscal", xml);
    await recordOutbox(this.db, {
      entityType: "nf_saida",
      entityId: mapped.map((n) => n.numeroNf).join(","),
      method: "informarNotaFiscal",
      payloadXml: xml,
      result,
      idempotencyKey: `informarNF:${mapped.map((n) => n.numeroNf).join(",")}`,
    });
    if (!result.ok) throw soapError(result);
    return { ok: true, sent: mapped.length };
  }

  async cancelarPedido(docNum: number) {
    await this.init();
    const xml = buildCancelarPedidoXml(String(docNum));
    const result = await callImperiumSoap("expedicao", "cancelarPedido", xml);
    await recordOutbox(this.db, {
      entityType: "pedido",
      entityId: String(docNum),
      method: "cancelarPedido",
      payloadXml: xml,
      result,
      idempotencyKey: `cancelarPedido:${docNum}:${Date.now()}`,
    });
    if (!result.ok) throw soapError(result);
    return { ok: true, docNum };
  }

  async cancelarNotaFiscal(opts: { numeroNf: number; serieNf?: string; cnpjEmitente?: string }) {
    await this.init();
    const cfg = loadImperiumConfig();
    const cnpj = opts.cnpjEmitente || cfg.cnpjEmitente;
    if (!cnpj) throw new Error("CNPJ emitente obrigatório");
    const xml = buildCancelarNotaFiscalXml(cnpj, opts.numeroNf, opts.serieNf ?? "1");
    const result = await callImperiumSoap("expedicao", "cancelarNotaFiscal", xml);
    await recordOutbox(this.db, {
      entityType: "nf_saida",
      entityId: String(opts.numeroNf),
      method: "cancelarNotaFiscal",
      payloadXml: xml,
      result,
    });
    if (!result.ok) throw soapError(result);
    return { ok: true };
  }

  async pollCargas() {
    await this.init();
    const pending = await this.db.query<{ cod_carga: string }>(
      `SELECT cod_carga FROM imperium_cargas
        WHERE COALESCE(situacao, '') NOT IN ('FINALIZADO', 'CANCELADO', 'ERRO')
        ORDER BY updated_at ASC
        LIMIT 30`,
    );

    const updated: Array<{ codCarga: string; situacao: string | null; liberado: boolean | null }> = [];
    for (const row of pending.rows) {
      const status = await this.refreshCarga(row.cod_carga);
      updated.push(status);
    }
    return { ok: true, polled: updated.length, items: updated };
  }

  async refreshCarga(codCarga: string) {
    await this.init();
    const statusXml = buildChecarStatusXml(codCarga);
    const statusRes = await callImperiumSoap("expedicao", "checarStatus", statusXml);
    const cargaXml = buildConsultarCargaXml(codCarga);
    const cargaRes = await callImperiumSoap("expedicao", "consultarCarga", cargaXml);

    const situacao = extractTag(cargaRes.bodyXml, "situacao");
    const liberadoRaw = extractTag(statusRes.bodyXml, "liberado") ?? extractTag(statusRes.bodyXml, "return");
    const liberado = /true/i.test(liberadoRaw ?? "");

    await this.db.query(
      `UPDATE imperium_cargas
          SET situacao = COALESCE($2, situacao),
              liberado = $3,
              last_polled_at = NOW(),
              last_error = $4,
              updated_at = NOW()
        WHERE cod_carga = $1`,
      [
        codCarga,
        situacao,
        statusRes.ok ? liberado : null,
        cargaRes.ok ? null : cargaRes.fault ?? `HTTP ${cargaRes.statusCode}`,
      ],
    );

    return { codCarga, situacao, liberado: statusRes.ok ? liberado : null };
  }

  async consultarPedido(docNum: string) {
    const xml = buildConsultarPedidoXml(docNum);
    const result = await callImperiumSoap("expedicao", "consultarPedido", xml);
    return {
      ok: result.ok,
      fault: result.fault,
      situacao: extractTag(result.bodyXml, "situacao"),
      conferido: extractTag(result.bodyXml, "conferido"),
      bodyPreview: result.bodyXml.slice(0, 4000),
    };
  }

  async listLocalCargas(limit = 50) {
    await this.init();
    const res = await this.db.query(
      `SELECT cod_carga, doc_nums, placa, situacao, liberado, last_polled_at, last_error, created_at, updated_at
         FROM imperium_cargas
        ORDER BY updated_at DESC
        LIMIT $1`,
      [limit],
    );
    return res.rows;
  }

  async listOutbox(limit = 30) {
    await this.init();
    const res = await this.db.query(
      `SELECT id, entity_type, entity_id, method, status, attempts, error_message, created_at, updated_at
         FROM imperium_outbox
        ORDER BY id DESC
        LIMIT $1`,
      [limit],
    );
    return res.rows;
  }

  private async listLocalCatalog(limit: number) {
    const fromB2b = await this.db.query<{ sap_item_code: string; name: string }>(
      `SELECT sap_item_code, COALESCE(gsn_product_name, sap_item_name, sap_item_code) AS name
         FROM b2b_catalog_products
        WHERE sap_item_code IS NOT NULL AND sap_item_code <> ''
        ORDER BY sap_item_code
        LIMIT $1`,
      [limit],
    ).catch(() => ({ rows: [] as Array<{ sap_item_code: string; name: string }> }));

    if (fromB2b.rows.length > 0) {
      return fromB2b.rows.map((r) => ({ ItemCode: r.sap_item_code, ItemName: r.name }));
    }

    const fromLines = await this.db.query<{ item_code: string; item_description: string }>(
      `SELECT DISTINCT item_code, MAX(item_description) AS item_description
         FROM sap_sales_order_lines
        WHERE item_code IS NOT NULL AND item_code <> ''
        GROUP BY item_code
        ORDER BY item_code
        LIMIT $1`,
      [limit],
    );
    return fromLines.rows.map((r) => ({ ItemCode: r.item_code, ItemName: r.item_description }));
  }

  private async loadOrders(docNums: number[]) {
    const headers = await this.db.query<{
      doc_entry: number;
      doc_num: number;
      card_code: string | null;
      card_name: string | null;
      comments: string | null;
      address: string | null;
      address2: string | null;
      raw_json: Record<string, unknown> | null;
    }>(
      `SELECT doc_entry, doc_num, card_code, card_name, comments,
              raw_json->>'Address' AS address,
              raw_json->>'Address2' AS address2,
              raw_json
         FROM sap_sales_orders
        WHERE doc_num = ANY($1::int[])`,
      [docNums],
    );

    const out = [];
    for (const header of headers.rows) {
      const lines = await this.db.query<{
        item_code: string | null;
        item_description: string | null;
        quantity: string | number | null;
        line_total: string | number | null;
      }>(
        `SELECT item_code, item_description, quantity, line_total
           FROM sap_sales_order_lines
          WHERE doc_entry = $1
          ORDER BY line_num`,
        [header.doc_entry],
      );
      out.push({ header, lines: lines.rows });
    }
    return out;
  }

  private async loadInvoices(docNums: number[]) {
    const res = await this.db.query<{
      nfe_number: string | null;
      folio_number: string | null;
      nfe_key: string | null;
      series_number: string | number | null;
      doc_total: string | number | null;
      base_doc_num: number | null;
      doc_entry: number;
    }>(
      `SELECT nfe_number, folio_number, nfe_key, series_number, doc_total,
              COALESCE(base_doc_num, (SELECT so.doc_num FROM sap_sales_orders so WHERE so.doc_entry = sap_invoices.base_doc_entry)) AS base_doc_num,
              doc_entry
         FROM sap_invoices
        WHERE COALESCE(base_doc_num, (SELECT so.doc_num FROM sap_sales_orders so WHERE so.doc_entry = sap_invoices.base_doc_entry)) = ANY($1::int[])
          AND cancelled = 'N'`,
      [docNums],
    );

    const invoices = [];
    for (const inv of res.rows) {
      const lines = await this.db.query<{
        item_code: string | null;
        quantity: string | number | null;
        line_total: string | number | null;
      }>(
        `SELECT item_code, quantity, line_total FROM sap_invoice_lines WHERE doc_entry = $1`,
        [inv.doc_entry],
      );
      invoices.push({ ...inv, lines: lines.rows });
    }
    return invoices;
  }

  private async loadPartners(cardCodes: string[]): Promise<Record<string, SapPartner | null>> {
    const unique = [...new Set(cardCodes)];
    const map: Record<string, SapPartner | null> = {};
    if (unique.length === 0) return map;

    const logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: (msg: string) => this.log.warn({}, msg),
      error: (msg: string) => this.log.error({}, msg),
    };

    try {
      const client = sapConfigStore.getClient(logger) ?? createSapClient(logger);
      for (const code of unique.slice(0, 20)) {
        try {
          const res = await client.get<SapPartner>(
            `/BusinessPartners('${encodeURIComponent(code)}')?$select=CardCode,CardName,FederalTaxID,Address,City,State,ZipCode,CardType,BPAddresses`,
            { correlationId: `imperium-bp-${code}` },
          );
          map[code] = res.data ?? null;
        } catch {
          map[code] = null;
        }
      }
    } catch {
      for (const code of unique) map[code] = null;
    }
    return map;
  }
}
