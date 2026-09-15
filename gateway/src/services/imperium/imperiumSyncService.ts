import type pg from "pg";
import { createSapClient } from "../../config/sap.js";
import { sapConfigStore } from "../../config/sapConfigStore.js";
import { loadImperiumConfig, maskUrl } from "./config.js";
import {
  buildBuscarNfXml,
  buildCancelarNotaFiscalXml,
  buildCancelarPedidoXml,
  buildChecarStatusXml,
  buildConsultaEstoqueGeralXml,
  buildConsultarCargaXml,
  buildConsultarEstoqueXml,
  buildConsultarMovimentacaoXml,
  buildConsultarPedidoXml,
  buildEmptyBody,
  buildEnviarPedidosXml,
  buildFabricanteSalvarXml,
  buildFornecedorSalvarXml,
  buildInformarNotaFiscalXml,
  buildListCargasXml,
  buildNotaFiscalSalvarJsonXml,
  buildProdutoClasseSalvarXml,
  buildProdutoSalvarXml,
} from "./builders.js";
import { formatBrDate, extractTag, parseEstoqueResponse, parseMovimentacaoResponse } from "./xml.js";
import { callImperiumSoap, ImperiumNotConfiguredError, probeImperiumWsdl } from "./soapClient.js";
import { mapCargaFromOrders, mapNotasSaida, mapProdutoCadastro, type SapPartner } from "./mappers.js";
import { ensureImperiumSchema } from "./schema.js";
import type { ImperiumFornecedor, ImperiumNotaEntrada, ImperiumSoapResult } from "./types.js";

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
    const estoqueWsdl = await probeImperiumWsdl("estoque");
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
      estoqueWsdl: {
        ok: estoqueWsdl.ok,
        message: estoqueWsdl.message,
        wmsLocal: /wms\.local/i.test(estoqueWsdl.message),
      },
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
    const xml = buildFabricanteSalvarXml(cfg.defaultFabricante, "Garrafaria Serra Negra");
    const result = await callImperiumSoap("fabricante", "salvar", xml);
    await recordOutbox(this.db, {
      entityType: "fabricante",
      entityId: cfg.defaultFabricante,
      method: "salvar",
      payloadXml: xml,
      result,
      idempotencyKey: `fabricante:${cfg.defaultFabricante}`,
    });
    if (!result.ok) throw soapError(result);
    return result;
  }

  async ensureClasses(classes: Array<{ idClasse: string; nome: string }>) {
    const cfg = loadImperiumConfig();
    const unique = new Map<string, string>();
    unique.set(cfg.defaultClasse, "GSN");
    for (const c of classes) {
      if (c.idClasse) unique.set(c.idClasse, c.nome.slice(0, 80) || `Grupo ${c.idClasse}`);
    }

    let saved = 0;
    for (const [idClasse, nome] of unique) {
      const xml = buildProdutoClasseSalvarXml(idClasse, nome);
      const result = await callImperiumSoap("produtoClasse", "salvar", xml);
      await recordOutbox(this.db, {
        entityType: "produtoClasse",
        entityId: idClasse,
        method: "salvar",
        payloadXml: xml,
        result,
        idempotencyKey: `produtoClasse:${idClasse}`,
      });
      if (!result.ok) throw soapError(result);
      saved += 1;
    }
    return saved;
  }

  async syncProducts(opts: { limit?: number } = {}) {
    await this.init();
    await this.ensureDefaultFabricante();

    const items = await this.listLocalCatalog(opts.limit ?? 5000);
    await this.ensureClasses(
      items
        .filter((i) => i.sap_group_code != null)
        .map((i) => ({
          idClasse: String(i.sap_group_code),
          nome: i.category_name || `Grupo SAP ${i.sap_group_code}`,
        })),
    );
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

  async syncEstoque(opts: { ponteiro?: string; skus?: string[] } = {}) {
    await this.init();
    const cfg = loadImperiumConfig();
    const grade = cfg.defaultGrade;

    let snapshotXml = buildConsultaEstoqueGeralXml();
    let snapshotRes = await callImperiumSoap("estoque", "consultaEstoqueGeral", snapshotXml);
    let positions = snapshotRes.ok ? parseEstoqueResponse(snapshotRes.bodyXml) : [];

    if (!snapshotRes.ok || positions.length === 0) {
      snapshotXml = buildEmptyBody();
      snapshotRes = await callImperiumSoap("produto", "listar", snapshotXml);
      await recordOutbox(this.db, {
        entityType: "estoque",
        entityId: "produto.listar",
        method: "listar",
        payloadXml: snapshotXml,
        result: snapshotRes,
        idempotencyKey: `produto.listar:${new Date().toISOString().slice(0, 10)}`,
      });
      if (snapshotRes.ok) {
        positions = parseEstoqueResponse(snapshotRes.bodyXml);
      }
    } else {
      await recordOutbox(this.db, {
        entityType: "estoque",
        entityId: "geral",
        method: "consultaEstoqueGeral",
        payloadXml: snapshotXml,
        result: snapshotRes,
        idempotencyKey: `consultaEstoqueGeral:${new Date().toISOString().slice(0, 10)}`,
      });
    }

    if (positions.length === 0) {
      const skus = opts.skus?.length
        ? opts.skus
        : (await this.listLocalCatalog(5000)).map((i) => i.sap_item_code).filter(Boolean);
      const batchSize = 80;
      for (let i = 0; i < skus.length; i += batchSize) {
        const batch = skus.slice(i, i + batchSize).map((codProduto) => ({ codProduto, grade }));
        snapshotXml = buildConsultarEstoqueXml(batch);
        snapshotRes = await callImperiumSoap("estoque", "consultarEstoque", snapshotXml);
        if (!snapshotRes.ok) {
          await recordOutbox(this.db, {
            entityType: "estoque",
            entityId: `consultarEstoque:${i}`,
            method: "consultarEstoque",
            payloadXml: snapshotXml,
            result: snapshotRes,
            idempotencyKey: `consultarEstoque:${i}:${Date.now()}`,
          });
          throw soapError(snapshotRes);
        }
        positions.push(...parseEstoqueResponse(snapshotRes.bodyXml));
      }
    }

    for (const pos of positions) {
      await this.db.query(
        `INSERT INTO imperium_stock
           (cod_produto, grade, area_armazenagem, estoque_armazenado, estoque_disponivel, synced_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (cod_produto, grade, area_armazenagem)
         DO UPDATE SET
           estoque_armazenado = EXCLUDED.estoque_armazenado,
           estoque_disponivel = EXCLUDED.estoque_disponivel,
           synced_at = NOW()`,
        [pos.codProduto, pos.grade, pos.areaArmazenagem, pos.estoqueArmazenado, pos.estoqueDisponivel],
      );
    }

    const savedPointer = await this.db.query<{ value: string | null }>(
      `SELECT value FROM imperium_sync_state WHERE key = 'estoque.ponteiro'`,
    );
    const ponteiro = opts.ponteiro ?? savedPointer.rows[0]?.value ?? "0";
    const movXml = buildConsultarMovimentacaoXml(ponteiro);
    const movRes = await callImperiumSoap("estoque", "consultarMovimentacao", movXml);
    await recordOutbox(this.db, {
      entityType: "estoque",
      entityId: ponteiro,
      method: "consultarMovimentacao",
      payloadXml: movXml,
      result: movRes,
      idempotencyKey: `consultarMovimentacao:${ponteiro}`,
    });
    const movements = movRes.ok ? parseMovimentacaoResponse(movRes.bodyXml) : [];
    let maxPointer = Number(ponteiro) || 0;
    for (const mov of movements) {
      await this.db.query(
        `INSERT INTO imperium_stock_movements
           (ponteiro, dth_movimentacao, cod_produto, grade, motivo, quantidade, tipo,
            id_area_origem, area_origem, id_area_destino, area_destino, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
         ON CONFLICT (ponteiro) DO UPDATE SET
           dth_movimentacao = EXCLUDED.dth_movimentacao,
           quantidade = EXCLUDED.quantidade,
           synced_at = NOW()`,
        [
          mov.ponteiro,
          mov.dthMovimentacao,
          mov.codProduto,
          mov.grade,
          mov.motivo,
          mov.quantidade,
          mov.tipo,
          mov.idAreaOrigem,
          mov.areaOrigem,
          mov.idAreaDestino,
          mov.areaDestino,
        ],
      );
      const n = Number(mov.ponteiro);
      if (Number.isFinite(n) && n > maxPointer) maxPointer = n;
    }

    await this.db.query(
      `INSERT INTO imperium_sync_state (key, value, updated_at)
       VALUES ('estoque.ponteiro', $1, NOW()),
              ('estoque.last_sync', $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [String(maxPointer), new Date().toISOString()],
    );

    const comSaldo = positions.filter((p) => p.estoqueDisponivel > 0 || p.estoqueArmazenado > 0).length;
    return {
      ok: true,
      positions: positions.length,
      comSaldo,
      movements: movements.length,
      ponteiro: String(maxPointer),
    };
  }

  async listEstoque(limit = 200) {
    await this.init();
    const res = await this.db.query(
      `SELECT cod_produto, grade, area_armazenagem, estoque_armazenado, estoque_disponivel, synced_at
         FROM imperium_stock
        ORDER BY estoque_disponivel DESC, cod_produto
        LIMIT $1`,
      [limit],
    );
    return res.rows;
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

  async informarNotas(docNums: number[], docEntry?: number) {
    await this.init();
    const nums = [...new Set(docNums.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    let entries = docEntry && Number.isFinite(docEntry) && docEntry > 0 ? [docEntry] : [];

    if (nums.length === 0 && entries.length === 0) {
      return { ok: false, sent: 0, skipped: "Informe o número ou o DocEntry do pedido" };
    }

    if (entries.length === 0 && nums.length > 0) {
      const found = await this.db.query<{ doc_entry: number }>(
        `SELECT doc_entry FROM sap_sales_orders WHERE doc_num = ANY($1::int[])`,
        [nums],
      );
      entries = found.rows.map((r) => r.doc_entry);
    }

    if (nums.length === 0 && entries.length > 0) {
      const found = await this.db.query<{ doc_num: number }>(
        `SELECT doc_num FROM sap_sales_orders WHERE doc_entry = ANY($1::int[])`,
        [entries],
      );
      for (const row of found.rows) {
        if (Number.isFinite(row.doc_num)) nums.push(Number(row.doc_num));
      }
    }

    for (const entry of entries) {
      try {
        const { syncInvoicesForSalesOrder } = await import("../../scheduler/dailySync.js");
        await syncInvoicesForSalesOrder(entry);
      } catch (err) {
        this.log.warn({ err, entry }, "refresh NF SAP antes de informarNotaFiscal falhou");
      }
    }

    const invoices = await this.loadInvoices(nums, entries);
    if (invoices.length === 0) {
      return {
        ok: false,
        sent: 0,
        skipped: "Nenhuma NF de saída encontrada no SAP para este pedido",
      };
    }
    const mapped = mapNotasSaida(invoices);
    if (mapped.length === 0) {
      return { ok: false, sent: 0, skipped: "NF sem número, chave ou CNPJ emitente" };
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
    return {
      ok: true,
      sent: mapped.length,
      numeroNf: mapped[0]?.numeroNf,
      pedidos: mapped.map((n) => n.codPedido),
    };
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

  async saveFornecedor(input: ImperiumFornecedor) {
    await this.init();
    const xml = buildFornecedorSalvarXml(input);
    const result = await callImperiumSoap("fornecedor", "salvar", xml);
    await recordOutbox(this.db, {
      entityType: "fornecedor",
      entityId: input.idFornecedor,
      method: "salvar",
      payloadXml: xml,
      result,
      idempotencyKey: `fornecedor:${input.idFornecedor}`,
    });
    if (!result.ok) throw soapError(result);
    return { ok: true, idFornecedor: input.idFornecedor };
  }

  async saveNotaEntrada(input: ImperiumNotaEntrada) {
    await this.init();
    const xml = buildNotaFiscalSalvarJsonXml(input);
    const result = await callImperiumSoap("notaFiscal", "salvarJson", xml);
    await recordOutbox(this.db, {
      entityType: "nf_entrada",
      entityId: `${input.idFornecedor}:${input.numero}`,
      method: "salvarJson",
      payloadXml: xml,
      result,
      idempotencyKey: `nfEntrada:${input.idFornecedor}:${input.numero}:${input.serie}`,
    });
    if (!result.ok) throw soapError(result);
    return { ok: true, numero: input.numero, booleanReturn: result.booleanReturn };
  }

  async buscarNf(input: {
    idFornecedor: string;
    numero: string;
    serie: string;
    dataEmissao: string;
    tipoNota?: string;
  }) {
    const xml = buildBuscarNfXml(input);
    const result = await callImperiumSoap("notaFiscal", "buscarNf", xml);
    return {
      ok: result.ok,
      fault: result.fault,
      status: extractTag(result.bodyXml, "status"),
      dataEntrada: extractTag(result.bodyXml, "dataEntrada"),
      bodyPreview: result.bodyXml.slice(0, 4000),
    };
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
    type CatalogRow = {
      sap_item_code: string;
      sap_item_name: string | null;
      ean: string | null;
      unit_of_measure: string | null;
      packaging_type: string | null;
      units_per_package: string | number | null;
      sap_group_code: number | null;
      category_name: string | null;
    };

    const fromB2b = await this.db.query<CatalogRow>(
      `SELECT sap_item_code,
              COALESCE(gsn_product_name, sap_item_name, sap_item_code) AS sap_item_name,
              ean, unit_of_measure, packaging_type, units_per_package,
              sap_group_code, category_name
         FROM b2b_catalog_products
        WHERE sap_item_code IS NOT NULL AND sap_item_code <> ''
        ORDER BY sap_item_code
        LIMIT $1`,
      [limit],
    ).catch(() => ({ rows: [] as CatalogRow[] }));

    if (fromB2b.rows.length > 0) {
      return fromB2b.rows;
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
    return fromLines.rows.map((r) => ({
      sap_item_code: r.item_code,
      sap_item_name: r.item_description,
      ean: null,
      unit_of_measure: "UN",
      packaging_type: null,
      units_per_package: null,
      sap_group_code: null,
      category_name: null,
    }));
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

  private async loadInvoices(docNums: number[], docEntries: number[] = []) {
    const res = await this.db.query<{
      nfe_number: string | null;
      folio_number: string | null;
      nfe_key: string | null;
      series_number: string | number | null;
      doc_total: string | number | null;
      base_doc_num: number | null;
      doc_entry: number;
    }>(
      `SELECT i.nfe_number, i.folio_number, i.nfe_key, i.series_number, i.doc_total,
              COALESCE(i.base_doc_num, so.doc_num) AS base_doc_num,
              i.doc_entry
         FROM sap_invoices i
         LEFT JOIN sap_sales_orders so ON so.doc_entry = i.base_doc_entry
        WHERE i.cancelled = 'N'
          AND (
            (cardinality($1::int[]) > 0 AND COALESCE(i.base_doc_num, so.doc_num) = ANY($1::int[]))
            OR (cardinality($2::int[]) > 0 AND i.base_doc_entry = ANY($2::int[]))
            OR EXISTS (
              SELECT 1 FROM sap_invoice_lines l
               WHERE l.doc_entry = i.doc_entry
                 AND l.base_type = 17
                 AND cardinality($2::int[]) > 0
                 AND l.base_entry = ANY($2::int[])
            )
          )`,
      [docNums, docEntries],
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
