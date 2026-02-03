import test from "node:test";
import assert from "node:assert/strict";
import { createOrder, applyOrderEventWithGuards, createOrderEventIdempotencyStore } from "../../wms-core/src/services/orderService.js";
import { createDefaultTasks, startTask, recordScanOnTask, completeTask } from "../../wms-core/src/services/taskService.js";
import { validateDoubleCheckSequence, buildScanEvent } from "../../wms-core/src/services/doubleCheckService.js";
import {
  fixtureCustomerId,
  fixtureItems,
  fixtureOrderId,
  fixtureShipToAddress,
  fixtureTaskIds
} from "../fixtures/orders.js";

test("E2E do fluxo: pedido → picking → packing → expedição", () => {
  const idempotency = createOrderEventIdempotencyStore();

  // pedido criado
  const order0 = createOrder({
    id: fixtureOrderId,
    customerId: fixtureCustomerId,
    shipToAddress: fixtureShipToAddress,
    items: fixtureItems
  });
  assert.equal(order0.status, "A_SEPARAR");
  assert.equal(order0.version, 0);

  // tarefas padrão (picking/packing/shipping)
  const [picking0, packing0, shipping0] = createDefaultTasks({
    orderId: order0.id,
    items: fixtureItems,
    taskIds: fixtureTaskIds
  });

  // INICIAR_SEPARACAO (idempotente)
  const r1 = applyOrderEventWithGuards({
    order: order0,
    event: { eventType: "INICIAR_SEPARACAO", actorId: "picker-1", actorRole: "PICKER", idempotencyKey: "idem-evt-1" },
    expectedVersion: 0,
    idempotencyStore: idempotency
  });
  const order1 = r1.order;
  assert.equal(order1.status, "EM_SEPARACAO");
  assert.equal(order1.version, 1);

  const r1dup = applyOrderEventWithGuards({
    order: order0,
    event: { eventType: "INICIAR_SEPARACAO", actorId: "picker-1", actorRole: "PICKER", idempotencyKey: "idem-evt-1" },
    expectedVersion: 0,
    idempotencyStore: idempotency
  });
  assert.deepEqual(r1dup, r1);

  // picking: scans válidos (endereço → sku → qty) para SKU-1 e SKU-2
  const pickScanResult = validateDoubleCheckSequence(
    {
      expectedAddress: fixtureShipToAddress,
      items: [
        { sku: "SKU-1", expectedQuantity: 2 },
        { sku: "SKU-2", expectedQuantity: 1 }
      ]
    },
    [
      buildScanEvent({
        id: "scan-addr-1",
        orderId: order0.id,
        taskId: picking0.id,
        type: "ADDRESS_SCAN",
        value: fixtureShipToAddress,
        actorId: "picker-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-sku-1",
        orderId: order0.id,
        taskId: picking0.id,
        type: "PRODUCT_SCAN",
        value: "SKU-1",
        actorId: "picker-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-qty-1",
        orderId: order0.id,
        taskId: picking0.id,
        type: "QUANTITY_SCAN",
        value: "2",
        quantity: 2,
        actorId: "picker-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-sku-2",
        orderId: order0.id,
        taskId: picking0.id,
        type: "PRODUCT_SCAN",
        value: "SKU-2",
        actorId: "picker-1",
        actorRole: "PICKER"
      }),
      buildScanEvent({
        id: "scan-qty-2",
        orderId: order0.id,
        taskId: picking0.id,
        type: "QUANTITY_SCAN",
        value: "1",
        quantity: 1,
        actorId: "picker-1",
        actorRole: "PICKER"
      })
    ]
  );
  assert.equal(pickScanResult.ok, true);
  assert.equal(pickScanResult.isComplete, true);

  // picking task acompanha o total escaneado (registro simples)
  let picking = startTask(picking0);
  picking = recordScanOnTask(picking, "SKU-1", 2);
  picking = recordScanOnTask(picking, "SKU-2", 1);
  picking = completeTask(picking);
  assert.equal(picking.status, "COMPLETED");

  // packing depende do picking concluído
  let packing = startTask(packing0, picking);
  packing = recordScanOnTask(packing, "SKU-1", 2);
  packing = recordScanOnTask(packing, "SKU-2", 1);
  packing = completeTask(packing);
  assert.equal(packing.status, "COMPLETED");

  // shipping depende do packing concluído; no MVP, shipping não valida linhas
  let shipping = startTask(shipping0, packing);
  shipping = completeTask(shipping);
  assert.equal(shipping.status, "COMPLETED");

  // estado do pedido segue até DESPACHADO (expedição)
  const order2 = applyOrderEventWithGuards({
    order: order1,
    event: { eventType: "FINALIZAR_SEPARACAO", actorId: "picker-1", actorRole: "PICKER" }
  }).order;
  assert.equal(order2.status, "CONFERIDO");

  const order3 = applyOrderEventWithGuards({
    order: order2,
    event: { eventType: "SOLICITAR_COTACAO", actorId: "sup-1", actorRole: "SUPERVISOR" }
  }).order;
  assert.equal(order3.status, "AGUARDANDO_COTACAO");

  const order4 = applyOrderEventWithGuards({
    order: order3,
    event: { eventType: "CONFIRMAR_COTACAO", actorId: "sup-1", actorRole: "SUPERVISOR" }
  }).order;
  assert.equal(order4.status, "AGUARDANDO_COLETA");

  const order5 = applyOrderEventWithGuards({
    order: order4,
    event: { eventType: "DESPACHAR", actorId: "ship-1", actorRole: "SHIPPER" }
  }).order;
  assert.equal(order5.status, "DESPACHADO");
});

