type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Rate limiter simples (memória) combinando:
 * - limite de concorrência (semaforo)
 * - limite de RPS (janela deslizante por timestamp)
 *
 * Observação: para múltiplas instâncias, trocar por um rate limiter distribuído (Redis).
 */
export class RateLimiter {
  private readonly maxConcurrent: number;
  private readonly maxRps: number;

  private inFlight = 0;
  private queue: Array<Deferred<void>> = [];

  private recent: number[] = []; // timestamps (ms) nos últimos 1000ms

  constructor(args: { maxConcurrent: number; maxRps: number }) {
    this.maxConcurrent = Math.max(1, Math.floor(args.maxConcurrent));
    this.maxRps = Math.max(1, Math.floor(args.maxRps));
  }

  async acquire(): Promise<() => void> {
    if (this.inFlight >= this.maxConcurrent) {
      const w = deferred<void>();
      this.queue.push(w);
      await w.promise;
    }

    await this.throttleRps();
    this.inFlight += 1;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inFlight = Math.max(0, this.inFlight - 1);
      const next = this.queue.shift();
      if (next) next.resolve();
    };
  }

  private async throttleRps(): Promise<void> {
    const now = Date.now();
    this.recent = this.recent.filter((t) => now - t < 1000);
    if (this.recent.length < this.maxRps) {
      this.recent.push(now);
      return;
    }

    const oldest = this.recent[0]!;
    const waitMs = Math.max(0, 1000 - (now - oldest));
    await new Promise((r) => setTimeout(r, waitMs));
    return this.throttleRps();
  }
}

