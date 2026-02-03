import test from "node:test";
import assert from "node:assert/strict";
import { applyOrderEvent, createOrder, defaultOrderPermissions } from "../src/services/orderService.js";

test("aplica transição válida e registra auditoria", () => {
  const order = createOrder({
    id: "order-1",
    customerId: "cust-1",
    items: [{ sku: "SKU1", quantity: 2 }]
  });

  const result = applyOrderEvent(order, {
    eventType: "INICIAR_SEPARACAO",
    actorId: "user-1",
    actorRole: "PICKER"
  });

  assert.equal(result.order.status, "EM_SEPARACAO");
  assert.equal(result.transition.from, "A_SEPARAR");
  assert.equal(result.transition.to, "EM_SEPARACAO");
});

test("bloqueia transição sem permissão", () => {
  const order = createOrder({
    id: "order-2",
    customerId: "cust-2",
    items: [{ sku: "SKU2", quantity: 1 }]
  });

  assert.throws(() => {
    applyOrderEvent(order, {
      eventType: "INICIAR_SEPARACAO",
      actorId: "user-2",
      actorRole: "SHIPPER"
    });
  });

  assert.deepEqual(defaultOrderPermissions.INICIAR_SEPARACAO, ["PICKER", "SUPERVISOR"]);
});
