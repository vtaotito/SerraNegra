import { Task, TaskLine, TaskStatus, TaskType } from "../domain/task.js";
import { WmsError } from "../errors.js";

const taskDependencies: Record<TaskType, TaskType | null> = {
  PICKING: null,
  PACKING: "PICKING",
  SHIPPING: "PACKING"
};

const nowIso = (): string => new Date().toISOString();

export const createDefaultTasks = (input: {
  orderId: string;
  items: Array<{ sku: string; quantity: number }>;
  taskIds: { picking: string; packing: string; shipping: string };
  createdAt?: string;
}): Task[] => {
  const createdAt = input.createdAt ?? nowIso();
  const lines: TaskLine[] = input.items.map((item) => ({
    sku: item.sku,
    quantity: item.quantity,
    scannedQuantity: 0
  }));

  const picking: Task = {
    id: input.taskIds.picking,
    orderId: input.orderId,
    type: "PICKING",
    status: "PENDING",
    lines,
    createdAt,
    updatedAt: createdAt
  };

  const packing: Task = {
    id: input.taskIds.packing,
    orderId: input.orderId,
    type: "PACKING",
    status: "PENDING",
    dependsOnTaskId: picking.id,
    lines,
    createdAt,
    updatedAt: createdAt
  };

  const shipping: Task = {
    id: input.taskIds.shipping,
    orderId: input.orderId,
    type: "SHIPPING",
    status: "PENDING",
    dependsOnTaskId: packing.id,
    lines: [],
    createdAt,
    updatedAt: createdAt
  };

  return [picking, packing, shipping];
};

export const startTask = (task: Task, dependency?: Task): Task => {
  if (task.status !== "PENDING") {
    throw new WmsError("WMS-VAL-001", "Somente tarefas pendentes podem iniciar.");
  }
  if (dependency && dependency.status !== "COMPLETED") {
    throw new WmsError(
      "WMS-VAL-001",
      "Tarefa dependente ainda não concluída.",
      { dependencyType: dependency.type }
    );
  }
  const timestamp = nowIso();
  return {
    ...task,
    status: "IN_PROGRESS",
    startedAt: timestamp,
    updatedAt: timestamp
  };
};

export const recordScanOnTask = (task: Task, sku: string, quantity: number): Task => {
  if (task.status !== "IN_PROGRESS") {
    throw new WmsError("WMS-VAL-001", "Tarefa precisa estar em andamento.");
  }
  const normalizedSku = sku.trim().toUpperCase();
  const lines = task.lines.map((line) => {
    if (line.sku.trim().toUpperCase() !== normalizedSku) {
      return line;
    }
    return {
      ...line,
      scannedQuantity: line.scannedQuantity + quantity
    };
  });
  return {
    ...task,
    lines,
    updatedAt: nowIso()
  };
};

export const completeTask = (task: Task): Task => {
  if (task.status !== "IN_PROGRESS") {
    throw new WmsError("WMS-VAL-001", "Tarefa precisa estar em andamento.");
  }
  if (task.type !== "SHIPPING") {
    const hasMissing = task.lines.some((line) => line.scannedQuantity !== line.quantity);
    if (hasMissing) {
      throw new WmsError("WMS-VAL-001", "Itens ainda não conferidos.");
    }
  }
  const timestamp = nowIso();
  return {
    ...task,
    status: "COMPLETED",
    completedAt: timestamp,
    updatedAt: timestamp
  };
};

export const getDependencyType = (type: TaskType): TaskType | null => taskDependencies[type];
