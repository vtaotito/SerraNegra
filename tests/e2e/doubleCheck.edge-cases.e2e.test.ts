import test from "node:test";
import assert from "node:assert/strict";
import { validateDoubleCheckSequence } from "../../wms-core/src/services/doubleCheckService.js";
import { buildScanEvent } from "../../wms-core/src/services/doubleCheckService.js";
import { fixtureShipToAddress } from "../fixtures/orders.js";

test("endereço errado", () => {
  const result = validateDoubleCheckSequence(
    { expectedAddress: fixtureShipToAddress, items: [{ sku: "SKU-1", expectedQuantity: 1 }] },
    [
      buildScanEvent({
        id: "scan-addr-1",
        orderId: "order-addr-1",
        type: "ADDRESS_SCAN",
        value: "ADDR-XX",
        actorId: "user-1",
        actorRole: "PICKER"
      })
    ]
  );

  assert.equal(result.ok, false);
  assert.equal(result.isComplete, false);
  assert.deepEqual(result.errors, ["Endereço divergente do esperado."]);
});

test("SKU errado", () => {
  const result = validateDoubleCheckSequence(
    { expectedAddress: fixtureShipToAddress, items: [{ sku: "SKU-1", expectedQuantity: 1 }] },
    [
      buildScanEvent({
        id: "scan-addr-1",
        orderId: "order-sku-1",
        type: "ADDRESS_SCAN",
        value: fixtureShipToAddress,
        actorId: "user-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-sku-1",
        orderId: "order-sku-1",
        type: "PRODUCT_SCAN",
        value: "SKU-999",
        actorId: "user-1",
        actorRole: "PICKER"
      })
    ]
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SKU não esperado/i);
});

test("quantidade excedida", () => {
  const result = validateDoubleCheckSequence(
    { expectedAddress: fixtureShipToAddress, items: [{ sku: "SKU-1", expectedQuantity: 2 }] },
    [
      buildScanEvent({
        id: "scan-addr-1",
        orderId: "order-qty-1",
        type: "ADDRESS_SCAN",
        value: fixtureShipToAddress,
        actorId: "user-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-sku-1",
        orderId: "order-qty-1",
        type: "PRODUCT_SCAN",
        value: "SKU-1",
        actorId: "user-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-qty-1",
        orderId: "order-qty-1",
        type: "QUANTITY_SCAN",
        value: "3",
        quantity: 3,
        actorId: "user-1",
        actorRole: "PICKER"
      })
    ]
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Quantidade excedente/i);
});

test("item faltante parcial (incompleto, sem erro)", () => {
  const result = validateDoubleCheckSequence(
    { expectedAddress: fixtureShipToAddress, items: [{ sku: "SKU-1", expectedQuantity: 2 }] },
    [
      buildScanEvent({
        id: "scan-addr-1",
        orderId: "order-partial-1",
        type: "ADDRESS_SCAN",
        value: fixtureShipToAddress,
        actorId: "user-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-sku-1",
        orderId: "order-partial-1",
        type: "PRODUCT_SCAN",
        value: "SKU-1",
        actorId: "user-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-qty-1",
        orderId: "order-partial-1",
        type: "QUANTITY_SCAN",
        value: "1",
        quantity: 1,
        actorId: "user-1",
        actorRole: "PICKER"
      })
    ]
  );

  assert.equal(result.ok, true);
  assert.equal(result.isComplete, false);
  assert.equal(result.remainingBySku["SKU-1"], 1);
});

test("duplicidade/idempotência (scan repetido com mesma idempotencyKey)", () => {
  const result = validateDoubleCheckSequence(
    { expectedAddress: fixtureShipToAddress, items: [{ sku: "SKU-1", expectedQuantity: 2 }] },
    [
      buildScanEvent({
        id: "scan-addr-1",
        orderId: "order-idem-1",
        type: "ADDRESS_SCAN",
        value: fixtureShipToAddress,
        actorId: "user-1",
        actorRole: "PICKER",
        idempotencyKey: "idem-addr-1"
      }),
      // repetido (mesma chave + mesmo payload) → ignorado
      buildScanEvent({
        id: "scan-addr-dup",
        orderId: "order-idem-1",
        type: "ADDRESS_SCAN",
        value: fixtureShipToAddress,
        actorId: "user-1",
        actorRole: "PICKER",
        idempotencyKey: "idem-addr-1"
      }),
      buildScanEvent({
        id: "scan-sku-1",
        orderId: "order-idem-1",
        type: "PRODUCT_SCAN",
        value: "SKU-1",
        actorId: "user-1",
        actorRole: "PICKER",
        idempotencyKey: "idem-sku-1"
      }),
      buildScanEvent({
        id: "scan-qty-1",
        orderId: "order-idem-1",
        type: "QUANTITY_SCAN",
        value: "2",
        quantity: 2,
        actorId: "user-1",
        actorRole: "PICKER",
        idempotencyKey: "idem-qty-1"
      }),
      // repetido (mesma chave + mesmo payload) → ignorado
      buildScanEvent({
        id: "scan-qty-dup",
        orderId: "order-idem-1",
        type: "QUANTITY_SCAN",
        value: "2",
        quantity: 2,
        actorId: "user-1",
        actorRole: "PICKER",
        idempotencyKey: "idem-qty-1"
      })
    ]
  );

  assert.equal(result.ok, true);
  assert.equal(result.isComplete, true);
  assert.deepEqual(result.errors, []);
});

