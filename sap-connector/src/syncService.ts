/**
 * SyncService — Sincronização Bidirecional SAP B1 ↔ WMS
 *
 * Responsável por:
 *   1. SAP → WMS: Polling de pedidos abertos e importação para o WMS
 *   2. WMS → SAP: Write-back de status UDF quando o pedido muda no WMS
 *
 * Arquitetura:
 *   - Cursor persistente (último DocEntry sincronizado) para evitar reprocessamento
 *   - Idempotência: pedidos já importados são ignorados (por sap_doc_entry)
 *   - Retry/backoff automático via SapServiceLayerClient
 *   - Correlation ID em cada ciclo para rastreamento
 */

import { v4 as uuidv4 } from "uuid";
import type { ISapClient } from "../sapClientFactory.js";
import type {
  SapOrder,
  SapOrderStatusUpdate,
  WmsUdfStatus,
} from "./sapTypes.js";

// ============================================================================
// Tipos
// ============================================================================

export interface SyncLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug?(msg: string, meta?: Record<string, unknown>): void;
}

/** Registro de um pedido importado do SAP para o WMS */
export interface ImportedOrder {
  wmsOrderId: string;
  sapDocEntry: number;
  sapDocNum: number;
  cardCode: string;
  cardName?: string;
  docTotal?: number;
  currency?: string;
  itemCount: number;
  importedAt: string;
}

/** Resultado de um ciclo de sync SAP → WMS */
export interface SyncResult {
  correlationId: string;
  timestamp: string;
  ordersPolled: number;
  ordersImported: number;
  ordersSkipped: number;
  ordersFailed: number;
  lastDocEntry: number | null;
  errors: Array<{ docEntry: number; error: string }>;
  durationMs: number;
}

/** Resultado de um write-back WMS → SAP */
export interface WriteBackResult {
  correlationId: string;
  docEntry: number;
  success: boolean;
  status?: WmsUdfStatus | string;
  error?: string;
}

/** Cursor de sincronização persistente */
export interface SyncCursor {
  lastDocEntry: number;
  lastSyncAt: string;
  totalImported: number;
}

/** Callback para processar cada pedido importado */
export type OnOrderImported = (order: ImportedOrder, sapOrder: SapOrder) => Promise<void>;

/** Callback para verificar se um pedido já foi importado */
export type IsOrderAlreadyImported = (sapDocEntry: number) => Promise<boolean>;

/** Callback para salvar cursor */
export type SaveCursor = (cursor: SyncCursor) => Promise<void>;

/** Callback para carregar cursor */
export type LoadCursor = () => Promise<SyncCursor | null>;

// ============================================================================
// Config
// ============================================================================

export interface SyncServiceConfig {
  /** Cliente SAP (real ou mock) */
  sapClient: ISapClient;

  /** Logger */
  logger: SyncLogger;

  /** Callback invocado para cada pedido importado com sucesso */
  onOrderImported: OnOrderImported;

  /** Verifica se um pedido SAP já existe no WMS (por DocEntry) */
  isOrderAlreadyImported: IsOrderAlreadyImported;

  /** Persistir cursor de sync */
  saveCursor?: SaveCursor;

  /** Carregar cursor de sync */
  loadCursor?: LoadCursor;

  /** Máximo de pedidos por ciclo de polling */
  batchSize?: number;

  /** Filtrar apenas pedidos abertos? (default: true) */
  onlyOpenOrders?: boolean;

  /** ID único da instância (para logs) */
  instanceId?: string;
}

// ============================================================================
// SyncService
// ============================================================================

export class SyncService {
  private readonly sap: ISapClient;
  private readonly logger: SyncLogger;
  private readonly onOrderImported: OnOrderImported;
  private readonly isOrderAlreadyImported: IsOrderAlreadyImported;
  private readonly saveCursor?: SaveCursor;
  private readonly loadCursor?: LoadCursor;
  private readonly batchSize: number;
  private readonly onlyOpenOrders: boolean;
  private readonly instanceId: string;

  /** Cursor em memória (fallback se não houver persistência) */
  private cursor: SyncCursor = {
    lastDocEntry: 0,
    lastSyncAt: new Date(0).toISOString(),
    totalImported: 0,
  };

  /** Estatísticas acumuladas */
  private stats = {
    totalCycles: 0,
    totalImported: 0,
    totalSkipped: 0,
    totalFailed: 0,
    totalWriteBacks: 0,
    lastCycleAt: null as string | null,
  };

