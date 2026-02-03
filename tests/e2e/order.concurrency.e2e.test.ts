import test from "node:test";
import assert from "node:assert/strict";
import { createOrder, applyOrderEventWithGuards } from "../../wms-core/src/services/orderService.js";

test("concorrência: 2 operadores no mesmo pedido (lock otimista por versão)", () => {
  const order0 = createOrder({
    id: "order-conc-1",
    customerId: "cust-1",
    items: [{ sku: "SKU-1", quantity: 1 }]
  });

  const rA = applyOrderEventWithGuards({
    order: order0,
    expectedVersion: 0,
    event: { eventType: "INICIAR_SEPARACAO", actorId: "op-a", actorRole: "PICKER" }
  });
  assert.equal(rA.order.version, 1);

  // Simula o segundo operador tentando persistir com expectedVersion=0,
  // mas o "registro atual" já está na versão 1.
  assert.throws(
    () =>
      applyOrderEventWithGuards({
        order: rA.order,
        expectedVersion: 0,
        event: { eventType: "INICIAR_SEPARACAO", actorId: "op-b", actorRole: "PICKER" }
      }),
    (err: unknown) => {
      const e = err as { code?: string };
      return e?.code === "WMS-CONC-001";
    }
  );
});

