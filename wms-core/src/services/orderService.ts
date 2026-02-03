import {
  Order,
  OrderEvent,
  OrderEventResult,
  OrderEventType,
  OrderItem,
  OrderStatus,
  OrderTransition
} from "../domain/order.js";
import { WmsError } from "../errors.js";
import { getNextState, isFinalState, orderStateMachine } from "../state-machine/orderStateMachine.js";

export type OrderPermissionPolicy = Record<OrderEventType, Array<OrderEvent["actorRole"]>>;

export const defaultOrderPermissions: OrderPermissionPolicy = {
  INICIAR_SEPARACAO: ["PICKER", "SUPERVISOR"],
  FINALIZAR_SEPARACAO: ["PICKER", "SUPERVISOR"],
  CONFERIR: ["CHECKER", "SUPERVISOR"],
  SOLICITAR_COTACAO: ["SUPERVISOR"],
  CONFIRMAR_COTACAO: ["SUPERVISOR"],
  AGUARDAR_COLETA: ["SUPERVISOR"],
  DESPACHAR: ["SHIPPER", "SUPERVISOR"]
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(",")}}`;
};

const hashOrderEventForIdempotency = (event: OrderEvent): string =>
  stableStringify({
    eventType: event.eventType,
    actorId: event.actorId,
    actorRole: event.actorRole,
    reason: event.reason ?? null,
    metadata: event.metadata ?? null
  });

export type OrderEventIdempotencyStore = Map<
  string,
  { requestHash: string; response: OrderEventResult; createdAt: string }
>;

export const createOrderEventIdempotencyStore = (): OrderEventIdempotencyStore => new Map();

export const createOrder = (input: {
  id: string;
  customerId: string;
  items: OrderItem[];
  externalOrderId?: string;
  shipToAddress?: string;
  createdAt?: string;
}): Order => {
  if (!input.customerId) {
    throw new WmsError("WMS-VAL-002", "customerId é obrigatório.");
  }
  if (!input.items.length) {
    throw new WmsError("WMS-VAL-002", "items é obrigatório.");
  }
  const now = input.createdAt ?? new Date().toISOString();
  return {
    id: input.id,
    externalOrderId: input.externalOrderId,
    customerId: input.customerId,
    shipToAddress: input.shipToAddress,
    status: orderStateMachine.initialState,
    items: input.items,
    createdAt: now,
    updatedAt: now,
    version: 0
  };
};

export const assertItemsImmutable = (
  current: Order,
  nextItems: OrderItem[]
): void => {
  if (current.status === "EM_SEPARACAO" || current.status === "CONFERIDO") {
    const currentPayload = JSON.stringify(current.items);
    const nextPayload = JSON.stringify(nextItems);
    if (currentPayload !== nextPayload) {
      throw new WmsError(
        "WMS-VAL-001",
        "Itens não podem ser alterados após iniciar a separação."
      );
    }
  }
};

export const applyOrderEvent = (
  order: Order,
  event: OrderEvent,
  permissions: OrderPermissionPolicy = defaultOrderPermissions
): OrderEventResult => {
  if (isFinalState(order.status)) {
    throw new WmsError("WMS-SM-003", "Pedido em estado final.");
  }

  const next = getNextState(order.status, event.eventType);
  if (!next) {
    const knownEvents = orderStateMachine.transitions.map((item) => item.eventType);
    if (!knownEvents.includes(event.eventType)) {
      throw new WmsError("WMS-SM-002", "Evento desconhecido.", {
        eventType: event.eventType
      });
    }
    throw new WmsError("WMS-SM-001", "Transição inválida para o status atual.", {
      from: order.status,
      eventType: event.eventType
    });
  }

  const allowedRoles = permissions[event.eventType] ?? [];
  if (!allowedRoles.includes(event.actorRole)) {
    throw new WmsError("WMS-AUTH-001", "Permissão insuficiente para o evento.", {
      eventType: event.eventType,
      actorRole: event.actorRole
    });
  }

  const occurredAt = event.occurredAt ?? new Date().toISOString();
  const transition: OrderTransition = {
    orderId: order.id,
    from: order.status,
    to: next,
    eventType: event.eventType,
    actorId: event.actorId,
    actorRole: event.actorRole,
    occurredAt,
    idempotencyKey: event.idempotencyKey,
    reason: event.reason,
    metadata: event.metadata
  };

  const updatedOrder: Order = {
    ...order,
    status: next,
    updatedAt: occurredAt,
    version: order.version + 1
  };

  return { order: updatedOrder, transition };
};

export const applyOrderEventWithGuards = (
  input: {
    order: Order;
    event: OrderEvent;
    permissions?: OrderPermissionPolicy;
    expectedVersion?: number;
    idempotencyStore?: OrderEventIdempotencyStore;
  }
): OrderEventResult => {
  const { order, event } = input;

  if (typeof input.expectedVersion === "number" && order.version !== input.expectedVersion) {
    throw new WmsError("WMS-CONC-001", "Conflito de versão (lock otimista).", {
      expectedVersion: input.expectedVersion,
      currentVersion: order.version
    });
  }

  const idempotencyKey = event.idempotencyKey?.trim();
  const store = input.idempotencyStore;
  if (idempotencyKey && store) {
    const scopeKey = `${order.id}:${event.eventType}:${idempotencyKey}`;
    const requestHash = hashOrderEventForIdempotency(event);
    const existing = store.get(scopeKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new WmsError("WMS-IDEM-001", "Idempotency-Key já usada com payload diferente.", {
          scopeKey
        });
      }
      return existing.response;
    }
    const response = applyOrderEvent(order, event, input.permissions ?? defaultOrderPermissions);
    store.set(scopeKey, { requestHash, response, createdAt: new Date().toISOString() });
    return response;
  }

  return applyOrderEvent(order, event, input.permissions ?? defaultOrderPermissions);
};
