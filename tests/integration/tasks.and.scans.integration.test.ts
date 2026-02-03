import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultTasks, startTask, recordScanOnTask, completeTask } from "../../wms-core/src/services/taskService.js";

test("integração: picking só conclui quando quantidades batem (scan SKU errado não ajuda)", () => {
  const [picking] = createDefaultTasks({
    orderId: "order-int-1",
    items: [{ sku: "SKU-1", quantity: 2 }],
    taskIds: { picking: "task-int-pick-1", packing: "task-int-pack-1", shipping: "task-int-ship-1" }
  });

  let t = startTask(picking);

  // SKU errado: não altera o estado das linhas (no MVP, é um no-op)
  t = recordScanOnTask(t, "SKU-999", 10);

  // parcial: ainda não pode concluir
  t = recordScanOnTask(t, "SKU-1", 1);
  assert.throws(() => completeTask(t));

  // completa
  t = recordScanOnTask(t, "SKU-1", 1);
  t = completeTask(t);
  assert.equal(t.status, "COMPLETED");
});

