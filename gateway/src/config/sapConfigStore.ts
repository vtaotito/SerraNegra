import { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import type { Logger } from "../../../sap-connector/src/types.js";

interface StoredSapConfig {
  baseUrl: string;
  companyDb: string;
  username: string;
  password: string;
  timeoutMs?: number;
  maxAttempts?: number;
  savedAt: string;
}

/**
 * Store global para configuração SAP em memória.
 * Em produção, persistir em banco de dados ou arquivo criptografado.
 */
class SapConfigStore {
  private config: StoredSapConfig | null = null;
  private client: SapServiceLayerClient | null = null;

  /**
   * Salva configuração SAP
   */
  save(config: Omit<StoredSapConfig, "savedAt">): void {
    this.config = {
      ...config,
      savedAt: new Date().toISOString(),
    };
    // Invalidar cliente existente para forçar recriação
    this.client = null;
  }

  /**
   * Obtém configuração atual (sem senha)
   */
  get(): Omit<StoredSapConfig, "password"> | null {
    if (!this.config) return null;
    
    const { password, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Obtém cliente SAP (cria se necessário)
   */
  getClient(logger: Logger): SapServiceLayerClient | null {
    if (!this.config) return null;

    if (!this.client) {
      this.client = new SapServiceLayerClient({
        baseUrl: this.config.baseUrl,
        credentials: {
          companyDb: this.config.companyDb,
          username: this.config.username,
          password: this.config.password,
        },
        timeoutMs: this.config.timeoutMs || 60000,
        retry: {
          maxAttempts: this.config.maxAttempts || 3,
        },
        logger,
        correlationHeaderName: "X-Correlation-Id",
      });
    }

    return this.client;
  }

  /**
   * Verifica se há configuração salva
   */
  hasConfig(): boolean {
    return this.config !== null;
  }

  /**
   * Limpa configuração e cliente
   */
  clear(): void {
    this.config = null;
    this.client = null;
  }
}

// Singleton
export const sapConfigStore = new SapConfigStore();
