/**
 * SyncScheduler — Gerencia o loop de polling SAP → WMS
 *
 * Funcionalidades:
 *   - Polling periódico configurável (intervalo em segundos)
 *   - Backoff adaptativo: aumenta intervalo em caso de erros consecutivos
 *   - Graceful shutdown: para o loop limpamente
 *   - Métricas de execução para monitoramento
 */

import type { SyncService, SyncResult, SyncLogger } from "./syncService.js";

// ============================================================================
// Tipos
// ============================================================================

export interface SyncSchedulerConfig {
  /** Instância do SyncService */
  syncService: SyncService;

  /** Logger */
  logger: SyncLogger;

  /** Intervalo base entre ciclos de polling (segundos). Default: 30 */
  intervalSeconds?: number;

  /** Intervalo máximo em caso de backoff (segundos). Default: 300 */
  maxIntervalSeconds?: number;

  /** Quantos erros consecutivos para ativar backoff. Default: 3 */
  backoffThreshold?: number;

  /** Multiplicador de backoff. Default: 2 */
  backoffMultiplier?: number;

  /** Executar sync imediatamente ao iniciar? Default: true */
  runImmediately?: boolean;
}

export interface SchedulerStatus {
  running: boolean;
  currentIntervalSeconds: number;
  consecutiveErrors: number;
  totalCycles: number;
  lastResult: SyncResult | null;
  startedAt: string | null;
}

// ============================================================================
// SyncScheduler
// ============================================================================

export class SyncScheduler {
  private readonly syncService: SyncService;
  private readonly logger: SyncLogger;

  private readonly baseInterval: number;
  private readonly maxInterval: number;
  private readonly backoffThreshold: number;
  private readonly backoffMultiplier: number;
  private readonly runImmediately: boolean;

  private running = false;
  private abortController: AbortController | null = null;
  private currentInterval: number;
  private consecutiveErrors = 0;
  private totalCycles = 0;
  private lastResult: SyncResult | null = null;
  private startedAt: string | null = null;

  constructor(config: SyncSchedulerConfig) {
    this.syncService = config.syncService;
    this.logger = config.logger;
    this.baseInterval = (config.intervalSeconds ?? 30) * 1000;
    this.maxInterval = (config.maxIntervalSeconds ?? 300) * 1000;
    this.backoffThreshold = config.backoffThreshold ?? 3;
    this.backoffMultiplier = config.backoffMultiplier ?? 2;
    this.runImmediately = config.runImmediately ?? true;
    this.currentInterval = this.baseInterval;
  }

  /**
   * Inicia o loop de polling.
   * Retorna uma Promise que resolve quando o scheduler é parado.
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn("Scheduler já está rodando");
      return;
    }

    this.running = true;
    this.startedAt = new Date().toISOString();
    this.abortController = new AbortController();

    this.logger.info("Scheduler iniciado", {
      intervalSeconds: this.baseInterval / 1000,
      maxIntervalSeconds: this.maxInterval / 1000,
    });

    // Execução imediata se configurado
    if (this.runImmediately) {
      await this.executeCycle();
    }

    // Loop principal
    while (this.running) {
      try {
        await this.sleep(this.currentInterval);
      } catch {
        // Abort signal disparado — sair
        break;
      }

      if (!this.running) break;
      await this.executeCycle();
    }

    this.logger.info("Scheduler parado", {
      totalCycles: this.totalCycles,
      lastResult: this.lastResult?.correlationId,
    });
  }

  /**
   * Para o scheduler de forma graciosa.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    this.abortController?.abort();
    this.logger.info("Scheduler recebeu sinal de parada");
  }

  /**
   * Executa um único ciclo de sync e gerencia backoff.
   */
  private async executeCycle(): Promise<void> {
    this.totalCycles++;

    try {
      const result = await this.syncService.pollOrders();
      this.lastResult = result;

      // Reset backoff em caso de sucesso
      if (this.consecutiveErrors > 0) {
        this.logger.info("Recuperado de erros consecutivos", {
          previousErrors: this.consecutiveErrors,
        });
      }
      this.consecutiveErrors = 0;
      this.currentInterval = this.baseInterval;

    } catch (err) {
      this.consecutiveErrors++;
      const msg = err instanceof Error ? err.message : String(err);

      this.logger.error(`Ciclo #${this.totalCycles} falhou (erro #${this.consecutiveErrors})`, {
        error: msg,
        consecutiveErrors: this.consecutiveErrors,
      });

      // Aplicar backoff se muitos erros consecutivos
      if (this.consecutiveErrors >= this.backoffThreshold) {
        const newInterval = Math.min(
          this.currentInterval * this.backoffMultiplier,
          this.maxInterval,
        );

        if (newInterval !== this.currentInterval) {
          this.currentInterval = newInterval;
          this.logger.warn("Backoff ativado", {
            newIntervalSeconds: this.currentInterval / 1000,
            consecutiveErrors: this.consecutiveErrors,
          });
        }
      }
    }
  }

  /**
   * Sleep cancelável via AbortController.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);

      this.abortController?.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      }, { once: true });
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Getters
  // ────────────────────────────────────────────────────────────────────────

  getStatus(): SchedulerStatus {
    return {
      running: this.running,
      currentIntervalSeconds: this.currentInterval / 1000,
      consecutiveErrors: this.consecutiveErrors,
      totalCycles: this.totalCycles,
      lastResult: this.lastResult,
      startedAt: this.startedAt,
    };
  }

  isRunning(): boolean {
    return this.running;
  }
}
