import type {
  OrderEvent,
  OrderEventType,
  OrderHistoryResponse,
  OrderStatus,
  PostOrderEventRequest,
  PostOrderEventResult,
  Priority,
  UiOrder
} from "./types";
import { randomId } from "./client";

type Db = {
  orders: UiOrder[];
  history: Record<string, OrderEvent[]>;
};

const CARRIERS = ["Jadlog", "Correios", "Total Express", "Azul Cargo", "Loggi"];
const PRIORITIES: Priority[] = ["P1", "P2", "P3"];
const STATUSES: OrderStatus[] = [
  "A_SEPARAR",
  "EM_SEPARACAO",
  "CONFERIDO",
  "AGUARDANDO_COTACAO",
  "AGUARDANDO_COLETA",
  "DESPACHADO"
];

function iso(d: Date) {
  return d.toISOString();
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function seededOrders(): Db {
  const now = new Date();
  const orders: UiOrder[] = [];
  const history: Record<string, OrderEvent[]> = {};

  for (let i = 0; i < 36; i++) {
    const status = pick(STATUSES);
    const createdAt = new Date(now.getTime() - (i + 2) * 43 * 60 * 1000);
    const updatedAt = new Date(createdAt.getTime() + 17 * 60 * 1000);
    const slaHours = pick([6, 8, 12, 18, 24, 36]);
    const slaDueAt = addHours(createdAt, slaHours);
    const orderId = `ord_${String(i + 1).padStart(4, "0")}`;

    const carrier = Math.random() < 0.85 ? pick(CARRIERS) : null;
    const priority = pick(PRIORITIES);
    const sapDocEntry = 10000 + i;
    const sapDocNum = 5000 + i;
    
    const order: UiOrder = {
      orderId,
      externalOrderId: `ERP-${10000 + i}`,
      sapDocEntry,
      sapDocNum,
      customerId: `CUST-${String(210 + (i % 13)).padStart(3, "0")}`,
      customerName: `Cliente ${String(210 + (i % 13)).padStart(3, "0")}`,
      shipToAddress: `Rua ${i}, nº ${100 + i}, Bairro Centro, São Paulo - SP`,
      status,
      carrier,
      priority,
      slaDueAt: iso(slaDueAt),
      items: [
        { sku: `SKU-${100 + (i % 17)}`, quantity: 1 + ((i * 3) % 5) },
        { sku: `SKU-${200 + (i % 11)}`, quantity: 1 + ((i * 7) % 4) }
      ],
      createdAt: iso(createdAt),
      updatedAt: iso(updatedAt),
      metadata: { origin: "SAP_B1", docEntry: sapDocEntry },
      pendingIssues:
        Math.random() < 0.28
          ? ["Endereço incompleto", "Divergência de item (SKU)"]
          : [],
      scanHistory:
        status === "EM_SEPARACAO" || status === "CONFERIDO"
          ? [
              {
                at: iso(new Date(updatedAt.getTime() - 9 * 60 * 1000)),
                by: "bipador-01",
                sku: `SKU-${100 + (i % 17)}`,
                quantity: 1
              },
              {
                at: iso(new Date(updatedAt.getTime() - 4 * 60 * 1000)),
                by: "bipador-01",
                sku: `SKU-${200 + (i % 11)}`,
                quantity: 1
              }
            ]
          : []
    };

    orders.push(order);
    history[orderId] = seedHistory(orderId, status, updatedAt);
  }

  return { orders, history };
}

function seedHistory(orderId: string, status: OrderStatus, updatedAt: Date) {
  const events: OrderEvent[] = [];
  const push = (type: OrderEventType, from: OrderStatus, to: OrderStatus) => {
    events.push({
      eventId: randomId("evt_"),
      type,
      from,
      to,
      occurredAt: iso(new Date(updatedAt.getTime() - (events.length + 1) * 3600000)),
      actor: { kind: "USER", id: "user-demo" },
      idempotencyKey: null
    });
  };

  // cadeia simples coerente com a state machine
  if (status === "A_SEPARAR") return events;
  push("INICIAR_SEPARACAO", "A_SEPARAR", "EM_SEPARACAO");
  if (status === "EM_SEPARACAO") return events;
  push("FINALIZAR_SEPARACAO", "EM_SEPARACAO", "CONFERIDO");
  if (status === "CONFERIDO") return events;
  push("SOLICITAR_COTACAO", "CONFERIDO", "AGUARDANDO_COTACAO");
  if (status === "AGUARDANDO_COTACAO") return events;
  push("CONFIRMAR_COTACAO", "AGUARDANDO_COTACAO", "AGUARDANDO_COLETA");
  if (status === "AGUARDANDO_COLETA") return events;
  push("DESPACHAR", "AGUARDANDO_COLETA", "DESPACHADO");
  return events;
}

const db: Db = seededOrders();

export type ListOrdersInput = {
  status?: OrderStatus;
  search?: string;
  carrier?: string;
  priority?: Priority;
  sla?: "ALL" | "LATE" | "DUE_SOON" | "OK";
  limit?: number;
};

export async function mockListOrders(input: ListOrdersInput) {
  await sleep(120);
  const now = Date.now();
  const search = (input.search ?? "").trim().toLowerCase();

  let items = [...db.orders];

  if (input.status) items = items.filter((o) => o.status === input.status);
  if (input.carrier) items = items.filter((o) => o.carrier === input.carrier);
  if (input.priority) items = items.filter((o) => o.priority === input.priority);
  if (search) {
    items = items.filter((o) => {
      return (
        o.orderId.toLowerCase().includes(search) ||
        (o.externalOrderId ?? "").toLowerCase().includes(search) ||
        o.customerId.toLowerCase().includes(search)
      );
    });
  }

  if (input.sla && input.sla !== "ALL") {
    items = items.filter((o) => {
      const due = o.slaDueAt ? new Date(o.slaDueAt).getTime() : null;
      if (!due) return false;
      const hoursLeft = (due - now) / 3600000;
      if (input.sla === "LATE") return hoursLeft < 0;
      if (input.sla === "DUE_SOON") return hoursLeft >= 0 && hoursLeft <= 4;
      if (input.sla === "OK") return hoursLeft > 4;
      return true;
    });
  }

  items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const limit = input.limit ?? 200;
  return { items: items.slice(0, limit), nextCursor: null as string | null };
}

export async function mockGetOrder(orderId: string) {
  await sleep(80);
  const o = db.orders.find((x) => x.orderId === orderId);
  if (!o) throw new Error("Pedido não encontrado");
  return o;
}

export async function mockGetOrderHistory(orderId: string): Promise<OrderHistoryResponse> {
  await sleep(80);
  const events = db.history[orderId] ?? [];
  return { orderId, events: [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)) };
}

