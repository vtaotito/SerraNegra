import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { request } from "undici";
import { v4 as uuidv4 } from "uuid";
<<<<<<< Current (Your changes)
import { getSapService } from "./sapService.js";
import type { SapOrdersFilter, SapOrderStatusUpdate } from "../../sap-connector/src/sapTypes.js";
=======
import { registerSapRoutes } from "./routes/sap.js";
>>>>>>> Incoming (Background Agent changes)

type GatewayEvent =
  | { type: "order.created"; orderId: string; status: string; occurredAt: string; correlationId: string }
  | { type: "order.updated"; orderId: string; previousStatus: string; currentStatus: string; occurredAt: string; correlationId: string };

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? "3000");
const CORE_BASE_URL = process.env.CORE_BASE_URL ?? "http://localhost:8000";
const SERVICE_NAME = process.env.SERVICE_NAME ?? "wms-gateway";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET ?? "dev-internal-secret";

const app = Fastify({
  logger: {
    level: LOG_LEVEL,
    base: { service: SERVICE_NAME }
  }
});

// Conexões SSE + WS em memória (MVP). Em produção: Redis pubsub/stream.
const sseClients = new Set<NodeJS.WritableStream>();
const wsClients = new Set<import("ws").WebSocket>();

function writeSse(res: NodeJS.WritableStream, ev: GatewayEvent) {
  res.write(`event: ${ev.type}\n`);
  res.write(`data: ${JSON.stringify(ev)}\n\n`);
}

function broadcast(ev: GatewayEvent) {
  const payload = JSON.stringify(ev);
  for (const res of sseClients) {
    try {
      writeSse(res, ev);
    } catch {
      // ignore
    }
  }
  for (const ws of wsClients) {
    try {
      ws.send(payload);
    } catch {
      // ignore
    }
  }
}

app.addHook("onRequest", async (req, reply) => {
  const incoming = req.headers["x-correlation-id"];
  const correlationId = typeof incoming === "string" && incoming.length > 0 ? incoming : uuidv4();
  (req as any).correlationId = correlationId;
  reply.header("X-Correlation-Id", correlationId);

  // child logger por request
  req.log = req.log.child({ correlationId });
});

app.get("/health", async () => ({ ok: true }));

// Registrar rotas SAP
await registerSapRoutes(app);

// SSE: /events (dashboard)
app.get("/events", async (req, reply) => {
  reply
    .header("Content-Type", "text/event-stream; charset=utf-8")
    .header("Cache-Control", "no-cache, no-transform")
    .header("Connection", "keep-alive")
    .header("X-Accel-Buffering", "no");

  const res = reply.raw;
  sseClients.add(res);

  // hello
  const correlationId = (req as any).correlationId as string;
  res.write(`event: hello\n`);
  res.write(`data: ${JSON.stringify({ service: SERVICE_NAME, correlationId, ts: new Date().toISOString() })}\n\n`);

  req.log.info("SSE conectado.");

  req.raw.on("close", () => {
    sseClients.delete(res);
    req.log.info("SSE desconectado.");
  });
});

// WebSocket: /ws (dashboard)
await app.register(websocket);
app.get(
  "/ws",
  { websocket: true },
  (conn, req) => {
    const ws = ((conn as any).socket ?? conn) as import("ws").WebSocket;
    wsClients.add(ws);
    const correlationId = (req as any).correlationId as string;
    req.log.info("WS conectado.");

    ws.send(JSON.stringify({ type: "hello", service: SERVICE_NAME, correlationId, ts: new Date().toISOString() }));
    ws.on("close", () => {
      wsClients.delete(ws);
      req.log.info("WS desconectado.");
    });
  }
);

async function forwardToCore(req: any, method: string, path: string, body?: unknown) {
  const url = `${CORE_BASE_URL}${path}`;
  const correlationId = req.correlationId as string;
  const idempotencyKey = req.headers["idempotency-key"];

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-correlation-id": correlationId
  };
  if (typeof idempotencyKey === "string") headers["idempotency-key"] = idempotencyKey;

  const res = await request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.body.text();
  const contentType = res.headers["content-type"] ?? "application/json";
  const parsed = contentType.includes("application/json") && text.length ? JSON.parse(text) : text;

  return { statusCode: res.statusCode, body: parsed, headers: res.headers };
}

async function forwardToCoreWithQuery(req: any, method: string, path: string, query?: Record<string, unknown>) {
  const qs = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      qs.set(k, String(v));
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return await forwardToCore(req, method, `${path}${suffix}`);
}

