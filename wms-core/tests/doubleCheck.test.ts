import test from "node:test";
import assert from "node:assert/strict";
import { validateDoubleCheckSequence } from "../src/services/doubleCheckService.js";

test("valida sequência endereço -> produto -> quantidade", () => {
  const result = validateDoubleCheckSequence(
    {
      expectedAddress: "ADDR-01",
      items: [{ sku: "SKU-1", expectedQuantity: 2 }]
    },
    [
      {
        id: "scan-1",
        orderId: "order-1",
        type: "ADDRESS_SCAN",
        value: "ADDR-01",
        occurredAt: new Date().toISOString(),
        actorId: "user-1",
        actorRole: "PICKER"
      },
      {
        id: "scan-2",
        orderId: "order-1",
        type: "PRODUCT_SCAN",
        value: "SKU-1",
        occurredAt: new Date().toISOString(),
        actorId: "user-1",
        actorRole: "PICKER"
      },
      {
        id: "scan-3",
        orderId: "order-1",
        type: "QUANTITY_SCAN",
        value: "2",
        quantity: 2,
        occurredAt: new Date().toISOString(),
        actorId: "user-1",
        actorRole: "PICKER"
      }
    ]
  );

  assert.equal(result.ok, true);
  assert.equal(result.isComplete, true);
  assert.deepEqual(result.errors, []);
});
