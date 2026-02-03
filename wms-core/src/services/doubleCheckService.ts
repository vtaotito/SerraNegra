import { ScanEvent, ScanEventType } from "../domain/scanEvent.js";
import { WmsError } from "../errors.js";

export type DoubleCheckItem = {
  sku: string;
  expectedQuantity: number;
};

export type DoubleCheckContext = {
  expectedAddress: string;
  items: DoubleCheckItem[];
};

export type DoubleCheckResult = {
  ok: boolean;
  isComplete: boolean;
  errors: string[];
  remainingBySku: Record<string, number>;
};

const normalizeSku = (sku: string): string => sku.trim().toUpperCase();

export const validateDoubleCheckSequence = (
  context: DoubleCheckContext,
  events: ScanEvent[]
): DoubleCheckResult => {
  if (!context.expectedAddress) {
    throw new WmsError("WMS-VAL-002", "expectedAddress é obrigatório.");
  }
  if (!context.items.length) {
    throw new WmsError("WMS-VAL-002", "items é obrigatório.");
  }

  const errors: string[] = [];
  const remainingBySku: Record<string, number> = {};
  for (const item of context.items) {
    remainingBySku[normalizeSku(item.sku)] = item.expectedQuantity;
  }

  let addressValidated = false;
  let pendingSku: string | null = null;
  const seenIdempotencyKeys = new Map<string, string>();

  for (const event of events) {
    const idemKey = event.idempotencyKey?.trim();
    if (idemKey) {
      const fingerprint = `${event.type}|${event.value}|${event.quantity ?? ""}`;
      const prev = seenIdempotencyKeys.get(idemKey);
      if (prev) {
        if (prev !== fingerprint) {
          errors.push("Idempotency-Key já usada com payload diferente.");
          break;
        }
        // scan repetido (mesma chave + mesmo payload) → idempotente: ignora
        continue;
      }
      seenIdempotencyKeys.set(idemKey, fingerprint);
    }

    if (!addressValidated) {
      if (event.type !== "ADDRESS_SCAN") {
        errors.push("O primeiro scan deve ser de endereço.");
        break;
      }
      if (event.value !== context.expectedAddress) {
        errors.push("Endereço divergente do esperado.");
        break;
      }
      addressValidated = true;
      continue;
    }

    if (event.type === "PRODUCT_SCAN") {
      const sku = normalizeSku(event.value);
      if (!(sku in remainingBySku)) {
        errors.push(`SKU não esperado: ${event.value}.`);
        continue;
      }
      pendingSku = sku;
      continue;
    }

    if (event.type === "QUANTITY_SCAN") {
      if (!pendingSku) {
        errors.push("Quantidade sem SKU correspondente.");
        continue;
      }
      const quantity = event.quantity ?? Number(event.value);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push("Quantidade inválida.");
        continue;
      }
      const currentRemaining = remainingBySku[pendingSku] ?? 0;
      const nextRemaining = currentRemaining - quantity;
      remainingBySku[pendingSku] = nextRemaining;
      if (nextRemaining < 0) {
        errors.push(`Quantidade excedente para SKU ${pendingSku}.`);
      }
      pendingSku = null;
      continue;
    }

    errors.push(`Tipo de evento inválido: ${event.type}.`);
  }

  const isComplete = Object.values(remainingBySku).every((value) => value === 0);
  return {
    ok: errors.length === 0,
    isComplete,
    errors,
    remainingBySku
  };
};

export const buildScanEvent = (input: {
  id: string;
  orderId: string;
  taskId?: string;
  type: ScanEventType;
  value: string;
  quantity?: number;
  actorId: string;
  actorRole: string;
  occurredAt?: string;
  idempotencyKey?: string;
  correlationId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}): ScanEvent => ({
  id: input.id,
  orderId: input.orderId,
  taskId: input.taskId,
  type: input.type,
  value: input.value,
  quantity: input.quantity,
  occurredAt: input.occurredAt ?? new Date().toISOString(),
  actorId: input.actorId,
  actorRole: input.actorRole,
  idempotencyKey: input.idempotencyKey,
  correlationId: input.correlationId,
  requestId: input.requestId,
  metadata: input.metadata
});