  constructor(config: SyncServiceConfig) {
    this.sap = config.sapClient;
    this.logger = config.logger;
    this.onOrderImported = config.onOrderImported;
    this.isOrderAlreadyImported = config.isOrderAlreadyImported;
    this.saveCursor = config.saveCursor;
    this.loadCursor = config.loadCursor;
    this.batchSize = config.batchSize ?? 50;
    this.onlyOpenOrders = config.onlyOpenOrders ?? true;
    this.instanceId = config.instanceId ?? "sync-1";
  }

  // ────────────────────────────────────────────────────────────────────────
  // SAP → WMS: Polling de pedidos
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Executa um ciclo de sincronização SAP → WMS.
   * Busca pedidos no SAP mais recentes que o cursor,
   * importa os novos no WMS, e atualiza o cursor.
   */
  async pollOrders(): Promise<SyncResult> {
    const correlationId = `sync-${this.instanceId}-${uuidv4().slice(0, 8)}`;
    const start = Date.now();

    // Carregar cursor persistido
    await this.restoreCursor();

    this.logger.info("Iniciando ciclo de sync SAP → WMS", {
      correlationId,
      lastDocEntry: this.cursor.lastDocEntry,
      batchSize: this.batchSize,
    });

    const result: SyncResult = {
      correlationId,
      timestamp: new Date().toISOString(),
      ordersPolled: 0,
      ordersImported: 0,
      ordersSkipped: 0,
      ordersFailed: 0,
      lastDocEntry: this.cursor.lastDocEntry,
      errors: [],
      durationMs: 0,
    };

    try {
      // Buscar pedidos do SAP
      const sapOrders = await this.fetchNewOrders();
      result.ordersPolled = sapOrders.length;

      if (sapOrders.length === 0) {
        this.logger.debug?.("Nenhum pedido novo no SAP", { correlationId });
        result.durationMs = Date.now() - start;
        return result;
      }

      this.logger.info(`${sapOrders.length} pedido(s) encontrado(s) no SAP`, { correlationId });

      // Processar cada pedido
      for (const sapOrder of sapOrders) {
        try {
          const imported = await this.processOrder(sapOrder, correlationId);
          if (imported) {
            result.ordersImported++;
          } else {
            result.ordersSkipped++;
          }

          // Atualizar cursor (maior DocEntry processado)
          if (sapOrder.DocEntry > this.cursor.lastDocEntry) {
            this.cursor.lastDocEntry = sapOrder.DocEntry;
          }
        } catch (err) {
          result.ordersFailed++;
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push({ docEntry: sapOrder.DocEntry, error: msg });
          this.logger.error(`Falha ao processar pedido ${sapOrder.DocEntry}`, {
            correlationId,
            docEntry: sapOrder.DocEntry,
            error: msg,
          });
        }
      }

      // Persistir cursor
      this.cursor.lastSyncAt = new Date().toISOString();
      this.cursor.totalImported += result.ordersImported;
      await this.persistCursor();

      // Atualizar estatísticas
      this.stats.totalCycles++;
      this.stats.totalImported += result.ordersImported;
      this.stats.totalSkipped += result.ordersSkipped;
      this.stats.totalFailed += result.ordersFailed;
      this.stats.lastCycleAt = new Date().toISOString();

      result.lastDocEntry = this.cursor.lastDocEntry;
      result.durationMs = Date.now() - start;

      this.logger.info("Ciclo de sync concluído", {
        correlationId,
        imported: result.ordersImported,
        skipped: result.ordersSkipped,
        failed: result.ordersFailed,
        durationMs: result.durationMs,
      });

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error("Erro fatal no ciclo de sync", { correlationId, error: msg });
      result.durationMs = Date.now() - start;
      throw err;
    }
  }

  /**
   * Busca pedidos do SAP que são mais recentes que o cursor atual.
   */
  private async fetchNewOrders(): Promise<SapOrder[]> {
    const response = await this.sap.getOrders({
      status: this.onlyOpenOrders ? "open" : "all",
      limit: this.batchSize,
    });

    const orders = response.value ?? [];

    // Filtra pedidos mais recentes que o cursor
    // (a query já vem ordenada por DocEntry desc, mas filtramos por segurança)
    return orders.filter((o) => o.DocEntry > this.cursor.lastDocEntry);
  }

