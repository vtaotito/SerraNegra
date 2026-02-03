import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOrderEventWithGuards,
  createOrder,
  createOrderEventIdempotencyStore
} from "../../wms-core/src/services/orderService.js";

test("idempotência: mesma Idempotency-Key + mesmo payload retorna o mesmo resultado", () => {
  const store = createOrderEventIdempotencyStore();
  const order0 = createOrder({
    id: "order-idem-unit-1",
    customerId: "cust-1",
    items: [{ sku: "SKU-1", quantity: 1 }]
  });

  const result1 = applyOrderEventWithGuards({
    order: order0,
    event: {
      eventType: "INICIAR_SEPARACAO",
      actorId: "u1",
      actorRole: "PICKER",
      idempotencyKey: "idem-1"
    },
    expectedVersion: 0,
    idempotencyStore: store
  });

  const result2 = applyOrderEventWithGuards({
    order: order0,
    event: {
      eventType: "INICIAR_SEPARACAO",
      actorId: "u1",
      actorRole: "PICKER",
      idempotencyKey: "idem-1"
    },
    expectedVersion: 0,
    idempotencyStore: store
  });

  assert.deepEqual(result2, result1);
});

test("idempotência: mesma Idempotency-Key + payload diferente gera WMS-IDEM-001", () => {
  const store = createOrderEventIdempotencyStore();
  const order0 = createOrder({
    id: "order-idem-unit-2",
    customerId: "cust-1",
    items: [{ sku: "SKU-1", quantity: 1 }]
  });

  applyOrderEventWithGuards({
    order: order0,
    event: {
      eventType: "INICIAR_SEPARACAO",
      actorId: "u1",
      actorRole: "PICKER",
      idempotencyKey: "idem-2"
    },
    expectedVersion: 0,
    idempotencyStore: store
  });

  assert.throws(
    () =>
      applyOrderEventWithGuards({
        order: order0,
        event: {
          eventType: "INICIAR_SEPARACAO",
          actorId: "u2", // payload diferente
          actorRole: "PICKER",
          idempotencyKey: "idem-2"
        },
        expectedVersion: 0,
        idempotencyStore: store
      }),
    (err: unknown) => {
      const e = err as { code?: string };
      return e?.code === "WMS-IDEM-001";
    }
  );
});

