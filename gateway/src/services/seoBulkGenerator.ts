// Geração de SEO em MASSA para o catálogo B2B.
//
// Roda como um job assíncrono EM MEMÓRIA (singleton por processo): um endpoint
// dispara o job e retorna imediatamente; outro consulta o progresso. Para cada
// produto-alvo, chama a IA de SEO (seoAiService) e grava o resultado via o
// patch admin já existente (updateAdminProduct), que trava o conteúdo
// (content_locked = TRUE) para o sync diário não sobrescrever.
//
// Características: concorrência baixa (respeita rate limit da OpenAI), atraso
// entre chamadas, retentativa 1x em erro transitório, tratamento de erro POR
// ITEM (uma falha não aborta o job) e idempotência/retomada (pula quem já está
// travado e preenchido, salvo force).

import type { B2BCatalogService, CatalogProduct } from "./b2bCatalogService.js";
import { SeoAiNotConfiguredError, type SeoAiService, type ProductSeoInput } from "./seoAiService.js";

export type SeoBulkStatus = "idle" | "running" | "done" | "error" | "cancelled";

export interface SeoBulkError {
  sku: string;
  message: string;
}

export interface SeoBulkJobSnapshot {
  jobId: string | null;
  status: SeoBulkStatus;
  scope: "visible" | "all";
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startedAt: string | null;
  finishedAt: string | null;
  currentSku: string | null;
  errors: SeoBulkError[];
  lastUpdatedAt: string | null;
  error: string | null;
}

export interface SeoBulkOptions {
  scope?: "visible" | "all";
  onlyMissing?: boolean;
  force?: boolean;
}

const MAX_ERRORS = 50;
const CONCURRENCY = 2;
const DELAY_MS = 400;
const RETRY_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const nonEmpty = (v: string | null | undefined): boolean => !!v && v.trim().length > 0;

export class SeoBulkGenerator {
  private state: SeoBulkJobSnapshot = {
    jobId: null,
    status: "idle",
    scope: "visible",
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startedAt: null,
    finishedAt: null,
    currentSku: null,
    errors: [],
    lastUpdatedAt: null,
    error: null,
  };

  private cancelRequested = false;

  constructor(
    private readonly catalog: B2BCatalogService,
    private readonly ai: SeoAiService,
    private readonly buildInput: (p: CatalogProduct) => ProductSeoInput,
    private readonly author = "ia-bulk",
    private readonly logger?: { info: (...a: any[]) => void; error: (...a: any[]) => void },
  ) {}

  isRunning(): boolean {
    return this.state.status === "running";
  }

  getStatus(): SeoBulkJobSnapshot {
    return { ...this.state, errors: this.state.errors.slice(-MAX_ERRORS) };
  }

  /** Sinaliza cancelamento cooperativo. Retorna false se não há job rodando. */
  requestCancel(): boolean {
    if (this.state.status !== "running") return false;
    this.cancelRequested = true;
    return true;
  }

  /**
   * Inicia o job. Seleciona os alvos, define o total e devolve o snapshot
   * inicial IMEDIATAMENTE; o processamento continua em background. Lança
   * SeoAiNotConfiguredError se a IA não estiver configurada.
   */
  async start(opts: SeoBulkOptions = {}): Promise<SeoBulkJobSnapshot> {
    if (this.isRunning()) return this.getStatus();
    if (!this.ai.isConfigured()) throw new SeoAiNotConfiguredError();

    const scope = opts.scope ?? "visible";
    const products = await this.catalog.listProductsForBulkSeo(scope);

    this.cancelRequested = false;
    const now = new Date().toISOString();
    this.state = {
      jobId: `seo-bulk-${Date.now()}`,
      status: "running",
      scope,
      total: products.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      startedAt: now,
      finishedAt: null,
      currentSku: null,
      errors: [],
      lastUpdatedAt: now,
      error: null,
    };

    // Dispara em background (não aguardamos aqui).
    void this.run(products, opts).catch((err) => {
      this.state.status = "error";
      this.state.error = err instanceof Error ? err.message : String(err);
      this.state.finishedAt = new Date().toISOString();
      this.state.lastUpdatedAt = this.state.finishedAt;
      this.logger?.error({ error: this.state.error }, "Job de SEO em massa falhou");
    });

    return this.getStatus();
  }

  private touch(): void {
    this.state.lastUpdatedAt = new Date().toISOString();
  }

  /** Decide se um produto deve ser pulado (idempotência/retomada). */
  private shouldSkip(p: CatalogProduct, opts: SeoBulkOptions): boolean {
    if (opts.force) return false;
    const filled = nonEmpty(p.description_short) && nonEmpty(p.seo_description);
    if (opts.onlyMissing) return filled;
    // Default: retomável — pula quem já está travado E preenchido.
    return p.content_locked === true && filled;
  }

  private async run(products: CatalogProduct[], opts: SeoBulkOptions): Promise<void> {
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        if (this.cancelRequested) return;
        const index = cursor++;
        if (index >= products.length) return;
        const product = products[index];
        this.state.currentSku = product.sap_item_code;

        try {
          if (this.shouldSkip(product, opts)) {
            this.state.skipped++;
          } else {
            await this.processOne(product);
            this.state.succeeded++;
            // Pequeno atraso para respeitar rate limits da OpenAI.
            await sleep(DELAY_MS);
          }
        } catch (err) {
          this.state.failed++;
          const message = err instanceof Error ? err.message : String(err);
          this.state.errors.push({ sku: product.sap_item_code, message });
          if (this.state.errors.length > MAX_ERRORS) {
            this.state.errors = this.state.errors.slice(-MAX_ERRORS);
          }
          this.logger?.error(
            { sku: product.sap_item_code, error: message },
            "Falha ao gerar SEO do produto",
          );
        } finally {
          this.state.processed++;
          this.touch();
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, products.length || 1) }, () =>
      worker(),
    );
    await Promise.all(workers);

    this.state.currentSku = null;
    this.state.finishedAt = new Date().toISOString();
    this.state.status = this.cancelRequested ? "cancelled" : "done";
    this.touch();
    this.logger?.info(
      {
        jobId: this.state.jobId,
        total: this.state.total,
        succeeded: this.state.succeeded,
        failed: this.state.failed,
        skipped: this.state.skipped,
        status: this.state.status,
      },
      "Job de SEO em massa finalizado",
    );
  }

  /** Gera e aplica o SEO de um único produto. Retenta 1x em erro transitório. */
  private async processOne(product: CatalogProduct): Promise<void> {
    const input = this.buildInput(product);

    let suggestion;
    try {
      suggestion = await this.ai.suggestProductSeo(input);
    } catch (err) {
      // Erro de configuração é fatal (não adianta retentar) — propaga.
      if (err instanceof SeoAiNotConfiguredError) throw err;
      await sleep(RETRY_DELAY_MS);
      suggestion = await this.ai.suggestProductSeo(input);
    }

    const keywords = (suggestion.keywords ?? [])
      .map((k) => String(k).trim())
      .filter(Boolean)
      .join(", ");

    await this.catalog.updateAdminProduct(
      product.sap_item_code,
      {
        // description_short liga content_locked = TRUE automaticamente.
        description_short: suggestion.description_rich,
        seo_title: suggestion.seo_title,
        seo_description: suggestion.seo_description,
        seo_slug: suggestion.seo_slug,
        seo_keywords: keywords || null,
        seo_attributes: JSON.stringify(suggestion.attributes ?? []),
      },
      this.author,
    );
  }
}
