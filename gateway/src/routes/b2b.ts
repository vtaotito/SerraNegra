import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createSapClient } from "../config/sap.js";
import { SapOrdersService } from "../services/sapOrdersService.js";
import { SapEntitiesService } from "../services/sapEntitiesService.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import jwt from "jsonwebtoken";

const B2B_JWT_SECRET = process.env.B2B_JWT_SECRET ?? process.env.INTERNAL_SHARED_SECRET ?? "b2b-secret-change-me";
const B2B_JWT_EXPIRES = "24h";

interface B2BTokenPayload {
  cardCode: string;
  cardName: string;
  email?: string;
  type: "b2b_customer";
}

function signB2BToken(payload: B2BTokenPayload): string {
  return jwt.sign(payload, B2B_JWT_SECRET, {
    expiresIn: B2B_JWT_EXPIRES,
    issuer: "wms-b2b",
  });
}

function verifyB2BToken(token: string): B2BTokenPayload {
  return jwt.verify(token, B2B_JWT_SECRET, { issuer: "wms-b2b" }) as B2BTokenPayload;
}

async function b2bAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Token ausente" });
    return;
  }
  try {
    const payload = verifyB2BToken(authHeader.slice(7));
    (req as any).b2bCustomer = payload;
  } catch {
    reply.code(401).send({ error: "Token inválido ou expirado" });
  }
}

