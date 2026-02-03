import test from "node:test";
import assert from "node:assert/strict";
import { completeTask, createDefaultTasks, startTask } from "../src/services/taskService.js";

test("impede iniciar tarefa com dependência pendente", () => {
  const [picking, packing] = createDefaultTasks({
    orderId: "order-10",
    items: [{ sku: "SKU-1", quantity: 1 }],
    taskIds: { picking: "task-1", packing: "task-2", shipping: "task-3" }
  });

  assert.ok(picking);
  assert.ok(packing);
  assert.throws(() => startTask(packing, picking));
});

test("conclui tarefa somente com itens conferidos", () => {
  const [picking] = createDefaultTasks({
    orderId: "order-11",
    items: [{ sku: "SKU-2", quantity: 2 }],
    taskIds: { picking: "task-4", packing: "task-5", shipping: "task-6" }
  });

  assert.ok(picking);
  const started = startTask(picking);
  assert.throws(() => completeTask(started));
});