const TRANSITIONS: Array<{
  from: OrderStatus;
  type: OrderEventType;
  to: OrderStatus;
}> = [
  { from: "A_SEPARAR", type: "INICIAR_SEPARACAO", to: "EM_SEPARACAO" },
  { from: "EM_SEPARACAO", type: "FINALIZAR_SEPARACAO", to: "CONFERIDO" },
  { from: "CONFERIDO", type: "SOLICITAR_COTACAO", to: "AGUARDANDO_COTACAO" },
  { from: "AGUARDANDO_COTACAO", type: "CONFIRMAR_COTACAO", to: "AGUARDANDO_COLETA" },
  { from: "AGUARDANDO_COLETA", type: "DESPACHAR", to: "DESPACHADO" }
];

export async function mockPostOrderEvent(
  orderId: string,
  req: PostOrderEventRequest,
  idempotencyKey?: string
): Promise<PostOrderEventResult> {
  await sleep(150);
  const order = db.orders.find((x) => x.orderId === orderId);
  if (!order) throw new Error("Pedido não encontrado");

  const t = TRANSITIONS.find((x) => x.from === order.status && x.type === req.type);
  if (!t) {
    const event: OrderEvent = {
      eventId: randomId("evt_"),
      type: req.type,
      from: order.status,
      to: order.status,
      occurredAt: req.occurredAt ?? new Date().toISOString(),
      actor: req.actor,
      idempotencyKey: idempotencyKey ?? null
    };
    db.history[orderId] = [...(db.history[orderId] ?? []), event];
    return {
      orderId,
      previousStatus: order.status,
      currentStatus: order.status,
      applied: false,
      event
    };
  }

  const previousStatus = order.status;
  order.status = t.to;
  order.updatedAt = new Date().toISOString();

  const event: OrderEvent = {
    eventId: randomId("evt_"),
    type: req.type,
    from: previousStatus,
    to: order.status,
    occurredAt: req.occurredAt ?? new Date().toISOString(),
    actor: req.actor,
    idempotencyKey: idempotencyKey ?? null
  };

  db.history[orderId] = [...(db.history[orderId] ?? []), event];

  return {
    orderId,
    previousStatus,
    currentStatus: order.status,
    applied: true,
    event
  };
}

export async function mockReprocess(orderId: string) {
  await sleep(180);
  const order = db.orders.find((x) => x.orderId === orderId);
  if (!order) throw new Error("Pedido não encontrado");
  // no mock, só registra uma pendência como “reprocessada”
  order.pendingIssues = (order.pendingIssues ?? []).filter(
    (x) => x.toLowerCase() !== "reprocessar"
  );
  order.updatedAt = new Date().toISOString();
  return { ok: true as const };
}

export async function mockReleaseWave(orderId: string) {
  await sleep(180);
  const order = db.orders.find((x) => x.orderId === orderId);
  if (!order) throw new Error("Pedido não encontrado");
  // no mock, não muda status; apenas “carimba” updatedAt e adiciona uma pendência/resumo
  order.updatedAt = new Date().toISOString();
  order.pendingIssues = (order.pendingIssues ?? []).filter(
    (x) => x.toLowerCase() !== "liberar onda"
  );
  return { ok: true as const };
}

export function mockCarriers() {
  const set = new Set<string>();
  for (const o of db.orders) {
    if (o.carrier) set.add(o.carrier);
  }
  return Array.from(set).sort();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