export async function registerB2BRoutes(app: FastifyInstance) {
  let sapOrdersService: SapOrdersService | null = null;
  let sapEntitiesService: SapEntitiesService | null = null;

  function getSapClient() {
    const logger = {
      debug: (msg: string, meta?: Record<string, unknown>) => app.log.debug(meta, msg),
      info: (msg: string, meta?: Record<string, unknown>) => app.log.info(meta, msg),
      warn: (msg: string, meta?: Record<string, unknown>) => app.log.warn(meta, msg),
      error: (msg: string, meta?: Record<string, unknown>) => app.log.error(meta, msg),
    };
    const storedClient = sapConfigStore.getClient(logger);
    if (storedClient) return storedClient;
    return createSapClient(logger);
  }

  function getOrdersService() {
    if (!sapOrdersService) {
      sapOrdersService = new SapOrdersService(getSapClient());
    }
    return sapOrdersService;
  }

  function getEntitiesService() {
    if (!sapEntitiesService) {
      sapEntitiesService = new SapEntitiesService(getSapClient());
    }
    return sapEntitiesService;
  }

  // =============================================
  // AUTH
  // =============================================

  app.post("/b2b/auth/login", async (req, reply) => {
    const { cardCode, password } = req.body as any;
    const correlationId = (req as any).correlationId as string;

    if (!cardCode) {
      reply.code(400).send({ error: "Campo 'cardCode' é obrigatório" });
      return;
    }

    try {
      const entSvc = getEntitiesService();
      const partners = await entSvc.listBusinessPartners({ limit: 500 }, correlationId);
      const customer = partners.find(
        (bp) => bp.CardCode?.toLowerCase() === cardCode.toLowerCase() && bp.CardType === "cCustomer"
      );

      if (!customer) {
        reply.code(401).send({ error: "Cliente não encontrado" });
        return;
      }

      if (customer.Valid === "tNO" || customer.Frozen === "tYES") {
        reply.code(403).send({ error: "Cliente inativo ou bloqueado" });
        return;
      }

      const token = signB2BToken({
        cardCode: customer.CardCode,
        cardName: customer.CardName ?? customer.CardCode,
        email: customer.EmailAddress ?? undefined,
        type: "b2b_customer",
      });

      reply.code(200).send({
        token,
        customer: {
          cardCode: customer.CardCode,
          cardName: customer.CardName,
          email: customer.EmailAddress,
          phone: customer.Phone1,
          address: customer.Address,
          city: customer.City,
          state: customer.State,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao autenticar";
      req.log.error({ error, correlationId }, "Erro no login B2B");
      reply.code(500).send({ error: "Erro ao autenticar", message });
    }
  });

  app.get("/b2b/auth/me", { preHandler: b2bAuth }, async (req, reply) => {
    const customer = (req as any).b2bCustomer as B2BTokenPayload;
    const correlationId = (req as any).correlationId as string;

    try {
      const entSvc = getEntitiesService();
      const partners = await entSvc.listBusinessPartners({ limit: 500 }, correlationId);
      const bp = partners.find((p) => p.CardCode === customer.cardCode);

      if (!bp) {
        reply.code(404).send({ error: "Cliente não encontrado" });
        return;
      }

      reply.code(200).send({
        cardCode: bp.CardCode,
        cardName: bp.CardName,
        email: bp.EmailAddress,
        phone: bp.Phone1,
        address: bp.Address,
        city: bp.City,
        state: bp.State,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: message });
    }
  });

  // =============================================
  // CATÁLOGO DE PRODUTOS
  // =============================================

  app.get("/b2b/products", { preHandler: b2bAuth }, async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const query = req.query as any;
    const search = (query.search as string)?.toLowerCase();
    const limit = query.limit ? Number(query.limit) : 100;

    try {
      const entSvc = getEntitiesService();
      let items = await entSvc.listItems({ limit: 500, onlyActive: true }, correlationId);

      const salesItems = items.filter((i) => i.SalesItem === "tYES" || !i.SalesItem);

      let filtered = salesItems;
      if (search) {
        filtered = salesItems.filter(
          (i) =>
            i.ItemCode?.toLowerCase().includes(search) ||
            i.ItemName?.toLowerCase().includes(search) ||
            i.BarCode?.toLowerCase().includes(search)
        );
      }

      const result = filtered.slice(0, limit).map((item) => ({
        sku: item.ItemCode,
        name: item.ItemName ?? item.ItemCode,
        ean: item.BarCode ?? null,
        unit: item.InventoryUOM ?? "UN",
        group: item.ItemsGroupCode ?? null,
        active: item.Valid === "tYES" && item.Frozen !== "tYES",
      }));

      reply.code(200).send({ items: result, total: result.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error, correlationId }, "Erro ao listar produtos B2B");
      reply.code(500).send({ error: "Erro ao buscar produtos", message });
    }
  });

  app.get("/b2b/products/:sku/stock", { preHandler: b2bAuth }, async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const { sku } = req.params as any;

    try {
      const entSvc = getEntitiesService();
      const inventory = await entSvc.listInventory({ limit: 1000 }, correlationId);
      const itemStock = inventory.filter((i) => i.ItemCode === sku);

      const totalOnHand = itemStock.reduce((sum, i) => sum + i.InStock, 0);
      const totalCommitted = itemStock.reduce((sum, i) => sum + i.Committed, 0);
      const available = totalOnHand - totalCommitted;

      reply.code(200).send({
        sku,
        totalOnHand,
        totalCommitted,
        available: available > 0 ? available : 0,
        warehouses: itemStock.map((w) => ({
          code: w.WarehouseCode,
          onHand: w.InStock,
          committed: w.Committed,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: "Erro ao buscar estoque", message });
    }
  });

  // =============================================
  // PEDIDOS DO CLIENTE
  // =============================================

  app.get("/b2b/orders", { preHandler: b2bAuth }, async (req, reply) => {
    const customer = (req as any).b2bCustomer as B2BTokenPayload;
    const correlationId = (req as any).correlationId as string;
    const query = req.query as any;
    const status = query.status as string | undefined;

    try {
      const service = getOrdersService();
      const allOrders = await service.listOrders(
        { docStatus: query.docStatus ?? "O", limit: 200 },
        correlationId
      );

      let customerOrders = allOrders.filter(
        (o) => o.customerId?.toLowerCase() === customer.cardCode.toLowerCase()
      );

      if (status) {
        customerOrders = customerOrders.filter((o) => o.status === status);
      }

      reply.code(200).send({
        items: customerOrders,
        total: customerOrders.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error, correlationId }, "Erro ao listar pedidos B2B");
      reply.code(500).send({ error: "Erro ao buscar pedidos", message });
    }
  });

  app.get("/b2b/orders/:docEntry", { preHandler: b2bAuth }, async (req, reply) => {
    const customer = (req as any).b2bCustomer as B2BTokenPayload;
    const correlationId = (req as any).correlationId as string;
    const { docEntry } = req.params as any;

    try {
      const service = getOrdersService();
      const order = await service.getOrder(Number(docEntry), correlationId);

      if (order.customerId?.toLowerCase() !== customer.cardCode.toLowerCase()) {
        reply.code(403).send({ error: "Acesso negado a este pedido" });
        return;
      }

      reply.code(200).send(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: "Erro ao buscar pedido", message });
    }
  });

  app.post("/b2b/orders", { preHandler: b2bAuth }, async (req, reply) => {
    const customer = (req as any).b2bCustomer as B2BTokenPayload;
    const correlationId = (req as any).correlationId as string;
    const body = req.body as any;

    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      reply.code(400).send({ error: "Campo 'items' é obrigatório (array de {sku, quantity})" });
      return;
    }

    try {
      const client = getSapClient();

      const documentLines = body.items.map((item: any, idx: number) => ({
        LineNum: idx,
        ItemCode: item.sku,
        Quantity: item.quantity,
        WarehouseCode: item.warehouse ?? undefined,
      }));

      const sapOrder = {
        CardCode: customer.cardCode,
        DocDueDate: body.dueDate ?? new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        Comments: body.notes ?? `Pedido via Portal B2B - ${customer.cardName}`,
        U_WMS_STATUS: "A_SEPARAR",
        U_WMS_ORDERID: `B2B-${Date.now()}`,
        DocumentLines: documentLines,
      };

      const response = await client.post<any>("/Orders", sapOrder, { correlationId });
      const created = response.data;

      reply.code(201).send({
        ok: true,
        message: "Pedido criado com sucesso",
        docEntry: created.DocEntry,
        docNum: created.DocNum,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar pedido";
      req.log.error({ error, correlationId }, "Erro ao criar pedido B2B");
      reply.code(500).send({ error: "Erro ao criar pedido", message });
    }
  });

  // =============================================
  // DASHBOARD RÁPIDO
  // =============================================

  app.get("/b2b/dashboard", { preHandler: b2bAuth }, async (req, reply) => {
    const customer = (req as any).b2bCustomer as B2BTokenPayload;
    const correlationId = (req as any).correlationId as string;

    try {
      const service = getOrdersService();
      const openOrders = await service.listOrders({ docStatus: "O", limit: 200 }, correlationId);
      const myOrders = openOrders.filter(
        (o) => o.customerId?.toLowerCase() === customer.cardCode.toLowerCase()
      );

      const byStatus: Record<string, number> = {};
      for (const o of myOrders) {
        byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      }

      reply.code(200).send({
        totalOrders: myOrders.length,
        ordersByStatus: byStatus,
        recentOrders: myOrders.slice(0, 5),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: message });
    }
  });

  app.log.info("Rotas B2B registradas");
}
