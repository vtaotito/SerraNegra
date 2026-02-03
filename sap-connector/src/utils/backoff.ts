export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeBackoffMs(args: {
  attempt: number; // 1..N (1 = primeira retry após falha)
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number; // 0..1
}): number {
  const exp = args.baseDelayMs * Math.pow(2, Math.max(0, args.attempt - 1));
  const capped = Math.min(args.maxDelayMs, exp);
  const jitter = capped * args.jitterRatio * (Math.random() * 2 - 1); // [-ratio..+ratio]
  return Math.max(0, Math.round(capped + jitter));
}