app.post("/orders", async (req, reply) => {
  const result = await forwardToCore(req, "POST", "/orders", req.body);
  reply.code(result.statusCode).send(result.body);

  if (result.statusCode === 201 && result.body?.orderId) {
    const correlationId = (req as any).correlationId as string;
    broadcast({
      type: "order.created",
      orderId: result.body.orderId,
      status: result.body.status,
      occurredAt: new Date().toISOString(),
      correlationId
    });
  }
});

app.get("/orders", async (req, reply) => {
  const result = await forwardToCoreWithQuery(req, "GET", "/orders", (req as any).query);
  reply.code(result.statusCode).send(result.body);
});

app.get("/orders/:orderId", async (req, reply) => {
  const { orderId } = req.params as any;
  const result = await forwardToCore(req, "GET", `/orders/${orderId}`);
  reply.code(result.statusCode).send(result.body);
});

app.post("/orders/:orderId/events", async (req, reply) => {
  const { orderId } = req.params as any;
  const result = await forwardToCore(req, "POST", `/orders/${orderId}/events`, req.body);
  reply.code(result.statusCode).send(result.body);

  if (result.statusCode === 200 && result.body?.orderId) {
    const correlationId = (req as any).correlationId as string;
    broadcast({
      type: "order.updated",
      orderId: result.body.orderId,
      previousStatus: result.body.previousStatus,
      currentStatus: result.body.currentStatus,
      occurredAt: new Date().toISOString(),
      correlationId
    });
  }
});

app.get("/orders/:orderId/history", async (req, reply) => {
  const { orderId } = req.params as any;
  const result = await forwardToCore(req, "GET", `/orders/${orderId}/history`);
  reply.code(result.statusCode).send(result.body);
});

// Endpoint interno para publicar eventos no stream (ex.: worker de sync SAP)
app.post("/internal/events", async (req, reply) => {
  const secret = req.headers["x-internal-secret"];
  if (secret !== INTERNAL_SHARED_SECRET) {
    reply.code(403).send({ error: "forbidden" });
    return;
  }
  if (!req.body || typeof req.body !== "object") {
    reply.code(400).send({ error: "invalid_body" });
    return;
  }
  broadcast(req.body as GatewayEvent);
  reply.code(202).send({ ok: true });
});

// ========== ROTAS SAP ==========

/**
 * GET /api/sap/health
 * Testa a conexão com o SAP (não expõe credenciais)
 * Formato esperado: { ok: boolean, message: string, timestamp: string }
 */
