import type { FastifyInstance } from "fastify";
import { createSapClient } from "../config/sap.js";
import { SapOrdersService } from "../services/sapOrdersService.js";

/**
 * Registra rotas de integração SAP.
 */
export async function registerSapRoutes(app: FastifyInstance) {
  // Lazy initialization do cliente SAP (só cria quando necessário)
  let sapService: SapOrdersService | null = null;

  function getSapService() {
    if (!sapService) {
      const logger = {
        debug: (msg: string, meta?: Record<string, unknown>) =>
          app.log.debug(meta, msg),
        info: (msg: string, meta?: Record<string, unknown>) =>
          app.log.info(meta, msg),
        warn: (msg: string, meta?: Record<string, unknown>) =>
          app.log.warn(meta, msg),
        error: (msg: string, meta?: Record<string, unknown>) =>
          app.log.error(meta, msg)
      };

      try {
        const client = createSapClient(logger);
        sapService = new SapOrdersService(client);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao criar cliente SAP";
        app.log.error({ error }, "Falha ao criar cliente SAP");
        throw new Error(message);
      }
    }
    return sapService;
  }

  /**
   * GET /api/sap/health
   * Testa conexão com SAP (faz login mas não retorna segredos).
   */
  app.get("/sap/health", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;

    try {
      const service = getSapService();
      const result = await service.healthCheck(correlationId);

      if (result.ok) {
        reply.code(200).send({
          status: "ok",
          message: result.message,
          timestamp: new Date().toISOString()
        });
      } else {
        reply.code(503).send({
          status: "error",
          message: result.message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error, correlationId }, "Erro no health check SAP");

      reply.code(503).send({
        status: "error",
        message: "Erro ao conectar com SAP",
        details: message,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/sap/orders
   * Lista pedidos do SAP com filtros opcionais.
   * Query params:
   *   - status: filtro por U_WMS_STATUS (opcional)
   *   - limit: número máximo de resultados (default: 100)
   *   - docStatus: filtro por DocStatus SAP ("O" = Open, "C" = Closed)
   */
  app.get("/sap/orders", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const query = req.query as any;

    try {
      const service = getSapService();
      const orders = await service.listOrders(
        {
          status: query.status,
          limit: query.limit ? Number(query.limit) : undefined,
          docStatus: query.docStatus
        },
        correlationId
      );

      reply.code(200).send({
        items: orders,
        count: orders.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error, correlationId }, "Erro ao listar pedidos SAP");

      reply.code(500).send({
        error: "Erro ao buscar pedidos do SAP",
        message,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/sap/orders/:docEntry
   * Busca um pedido específico pelo DocEntry.
   */
  app.get("/sap/orders/:docEntry", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const { docEntry } = req.params as any;

    try {
      const docEntryNum = Number(docEntry);
      if (isNaN(docEntryNum)) {
        reply.code(400).send({
          error: "docEntry inválido",
          message: "docEntry deve ser um número",
          timestamp: new Date().toISOString()
        });
        return;
      }

      const service = getSapService();
      const order = await service.getOrder(docEntryNum, correlationId);

      reply.code(200).send(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error, correlationId, docEntry }, "Erro ao buscar pedido SAP");

      // Se for 404 do SAP, retornar 404
      const statusCode = message.includes("404") || message.includes("not found") ? 404 : 500;

      reply.code(statusCode).send({
        error: "Erro ao buscar pedido do SAP",
        message,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * PATCH /api/sap/orders/:docEntry/status
   * Atualiza o status do pedido no SAP (via UDF U_WMS_STATUS).
   * Body: { status: "EM_SEPARACAO" | "CONFERIDO" | etc., event?: string }
   */
  app.patch("/sap/orders/:docEntry/status", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const { docEntry } = req.params as any;
    const body = req.body as any;

    try {
      const docEntryNum = Number(docEntry);
      if (isNaN(docEntryNum)) {
        reply.code(400).send({
          error: "docEntry inválido",
          message: "docEntry deve ser um número",
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!body?.status) {
        reply.code(400).send({
          error: "Requisição inválida",
          message: "Campo 'status' é obrigatório",
          timestamp: new Date().toISOString()
        });
        return;
      }

      const service = getSapService();
      const result = await service.updateOrderStatus(docEntryNum, {
        status: body.status,
        event: body.event,
        correlationId
      });

      if (result.ok) {
        reply.code(200).send({
          ok: true,
          message: result.message,
          docEntry: docEntryNum,
          status: body.status,
          timestamp: new Date().toISOString()
        });
      } else {
        reply.code(500).send({
          ok: false,
          message: result.message,
          docEntry: docEntryNum,
          correlationId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error, correlationId, docEntry }, "Erro ao atualizar status no SAP");

      reply.code(500).send({
        error: "Erro ao atualizar status no SAP",
        message,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/sap/sync
   * Sincroniza pedidos do SAP para o WMS Core.
   * Busca pedidos abertos do SAP e cria no WMS Core via POST /orders.
   */
  app.post("/sap/sync", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;

    try {
      const service = getSapService();
      
      // Buscar pedidos abertos do SAP
      req.log.info({ correlationId }, "Iniciando sincronização de pedidos do SAP");
      const sapOrders = await service.listOrders(
        {
          docStatus: "O", // Apenas pedidos abertos
          limit: 100
        },
        correlationId
      );

      req.log.info({ count: sapOrders.length, correlationId }, `${sapOrders.length} pedidos encontrados no SAP`);

      let imported = 0;
      const errors: Array<{ orderId: string; error: string }> = [];

      // Importar cada pedido para o WMS Core
      for (const sapOrder of sapOrders) {
        try {
          // Verificar se já existe no WMS Core pelo externalOrderId
          const checkUrl = `${process.env.CORE_BASE_URL ?? "http://localhost:8000"}/orders?externalOrderId=${sapOrder.externalOrderId}`;
          const checkRes = await fetch(checkUrl, {
            headers: {
              "x-correlation-id": correlationId
            }
          });

          if (checkRes.ok) {
            const existingOrders = await checkRes.json();
            if (existingOrders.items && existingOrders.items.length > 0) {
              req.log.debug(
                { externalOrderId: sapOrder.externalOrderId, correlationId },
                "Pedido já existe no WMS, pulando"
              );
              continue; // Já existe, pular
            }
          }

          // Criar pedido no WMS Core
          const createUrl = `${process.env.CORE_BASE_URL ?? "http://localhost:8000"}/orders`;
          const createRes = await fetch(createUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-correlation-id": correlationId
            },
            body: JSON.stringify({
              externalOrderId: sapOrder.externalOrderId,
              customerId: sapOrder.customerId,
              items: sapOrder.items.map((item) => ({
                sku: item.sku,
                quantity: item.quantity
              })),
              metadata: {
                source: "SAP_B1",
                sapDocEntry: sapOrder.sapDocEntry,
                sapDocNum: sapOrder.sapDocNum,
                customerName: sapOrder.customerName,
                docTotal: sapOrder.docTotal,
                currency: sapOrder.currency
              }
            })
          });

          if (!createRes.ok) {
            const errorText = await createRes.text();
            throw new Error(`Erro ao criar pedido (${createRes.status}): ${errorText}`);
          }

          imported++;
          req.log.info(
            { externalOrderId: sapOrder.externalOrderId, correlationId },
            "Pedido importado com sucesso"
          );
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          req.log.error(
            { orderId: sapOrder.orderId, error: errorMessage, correlationId },
            "Erro ao importar pedido"
          );
          errors.push({
            orderId: sapOrder.orderId,
            error: errorMessage
          });
        }
      }

      req.log.info({ imported, errors: errors.length, correlationId }, "Sincronização concluída");

      reply.code(200).send({
        ok: true,
        message: `Sincronização concluída: ${imported} pedido(s) importado(s)`,
        imported,
        total: sapOrders.length,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error, correlationId }, "Erro na sincronização SAP");

      reply.code(500).send({
        ok: false,
        message: "Erro ao sincronizar pedidos do SAP",
        details: message,
        imported: 0,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/sap/cache/stats
   * Retorna estatísticas dos caches
   */
  app.get("/sap/cache/stats", async (req, reply) => {
    const { CacheFactory } = await import("../utils/cache.js");
    const stats = CacheFactory.getAllStats();

    reply.code(200).send({
      caches: stats,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * DELETE /api/sap/cache
   * Limpa todos os caches
   */
  app.delete("/sap/cache", async (req, reply) => {
    const { CacheFactory } = await import("../utils/cache.js");
    CacheFactory.flushAll();

    reply.code(200).send({
      ok: true,
      message: "Todos os caches foram limpos",
      timestamp: new Date().toISOString()
    });
  });

  app.log.info("Rotas SAP registradas (com cache)");
}
