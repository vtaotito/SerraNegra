import { SapCircuitOpenError } from "../errors.js";

type State = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Circuit breaker minimalista:
 * - abre após N falhas consecutivas
 * - após timeout, entra em HALF_OPEN e permite chamadas
 * - fecha após M sucessos consecutivos
 */
export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly openStateTimeoutMs: number;

  private state: State = "CLOSED";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAtMs: number | null = null;

  constructor(args: { failureThreshold: number; successThreshold: number; openStateTimeoutMs: number }) {
    this.failureThreshold = Math.max(1, Math.floor(args.failureThreshold));
    this.successThreshold = Math.max(1, Math.floor(args.successThreshold));
    this.openStateTimeoutMs = Math.max(1, Math.floor(args.openStateTimeoutMs));
  }

  canPass(): true | SapCircuitOpenError {
    if (this.state === "CLOSED") return true;

    const now = Date.now();
    if (this.state === "OPEN") {
      const openedAt = this.openedAtMs ?? now;
      const elapsed = now - openedAt;
      if (elapsed >= this.openStateTimeoutMs) {
        this.state = "HALF_OPEN";
        this.consecutiveSuccesses = 0;
        return true;
      }
      return new SapCircuitOpenError(this.openStateTimeoutMs - elapsed);
    }

    // HALF_OPEN: deixa passar
    return true;
  }

  onSuccess(): void {
    if (this.state === "CLOSED") {
      this.consecutiveFailures = 0;
      return;
    }

    this.consecutiveSuccesses += 1;
    if (this.consecutiveSuccesses >= this.successThreshold) {
      this.state = "CLOSED";
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
      this.openedAtMs = null;
    }
  }

  onFailure(): void {
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAtMs = Date.now();
    }
  }

  snapshot(): { state: State; consecutiveFailures: number; consecutiveSuccesses: number } {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses
    };
  }
}