app.get("/api/sap/health", async (req, reply) => {
  const correlationId = (req as any).correlationId as string;
  req.log.info({ correlationId, action: "sap.health.check" }, "Testando conexão SAP");

  try {
    const sapService = getSapService(req.log);
    const result = await sapService.healthCheck(correlationId);
    
    const statusCode = result.ok ? 200 : 503;
    
    reply.code(statusCode).send({ 
      ok: result.ok, 
      message: result.message,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    req.log.error({ 
      err: err instanceof Error ? { name: err.name, message: err.message } : { value: String(err) },
      correlationId,
      action: "sap.health.check.error"
    }, "Erro ao testar conexão SAP");
    
    reply.code(500).send({ 
      ok: false, 
      message: "Erro interno ao testar conexão SAP",
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sap/orders
 * Busca pedidos do SAP com filtros
 * Query params: status (open/closed/all), cardCode, fromDate, toDate, limit, skip
 * Formato esperado: { orders: SapOrder[], count: number, timestamp: string }
 */
app.get("/api/sap/orders", async (req, reply) => {
  const correlationId = (req as any).correlationId as string;
  const query = (req as any).query as Record<string, any>;

  const filter: SapOrdersFilter = {
    status: query.status || "open",
    cardCode: query.cardCode,
    fromDate: query.fromDate,
    toDate: query.toDate,
    limit: query.limit ? Number(query.limit) : 100,
    skip: query.skip ? Number(query.skip) : 0
  };

  req.log.info({ 
    filter: { ...filter, cardCode: filter.cardCode ? "[REDACTED]" : undefined }, // Não logar código do cliente se sensível
    correlationId,
    action: "sap.orders.list"
  }, "Buscando pedidos do SAP");

  try {
    const sapService = getSapService(req.log);
    const orders = await sapService.getOrders(filter, correlationId);
    
    req.log.info({ 
      count: orders.length, 
      correlationId,
      action: "sap.orders.list.success"
    }, "Pedidos retornados do SAP");
    
    reply.code(200).send({ 
      orders,
      count: orders.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    req.log.error({ 
      err: err instanceof Error ? { name: err.name, message: err.message } : { value: String(err) },
      correlationId,
      action: "sap.orders.list.error"
    }, "Erro ao buscar pedidos do SAP");
    
    reply.code(500).send({ 
      error: "Erro ao buscar pedidos do SAP",
      message: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/sap/orders/:docEntry
 * Busca um pedido específico pelo DocEntry
 * Formato esperado: { order: SapOrder, timestamp: string }
 */
app.get("/api/sap/orders/:docEntry", async (req, reply) => {
  const correlationId = (req as any).correlationId as string;
  const { docEntry } = req.params as any;
  const docEntryNum = Number(docEntry);

  if (isNaN(docEntryNum)) {
    req.log.warn({ docEntry, correlationId, action: "sap.order.get.invalid" }, "DocEntry inválido");
    reply.code(400).send({ 
      error: "DocEntry inválido (deve ser um número)",
      timestamp: new Date().toISOString()
    });
    return;
  }

  req.log.info({ 
    docEntry: docEntryNum, 
    correlationId,
    action: "sap.order.get"
  }, "Buscando pedido específico do SAP");

  try {
    const sapService = getSapService(req.log);
    const order = await sapService.getOrder(docEntryNum, correlationId);
    
    req.log.info({ 
      docEntry: docEntryNum, 
      correlationId,
      action: "sap.order.get.success"
    }, "Pedido retornado do SAP");
    
    reply.code(200).send({ 
      order,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = message.includes("não encontrado") ? 404 : 500;
    
    req.log.error({ 
      err: err instanceof Error ? { name: err.name, message: err.message } : { value: message },
      docEntry: docEntryNum, 
      correlationId,
      action: "sap.order.get.error"
    }, "Erro ao buscar pedido do SAP");
    
    reply.code(statusCode).send({ 
      error: "Erro ao buscar pedido do SAP",
      message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PATCH /api/sap/orders/:docEntry/status
 * Atualiza o status WMS de um pedido no SAP (via UDFs)
 * Body: { status, orderId?, lastEvent? }
 * Formato esperado: { ok: boolean, message: string, docEntry: number, status: string, timestamp: string }
 */
app.patch("/api/sap/orders/:docEntry/status", async (req, reply) => {
  const correlationId = (req as any).correlationId as string;
  const { docEntry } = req.params as any;
  const docEntryNum = Number(docEntry);

  if (isNaN(docEntryNum)) {
    req.log.warn({ docEntry, correlationId, action: "sap.order.status.update.invalid" }, "DocEntry inválido");
    reply.code(400).send({ 
      error: "DocEntry inválido (deve ser um número)",
      timestamp: new Date().toISOString()
    });
    return;
  }

  const body = req.body as any;
  if (!body || typeof body !== "object" || !body.status) {
    req.log.warn({ docEntry: docEntryNum, correlationId, action: "sap.order.status.update.invalid_body" }, "Body inválido");
    reply.code(400).send({ 
      error: "Body inválido (deve conter 'status')",
      timestamp: new Date().toISOString()
    });
    return;
  }

  const update: SapOrderStatusUpdate = {
    U_WMS_STATUS: body.status,
    U_WMS_ORDERID: body.orderId,
    U_WMS_LAST_EVENT: body.lastEvent,
    U_WMS_LAST_TS: new Date().toISOString(),
    U_WMS_CORR_ID: correlationId
  };

  req.log.info({ 
    docEntry: docEntryNum, 
    status: body.status,
    orderId: body.orderId,
    correlationId,
    action: "sap.order.status.update"
  }, "Atualizando status do pedido no SAP");

  try {
    const sapService = getSapService(req.log);
    await sapService.updateOrderStatus(docEntryNum, update, correlationId);
    
    req.log.info({ 
      docEntry: docEntryNum, 
      status: body.status,
      correlationId,
      action: "sap.order.status.update.success"
    }, "Status atualizado com sucesso no SAP");
    
    reply.code(200).send({ 
      ok: true,
      message: "Status atualizado com sucesso",
      docEntry: docEntryNum,
      status: body.status,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = message.includes("não encontrado") ? 404 : 500;
    
    req.log.error({ 
      err: err instanceof Error ? { name: err.name, message: err.message } : { value: message },
      docEntry: docEntryNum, 
      correlationId,
      action: "sap.order.status.update.error"
    }, "Erro ao atualizar status no SAP");
    
    reply.code(statusCode).send({ 
      error: "Erro ao atualizar status no SAP",
      message,
      timestamp: new Date().toISOString()
    });
  }
});

await app.listen({ port: GATEWAY_PORT, host: "0.0.0.0" });
app.log.info(`Gateway online em :${GATEWAY_PORT}`);