  /**
   * Processa um pedido SAP individual.
   * Retorna true se importou, false se já existia (skip).
   */
  private async processOrder(sapOrder: SapOrder, correlationId: string): Promise<boolean> {
    // Verificar se já importado (idempotência)
    const alreadyImported = await this.isOrderAlreadyImported(sapOrder.DocEntry);
    if (alreadyImported) {
      this.logger.debug?.(`Pedido ${sapOrder.DocEntry} já importado, pulando`, {
        correlationId,
        docEntry: sapOrder.DocEntry,
      });
      return false;
    }

    // Gerar ID WMS
    const wmsOrderId = uuidv4();

    // Criar registro de importação
    const imported: ImportedOrder = {
      wmsOrderId,
      sapDocEntry: sapOrder.DocEntry,
      sapDocNum: sapOrder.DocNum,
      cardCode: sapOrder.CardCode,
      cardName: sapOrder.CardName,
      docTotal: sapOrder.DocTotal,
      currency: sapOrder.DocCurrency,
      itemCount: sapOrder.DocumentLines?.length ?? 0,
      importedAt: new Date().toISOString(),
    };

    // Invocar callback de importação
    await this.onOrderImported(imported, sapOrder);

    // Write-back: marcar no SAP que o pedido foi importado pelo WMS
    try {
      await this.writeBackStatus(sapOrder.DocEntry, {
        U_WMS_STATUS: "IMPORTADO",
        U_WMS_ORDERID: wmsOrderId,
        U_WMS_LAST_EVENT: "IMPORTAR",
        U_WMS_LAST_TS: new Date().toISOString(),
        U_WMS_CORR_ID: correlationId,
      });
    } catch (err) {
      // Write-back é best-effort; não falha a importação
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Write-back falhou para DocEntry ${sapOrder.DocEntry}`, {
        correlationId,
        error: msg,
      });
    }

    this.logger.info(`Pedido importado: SAP ${sapOrder.DocEntry} → WMS ${wmsOrderId}`, {
      correlationId,
      docEntry: sapOrder.DocEntry,
      docNum: sapOrder.DocNum,
      cardCode: sapOrder.CardCode,
      itemCount: imported.itemCount,
    });

    return true;
  }

  // ────────────────────────────────────────────────────────────────────────
  // WMS → SAP: Write-back de status UDF
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Atualiza os UDFs de um pedido no SAP com o status do WMS.
   */
  async writeBackStatus(
    docEntry: number,
    update: SapOrderStatusUpdate,
  ): Promise<WriteBackResult> {
    const correlationId = update.U_WMS_CORR_ID ?? `wb-${uuidv4().slice(0, 8)}`;

    try {
      await this.sap.updateOrderStatus(docEntry, {
        ...update,
        U_WMS_LAST_TS: update.U_WMS_LAST_TS ?? new Date().toISOString(),
        U_WMS_CORR_ID: correlationId,
      });

      this.stats.totalWriteBacks++;

      this.logger.info(`Write-back OK: DocEntry ${docEntry} → ${update.U_WMS_STATUS}`, {
        correlationId,
        docEntry,
        status: update.U_WMS_STATUS,
      });

      return {
        correlationId,
        docEntry,
        success: true,
        status: update.U_WMS_STATUS,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Write-back FALHOU: DocEntry ${docEntry}`, {
        correlationId,
        docEntry,
        error: msg,
      });
      return {
        correlationId,
        docEntry,
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Atalho: atualiza status WMS com todos os campos UDF de uma vez.
   */
  async updateWmsStatus(input: {
    docEntry: number;
    wmsOrderId: string;
    status: WmsUdfStatus | string;
    event: string;
    correlationId?: string;
  }): Promise<WriteBackResult> {
    return this.writeBackStatus(input.docEntry, {
      U_WMS_STATUS: input.status as WmsUdfStatus,
      U_WMS_ORDERID: input.wmsOrderId,
      U_WMS_LAST_EVENT: input.event,
      U_WMS_LAST_TS: new Date().toISOString(),
      U_WMS_CORR_ID: input.correlationId,
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Cursor
  // ────────────────────────────────────────────────────────────────────────

  private async restoreCursor(): Promise<void> {
    if (!this.loadCursor) return;
    try {
      const saved = await this.loadCursor();
      if (saved) {
        this.cursor = saved;
        this.logger.debug?.("Cursor restaurado", { cursor: this.cursor });
      }
    } catch (err) {
      this.logger.warn("Falha ao restaurar cursor", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async persistCursor(): Promise<void> {
    if (!this.saveCursor) return;
    try {
      await this.saveCursor(this.cursor);
    } catch (err) {
      this.logger.warn("Falha ao persistir cursor", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Getters
  // ────────────────────────────────────────────────────────────────────────

  getCursor(): SyncCursor {
    return { ...this.cursor };
  }

  getStats() {
    return { ...this.stats };
  }

  /** Reset do cursor (para re-sincronização total) */
  async resetCursor(): Promise<void> {
    this.cursor = { lastDocEntry: 0, lastSyncAt: new Date(0).toISOString(), totalImported: 0 };
    await this.persistCursor();
    this.logger.info("Cursor resetado");
  }
}
