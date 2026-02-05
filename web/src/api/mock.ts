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

const CUSTOMER_NAMES = [
  "Magazine Luiza S.A.",
  "Casas Bahia Comercial Ltda",
  "Mercado Livre Brasil",
  "B2W Digital",
  "Via Varejo S.A.",
  "Lojas Americanas",
  "Carrefour Brasil",
  "Grupo Pão de Açúcar",
  "Leroy Merlin Brasil",
  "Decathlon Brasil"
];

const CITIES = [
  { city: "São Paulo", state: "SP", zip: "01310-100" },
  { city: "Rio de Janeiro", state: "RJ", zip: "20040-020" },
  { city: "Belo Horizonte", state: "MG", zip: "30130-010" },
  { city: "Curitiba", state: "PR", zip: "80020-010" },
  { city: "Porto Alegre", state: "RS", zip: "90010-150" },
  { city: "Brasília", state: "DF", zip: "70040-020" },
  { city: "Salvador", state: "BA", zip: "40020-000" },
  { city: "Fortaleza", state: "CE", zip: "60040-230" }
];

const PRODUCT_NAMES = [
  "Notebook Dell Inspiron 15",
  "Smart TV Samsung 55\" 4K",
  "iPhone 13 Pro Max 256GB",
  "Ar Condicionado Split 12000 BTUs",
  "Geladeira Brastemp Frost Free",
  "Cadeira Gamer DXRacer",
  "Mouse Logitech MX Master 3",
  "Teclado Mecânico Keychron K8",
  "Monitor LG 27\" UltraWide",
  "Headset HyperX Cloud II"
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
    const location = pick(CITIES);
    const customerName = pick(CUSTOMER_NAMES);
    
    const itemCount = 1 + (i % 3);
    const items = Array.from({ length: itemCount }, (_, idx) => {
      const price = 100 + Math.random() * 2900;
      const qty = 1 + ((i * 3 + idx) % 5);
      return {
        sku: `TP${String(16 + ((i + idx) % 50)).padStart(7, "0")}`, // Formato real SAP: TP0000016
        itemDescription: pick(PRODUCT_NAMES),
        quantity: qty,
        price: Math.round(price * 100) / 100,
        warehouseCode: `0${(i % 3) + 1}.0${(i % 3) + 1}`, // Formato real SAP: 02.02, 01.01
        measureUnit: "UN",
        lineTotal: Math.round(price * qty * 100) / 100,
        lineStatus: status === "DESPACHADO" ? "bost_Close" : "bost_Open"
      };
    });

    const docTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    
    const order: UiOrder = {
      orderId,
      externalOrderId: String(sapDocNum), // DocNum do SAP (número visível)
      sapDocEntry, // DocEntry do SAP (chave interna)
      sapDocNum,
      customerId: `C${String(369 + (i % 25)).padStart(5, "0")}`, // Formato real SAP: C00369
      customerName,
      shipToCode: `END-${i % 5}`,
      shipToAddress: `Rua Exemplo, ${100 + i * 10}`,
      shipToCity: location.city,
      shipToState: location.state,
      shipToZipCode: location.zip,
      status,
      sapStatus: status === "DESPACHADO" ? "bost_Close" : "bost_Open",
      cancelled: false,
      carrier,
      priority,
      docDate: iso(createdAt), // DocDate do SAP
      docDueDate: iso(slaDueAt), // DocDueDate do SAP
      slaDueAt: iso(slaDueAt), // SLA calculado pelo WMS (pode usar docDueDate)
      docTotal: Math.round(docTotal * 100) / 100,
      currency: "R$", // SAP retorna "R$" (não "BRL")
      discountPercent: Math.random() < 0.2 ? Math.round(Math.random() * 10) : 0,
      comments: Math.random() < 0.3 
        ? "Cliente solicitou entrega expressa" 
        : null,
      items,
      createdAt: iso(createdAt),
      updatedAt: iso(updatedAt),
      metadata: { 
        origin: "SAP_B1", 
        docEntry: sapDocEntry,
        documentStatus: status === "DESPACHADO" ? "bost_Close" : "bost_Open"
      },
      pendingIssues:
        Math.random() < 0.28
          ? ["Endereço incompleto", "Divergência de item (SKU)"]
          : [],
      scanHistory:
        status === "EM_SEPARACAO" || status === "CONFERIDO"
          ? items.slice(0, Math.min(items.length, 2)).map((item, idx) => ({
              at: iso(new Date(updatedAt.getTime() - (9 - idx * 5) * 60 * 1000)),
              by: "bipador-01",
              sku: item.sku,
              quantity: 1
            }))
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

