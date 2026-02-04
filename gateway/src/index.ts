import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { request } from "undici";
import { v4 as uuidv4 } from "uuid";
import { registerSapRoutes } from "./routes/sap.js";

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

await app.listen({ port: GATEWAY_PORT, host: "0.0.0.0" });
app.log.info(`Gateway online em :${GATEWAY_PORT}`);

