/**
 * Cache Service para dados SAP B1
 * 
 * Implementa cache em memória com TTL para reduzir chamadas ao SAP.
 * Usa node-cache internamente.
 */

import NodeCache from "node-cache";

export type CacheOptions = {
  stdTTL?: number; // TTL padrão em segundos
  checkperiod?: number; // Período de verificação de expiração em segundos
  useClones?: boolean; // Se deve clonar objetos (default: true para imutabilidade)
};

export class SapCache {
  private cache: NodeCache;
  private readonly name: string;

  constructor(name: string, options: CacheOptions = {}) {
    this.name = name;
    this.cache = new NodeCache({
      stdTTL: options.stdTTL ?? 300, // 5 minutos default
      checkperiod: options.checkperiod ?? 60,
      useClones: options.useClones ?? true
    });

    // Log cache statistics periodically (optional)
    this.cache.on("set", (key) => {
      console.log(`[Cache:${this.name}] SET: ${key}`);
    });

    this.cache.on("del", (key) => {
      console.log(`[Cache:${this.name}] DEL: ${key}`);
    });

    this.cache.on("expired", (key) => {
      console.log(`[Cache:${this.name}] EXPIRED: ${key}`);
    });
  }

  /**
   * Obtém valor do cache
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Define valor no cache com TTL opcional
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl ?? 0);
  }

  /**
   * Remove valor do cache
   */
  del(key: string | string[]): number {
    return this.cache.del(key);
  }

  /**
   * Limpa todo o cache
   */
  flush(): void {
    this.cache.flushAll();
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Verifica se chave existe no cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Obtém todas as chaves
   */
  keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Wrapper para operações com cache automático (get-or-fetch pattern)
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Tenta obter do cache
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      console.log(`[Cache:${this.name}] HIT: ${key}`);
      return cached;
    }

    // Cache miss - buscar dados
    console.log(`[Cache:${this.name}] MISS: ${key}`);
    const value = await fetchFn();
    
    // Armazenar no cache
    this.set(key, value, ttl);
    
    return value;
  }
}

/**
 * Factory para criar caches específicos por tipo de dado
 */
export class CacheFactory {
  private static caches = new Map<string, SapCache>();

  /**
   * Obtém cache para Orders (TTL curto)
   */
  static getOrdersCache(): SapCache {
    if (!this.caches.has("orders")) {
      this.caches.set(
        "orders",
        new SapCache("orders", { stdTTL: 60 }) // 1 minuto
      );
    }
    return this.caches.get("orders")!;
  }

  /**
   * Obtém cache para Items (TTL longo)
   */
  static getItemsCache(): SapCache {
    if (!this.caches.has("items")) {
      this.caches.set(
        "items",
        new SapCache("items", { stdTTL: 3600 }) // 1 hora
      );
    }
    return this.caches.get("items")!;
  }

  /**
   * Obtém cache para Inventory (TTL médio)
   */
  static getInventoryCache(): SapCache {
    if (!this.caches.has("inventory")) {
      this.caches.set(
        "inventory",
        new SapCache("inventory", { stdTTL: 300 }) // 5 minutos
      );
    }
    return this.caches.get("inventory")!;
  }

  /**
   * Obtém cache customizado
   */
  static getCache(name: string, ttl: number = 300): SapCache {
    if (!this.caches.has(name)) {
      this.caches.set(name, new SapCache(name, { stdTTL: ttl }));
    }
    return this.caches.get(name)!;
  }

  /**
   * Limpa todos os caches
   */
  static flushAll(): void {
    for (const cache of this.caches.values()) {
      cache.flush();
    }
    console.log("[CacheFactory] All caches flushed");
  }

  /**
   * Obtém estatísticas de todos os caches
   */
  static getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}
