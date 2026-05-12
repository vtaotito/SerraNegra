import type { FastifyInstance } from "fastify";
import { createSapClient } from "../config/sap.js";
import { SapOrdersService } from "../services/sapOrdersService.js";
import { SapEntitiesService } from "../services/sapEntitiesService.js";
import { InventoryEnrichmentService } from "../services/inventoryEnrichmentService.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import { runSalesOrdersSync, runInvoicesSync, querySalesOrders, queryInvoices, querySyncHistory, queryDbStats, queryProductAnalytics, queryProductOrders } from "../scheduler/dailySync.js";

/**
 * Registra rotas de integração SAP.
 */
export async function registerSapRoutes(app: FastifyInstance) {
  // Lazy initialization do cliente SAP (só cria quando necessário)
  let sapService: SapOrdersService | null = null;
  let entitiesService: SapEntitiesService | null = null;

  function getSapClient() {
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

    // Tentar usar configuração do store primeiro
    const storedClient = sapConfigStore.getClient(logger);
    if (storedClient) {
      app.log.info("Cliente SAP criado a partir de configuração armazenada");
      return storedClient;
    }
    // Fallback para variáveis de ambiente
    const client = createSapClient(logger);
    app.log.info("Cliente SAP criado a partir de variáveis de ambiente");
    return client;
  }

  function getSapService() {
    if (!sapService) {
      try {
        const client = getSapClient();
        sapService = new SapOrdersService(client);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao criar cliente SAP";
        app.log.error({ error }, "Falha ao criar cliente SAP");
        throw new Error(message);
      }
    }
    return sapService;
  }

  function getEntitiesService() {
    if (!entitiesService) {
      try {
        const client = getSapClient();
        entitiesService = new SapEntitiesService(client);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao criar cliente SAP entities";
        app.log.error({ error }, "Falha ao criar entities service");
        throw new Error(message);
      }
    }
    return entitiesService;
  }

  function getInventoryEnrichment() {
    return new InventoryEnrichmentService(getEntitiesService());
  }

  /**
   * GET /api/sap/health
   * Testa conexão com SAP e retorna status completo para o frontend.
   */
  app.get("/sap/health", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const startTime = Date.now();

    try {
      const service = getSapService();
      const result = await service.healthCheck(correlationId);
      const responseTime = Date.now() - startTime;

      if (result.ok) {
        reply.code(200).send({
          status: "ok",
          sap_connected: true,
          session_valid: true,
          response_time_ms: responseTime,
          message: result.message,
          timestamp: new Date().toISOString()
        });
      } else {
        reply.code(200).send({
          status: "error",
          sap_connected: false,
          session_valid: false,
          response_time_ms: responseTime,
          message: result.message,
          error: result.message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      const responseTime = Date.now() - startTime;
      req.log.error({ error, correlationId }, "Erro no health check SAP");

      reply.code(200).send({
        status: "error",
        sap_connected: false,
        session_valid: false,
        response_time_ms: responseTime,
        message: "Erro ao conectar com SAP",
        error: message,
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
      // Suporte a OData-style params (frontend às vezes manda $top/$filter)
      const topRaw = query?.["$top"];
      const filterRaw = query?.["$filter"];

      const limit =
        query.limit !== undefined
          ? Number(query.limit)
          : topRaw !== undefined
            ? Number(topRaw)
            : undefined;

      let docStatus = query.docStatus as string | undefined;
      if (!docStatus && typeof filterRaw === "string") {
        // Ex.: DocumentStatus eq 'bost_Open'
        if (filterRaw.includes("bost_Open")) docStatus = "O";
        else if (filterRaw.includes("bost_Close")) docStatus = "C";
      }

      const orders = await service.listOrders(
        {
          status: query.status,
          limit: Number.isFinite(limit as number) ? limit : undefined,
          docStatus
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
      
      // Buscar pedidos abertos do SAP (já mapeados para WmsOrder)
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

          // Preparar dados com defaults para campos faltantes
          const customerId = sapOrder.customerId || `SAP_CUSTOMER_${sapOrder.sapDocEntry}`;
          const items = sapOrder.items.length > 0
            ? sapOrder.items.map((item) => ({ sku: item.sku, quantity: item.quantity }))
            : [{ sku: "PEDIDO_SAP", quantity: 1 }]; // Fallback se DocumentLines não expandiu

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
              customerId,
              items,
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
   * GET /api/sap/sync/status
   * Retorna status da última sincronização e informações gerais
   */
  app.get("/sap/sync/status", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;

    try {
      // Buscar status do Core (se disponível)
      const coreUrl = `${process.env.CORE_BASE_URL ?? "http://localhost:8000"}/orders`;
      const coreRes = await fetch(`${coreUrl}?limit=1&sort=-createdAt`, {
        headers: { "x-correlation-id": correlationId }
      });

      const lastSync = coreRes.ok ? await coreRes.json() : null;
      const lastSyncDate = lastSync?.items?.[0]?.createdAt || null;

      // Tentar contar pedidos abertos no SAP
      let sapOpenOrders = 0;
      try {
        const service = getSapService();
        const orders = await service.listOrders({ docStatus: "O", limit: 1000 }, correlationId);
        sapOpenOrders = orders.length;
      } catch (error) {
        req.log.warn({ error, correlationId }, "Erro ao contar pedidos abertos no SAP");
      }

      reply.code(200).send({
        last_sync_date: lastSyncDate,
        last_sync_count: lastSync?.total || 0,
        last_sync_status: lastSyncDate ? "SUCCESS" : null,
        sap_open_orders: sapOpenOrders,
        next_sync_estimate: "30 segundos (automático via Worker)",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error, correlationId }, "Erro ao buscar status de sincronização");

      reply.code(500).send({
        error: "Erro ao buscar status",
        message,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /sap/config
   * Retorna configuração atual do SAP (sem senha)
   */
  app.get("/sap/config", async (req, reply) => {
    // Tentar obter do store primeiro
    const storedConfig = sapConfigStore.get();
    
    if (storedConfig) {
      reply.code(200).send({
        baseUrl: storedConfig.baseUrl,
        companyDb: storedConfig.companyDb,
        username: storedConfig.username,
        source: "stored",
        savedAt: storedConfig.savedAt,
      });
      return;
    }

    // Fallback para variáveis de ambiente
    reply.code(200).send({
      baseUrl: process.env.SAP_B1_BASE_URL || "https://",
      companyDb: process.env.SAP_B1_COMPANY_DB || "",
      username: process.env.SAP_B1_USERNAME || "",
      source: "env",
    });
  });

  /**
   * PUT /sap/config
   * Atualiza e persiste configuração do SAP em memória
   */
  app.put("/sap/config", async (req, reply) => {
    const body = req.body as any;

    // Validação básica
    if (!body?.baseUrl || !body?.companyDb || !body?.username || !body?.password) {
      reply.code(400).send({
        error: "Campos obrigatórios: baseUrl, companyDb, username, password",
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      // Salvar configuração no store
      sapConfigStore.save({
        baseUrl: body.baseUrl,
        companyDb: body.companyDb,
        username: body.username,
        password: body.password,
        timeoutMs: body.timeoutMs || 60000,
        maxAttempts: body.maxAttempts || 3,
      });

      // Invalidar serviços existentes para usar nova configuração
      sapService = null;
      entitiesService = null;

      req.log.info(
        { baseUrl: body.baseUrl, companyDb: body.companyDb, username: body.username },
        "Configuração SAP salva em memória com sucesso"
      );

      reply.code(200).send({
        success: true,
        message: "Configuração salva com sucesso. Sessão SAP ativa para toda a aplicação.",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error }, "Erro ao salvar configuração SAP");

      reply.code(500).send({
        success: false,
        error: "Erro ao salvar configuração",
        message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/sap/config/test
   * Testa configuração SAP fornecida (não salva)
   */
  app.post("/sap/config/test", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const body = req.body as any;

    // Validação
    if (!body?.baseUrl || !body?.companyDb || !body?.username || !body?.password) {
      reply.code(400).send({
        success: false,
        message: "Campos obrigatórios: baseUrl, companyDb, username, password",
        timestamp: new Date().toISOString()
      });
      return;
    }

    const startTime = Date.now();

    try {
      // Criar cliente temporário com as credenciais fornecidas
      const { SapServiceLayerClient } = await import("../../../sap-connector/src/serviceLayerClient.js");
      
      const logger = {
        debug: (msg: string, meta?: Record<string, unknown>) => app.log.debug(meta, msg),
        info: (msg: string, meta?: Record<string, unknown>) => app.log.info(meta, msg),
        warn: (msg: string, meta?: Record<string, unknown>) => app.log.warn(meta, msg),
        error: (msg: string, meta?: Record<string, unknown>) => app.log.error(meta, msg)
      };

      const testClient = new SapServiceLayerClient({
        baseUrl: body.baseUrl,
        credentials: {
          companyDb: body.companyDb,
          username: body.username,
          password: body.password
        },
        logger
      });

      // Fazer login
      await testClient.login(correlationId);
      const connectionTime = Date.now() - startTime;

      reply.code(200).send({
        success: true,
        message: "Conexão bem-sucedida! Credenciais válidas.",
        connection_time_ms: connectionTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const connectionTime = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      
      req.log.error({ error, correlationId }, "Erro ao testar configuração SAP");

      reply.code(200).send({
        success: false,
        message: "Falha na conexão. Verifique as credenciais.",
        error: message,
        connection_time_ms: connectionTime,
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

  /**
   * DELETE /sap/config
   * Revoga acesso SAP (limpa configuração e sessão)
   */
  app.delete("/sap/config", async (req, reply) => {
    try {
      sapConfigStore.clear();
      sapService = null;
      entitiesService = null;

      req.log.info("Configuração SAP revogada e sessão limpa");

      reply.code(200).send({
        success: true,
        message: "Acesso SAP revogado com sucesso. Configuração e sessão removidas.",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error }, "Erro ao revogar acesso SAP");

      reply.code(500).send({
        success: false,
        error: "Erro ao revogar acesso",
        message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /sap/session/refresh
   * Força refresh da sessão SAP (re-login)
   */
  app.post("/sap/session/refresh", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;

    try {
      const service = getSapService();
      const client = (service as any).client as any;
      
      // Forçar novo login
      if (client && typeof client.login === 'function') {
        await client.login(correlationId);
        
        req.log.info({ correlationId }, "Sessão SAP renovada com sucesso");

        reply.code(200).send({
          success: true,
          message: "Sessão SAP renovada com sucesso",
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error("Cliente SAP não disponível");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      req.log.error({ error, correlationId }, "Erro ao renovar sessão SAP");

      reply.code(500).send({
        success: false,
        error: "Erro ao renovar sessão",
        message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // ========================================
  // SYNC COMPLETO: Todas as entidades
  // ========================================

  /**
   * POST /api/sap/sync/all
   * Sincroniza TODAS as entidades: Pedidos + Produtos + Estoque + Clientes.
   */
  app.post("/sap/sync/all", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const coreUrl = process.env.CORE_BASE_URL ?? "http://localhost:8000";
    const results: Record<string, { ok: boolean; imported: number; errors: number; message: string }> = {};

    // 1. Sync Pedidos (reutiliza lógica existente)
    try {
      const service = getSapService();
      const sapOrders = await service.listOrders({ docStatus: "O", limit: 100 }, correlationId);
      let imported = 0;
      for (const sapOrder of sapOrders) {
        try {
          const checkRes = await fetch(`${coreUrl}/orders?externalOrderId=${sapOrder.externalOrderId}`, {
            headers: { "x-correlation-id": correlationId }
          });
          if (checkRes.ok) {
            const existing = await checkRes.json();
            if (existing.items?.length > 0) continue;
          }
          const customerId = sapOrder.customerId || `SAP_CUSTOMER_${sapOrder.sapDocEntry}`;
          const items = sapOrder.items.length > 0
            ? sapOrder.items.map((item) => ({ sku: item.sku, quantity: item.quantity }))
            : [{ sku: "PEDIDO_SAP", quantity: 1 }];

          const createRes = await fetch(`${coreUrl}/orders`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-correlation-id": correlationId },
            body: JSON.stringify({
              externalOrderId: sapOrder.externalOrderId,
              customerId,
              items,
              metadata: {
                source: "SAP_B1",
                sapDocEntry: sapOrder.sapDocEntry,
                sapDocNum: sapOrder.sapDocNum,
                customerName: sapOrder.customerName,
                docTotal: sapOrder.docTotal,
                currency: sapOrder.currency,
              }
            })
          });
          if (createRes.ok) imported++;
        } catch { /* skip individual errors */ }
      }
      results.orders = { ok: true, imported, errors: sapOrders.length - imported, message: `${imported}/${sapOrders.length} pedidos` };
    } catch (error) {
      results.orders = { ok: false, imported: 0, errors: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 2. Sync Produtos (Items)
    try {
      const entSvc = getEntitiesService();
      const sapItems = await entSvc.listItems({ limit: 500 }, correlationId);
      const productsBulk = sapItems.map((item) => ({
        sku: item.ItemCode,
        description: item.ItemName || item.ItemCode,
        ean: item.BarCode || null,
        category: item.ItemsGroupCode ? `Grupo ${item.ItemsGroupCode}` : null,
        unit_of_measure: item.InventoryUOM || "UN",
        is_active: item.Valid === "tYES" && item.Frozen !== "tYES",
        is_inventory_item: item.InventoryItem === "tYES",
        is_sales_item: item.SalesItem === "tYES",
        sap_item_code: item.ItemCode,
        sap_update_date: item.UpdateDate || null,
      }));

      const bulkRes = await fetch(`${coreUrl}/v1/catalog/items/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items: productsBulk }),
      });
      if (bulkRes.ok) {
        const bulkResult = await bulkRes.json();
        results.products = {
          ok: true,
          imported: bulkResult?.upserted ?? 0,
          errors: 0,
          message: `${bulkResult?.created ?? 0} criados, ${bulkResult?.updated ?? 0} atualizados`,
        };
      } else {
        const errText = await bulkRes.text();
        req.log.error({ status: bulkRes.status, body: errText.substring(0, 500), correlationId }, "Erro no bulk products");
        results.products = {
          ok: false,
          imported: 0,
          errors: 0,
          message: `Core retornou ${bulkRes.status}: ${errText.substring(0, 200)}`,
        };
      }
    } catch (error) {
      results.products = { ok: false, imported: 0, errors: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 3. Sync Estoque (Inventory) — fallback multi-nível via InventoryEnrichmentService
    try {
      const invResult = await getInventoryEnrichment().syncToCore(coreUrl, correlationId);
      results.inventory = {
        ok: invResult.ok,
        imported: invResult.count,
        errors: 0,
        message: invResult.message,
      };
    } catch (error) {
      results.inventory = { ok: false, imported: 0, errors: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 4. Sync Clientes (BusinessPartners)
    try {
      const entSvc = getEntitiesService();
      const sapBPs = await entSvc.listBusinessPartners({ limit: 500 }, correlationId);
      const customersBulk = sapBPs.map((bp) => ({
        card_code: bp.CardCode,
        card_name: bp.CardName || bp.CardCode,
        card_type: bp.CardType === "cSupplier" ? "S" : "C",
        phone: bp.Phone1 || null,
        email: bp.EmailAddress || null,
        address: bp.Address || null,
        city: bp.City || null,
        state: bp.State || null,
        is_active: bp.Valid !== "tNO" && bp.Frozen !== "tYES",
        sap_update_date: bp.UpdateDate || null,
      }));

      const custRes = await fetch(`${coreUrl}/v1/customers/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items: customersBulk }),
      });
      const custResult = custRes.ok ? await custRes.json() : null;
      results.customers = {
        ok: custRes.ok,
        imported: custResult?.upserted ?? 0,
        errors: 0,
        message: `${custResult?.created ?? 0} criados, ${custResult?.updated ?? 0} atualizados`,
      };
    } catch (error) {
      results.customers = { ok: false, imported: 0, errors: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    const allOk = Object.values(results).every((r) => r.ok);
    const totalImported = Object.values(results).reduce((acc, r) => acc + r.imported, 0);

    reply.code(200).send({
      ok: allOk,
      message: `Sincronizacao completa: ${totalImported} registros importados/atualizados`,
      results,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/sap/sync/products
   * Sincroniza apenas Produtos do SAP.
   */
  app.post("/sap/sync/products", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const coreUrl = process.env.CORE_BASE_URL ?? "http://localhost:8000";

    try {
      const entSvc = getEntitiesService();
      const sapItems = await entSvc.listItems({ limit: 500 }, correlationId);

      const productsBulk = sapItems.map((item) => ({
        sku: item.ItemCode,
        description: item.ItemName || item.ItemCode,
        ean: item.BarCode || null,
        category: item.ItemsGroupCode ? `Grupo ${item.ItemsGroupCode}` : null,
        unit_of_measure: item.InventoryUOM || "UN",
        is_active: item.Valid === "tYES" && item.Frozen !== "tYES",
        is_inventory_item: item.InventoryItem === "tYES",
        is_sales_item: item.SalesItem === "tYES",
        sap_item_code: item.ItemCode,
        sap_update_date: item.UpdateDate || null,
      }));

      const bulkRes = await fetch(`${coreUrl}/v1/catalog/items/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items: productsBulk }),
      });

      if (bulkRes.ok) {
        const bulkResult = await bulkRes.json();
        reply.code(200).send({
          ok: true,
          message: `${bulkResult?.upserted ?? 0} produtos sincronizados (${bulkResult?.created ?? 0} novos, ${bulkResult?.updated ?? 0} atualizados)`,
          total_sap: sapItems.length,
          ...bulkResult,
          timestamp: new Date().toISOString(),
        });
      } else {
        const errText = await bulkRes.text();
        reply.code(200).send({
          ok: false,
          message: `Core retornou ${bulkRes.status}: ${errText.substring(0, 200)}`,
          total_sap: sapItems.length,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sync/inventory
   * Sincroniza Estoque do SAP com fallback multi-nível (SQLQuery → OData enriquecido → OData básico).
   */
  app.post("/sap/sync/inventory", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const coreUrl = process.env.CORE_BASE_URL ?? "http://localhost:8000";

    try {
      const result = await getInventoryEnrichment().syncToCore(coreUrl, correlationId);

      reply.code(200).send({
        ok: result.ok,
        message: result.message,
        upserted: result.count,
        enrichment_level: result.level,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sync/customers
   * Sincroniza Clientes (BusinessPartners) do SAP.
   */
  app.post("/sap/sync/customers", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const coreUrl = process.env.CORE_BASE_URL ?? "http://localhost:8000";

    try {
      const entSvc = getEntitiesService();
      const sapBPs = await entSvc.listBusinessPartners({ limit: 500 }, correlationId);

      const customersBulk = sapBPs.map((bp) => ({
        card_code: bp.CardCode,
        card_name: bp.CardName || bp.CardCode,
        card_type: bp.CardType === "cSupplier" ? "S" : "C",
        phone: bp.Phone1 || null,
        email: bp.EmailAddress || null,
        address: bp.Address || null,
        city: bp.City || null,
        state: bp.State || null,
        is_active: bp.Valid !== "tNO" && bp.Frozen !== "tYES",
        sap_update_date: bp.UpdateDate || null,
      }));

      const res = await fetch(`${coreUrl}/v1/customers/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items: customersBulk }),
      });
      const result = res.ok ? await res.json() : null;

      reply.code(200).send({
        ok: res.ok,
        message: `${result?.upserted ?? 0} clientes sincronizados (${result?.created ?? 0} novos, ${result?.updated ?? 0} atualizados)`,
        total_sap: sapBPs.length,
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  // ========================================
  // COCKPIT BI: Sync de entidades para análise
  // ========================================

  /**
   * POST /api/sap/sync/invoices
   * Sincroniza Notas Fiscais (Invoices) do SAP para análise no Cockpit.
   */
  app.post("/sap/sync/invoices", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const query = req.query as any;

    try {
      const entSvc = getEntitiesService();
      const invoices = await entSvc.listInvoices(
        {
          limit: Number(query.limit) || 5000,
          dateFrom: query.dateFrom as string | undefined,
          dateTo: query.dateTo as string | undefined,
        },
        correlationId
      );

      reply.code(200).send({
        ok: true,
        message: `${invoices.length} notas fiscais obtidas do SAP`,
        count: invoices.length,
        items: invoices,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Erro";
      const detail = error?.responseBodyText
        ? error.responseBodyText.slice(0, 500)
        : error?.status ? `SAP status ${error.status}` : undefined;
      console.error(`[sync/invoices] ${message}`, detail ?? "");
      reply.code(500).send({ ok: false, message, detail, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sync/salespersons
   * Sincroniza Vendedores do SAP.
   */
  app.post("/sap/sync/salespersons", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;

    try {
      const entSvc = getEntitiesService();
      const persons = await entSvc.listSalesPersons(correlationId);

      reply.code(200).send({
        ok: true,
        message: `${persons.length} vendedores obtidos do SAP`,
        count: persons.length,
        items: persons,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sync/sales-orders
   * Sincroniza Pedidos de Venda (Sales Orders) do SAP para análise no Cockpit.
   * Query params: dateFrom, dateTo, limit
   */
  app.post("/sap/sync/sales-orders", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const query = req.query as any;

    try {
      const entSvc = getEntitiesService();
      const orders = await entSvc.listSalesOrders(
        {
          limit: Number(query.limit) || 5000,
          dateFrom: query.dateFrom as string | undefined,
          dateTo: query.dateTo as string | undefined,
        },
        correlationId
      );

      reply.code(200).send({
        ok: true,
        message: `${orders.length} pedidos de venda obtidos do SAP`,
        count: orders.length,
        items: orders,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Erro";
      const detail = error?.responseBodyText
        ? error.responseBodyText.slice(0, 500)
        : error?.status ? `SAP status ${error.status}` : undefined;
      console.error(`[sync/sales-orders] ${message}`, detail ?? "");
      reply.code(500).send({ ok: false, message, detail, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sync/bp-groups
   * Sincroniza Grupos de Parceiros de Negócios do SAP.
   */
  app.post("/sap/sync/bp-groups", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;

    try {
      const entSvc = getEntitiesService();
      const groups = await entSvc.listBusinessPartnerGroups(correlationId);

      reply.code(200).send({
        ok: true,
        message: `${groups.length} grupos de parceiros obtidos do SAP`,
        count: groups.length,
        items: groups,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sync/cockpit
   * Sincroniza TODAS as entidades necessárias para o Cockpit BI:
   * Invoices + SalesPersons + Items (com UDFs) + Inventory + Customers + BP Groups
   */
  app.post("/sap/sync/cockpit", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const coreUrl = process.env.CORE_BASE_URL ?? "http://localhost:8000";
    const query = req.query as any;
    const results: Record<string, { ok: boolean; count: number; message: string }> = {};

    const entSvc = getEntitiesService();

    // 1. Vendedores
    try {
      const persons = await entSvc.listSalesPersons(correlationId);
      results.salesPersons = { ok: true, count: persons.length, message: `${persons.length} vendedores` };
    } catch (error) {
      results.salesPersons = { ok: false, count: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 2. Grupos de BP
    try {
      const groups = await entSvc.listBusinessPartnerGroups(correlationId);
      results.bpGroups = { ok: true, count: groups.length, message: `${groups.length} grupos` };
    } catch (error) {
      results.bpGroups = { ok: false, count: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 3. Produtos (com UDFs)
    try {
      const items = await entSvc.listItems({ limit: 1000 }, correlationId);
      const productsBulk = items.map((item) => ({
        sku: item.ItemCode,
        description: item.ItemName || item.ItemCode,
        ean: item.BarCode || null,
        category: item.ItemsGroupCode ? `Grupo ${item.ItemsGroupCode}` : null,
        unit_of_measure: item.InventoryUOM || "UN",
        is_active: item.Valid === "tYES" && item.Frozen !== "tYES",
        is_inventory_item: item.InventoryItem === "tYES",
        is_sales_item: item.SalesItem === "tYES",
        sap_item_code: item.ItemCode,
        sap_update_date: item.UpdateDate || null,
      }));

      const bulkRes = await fetch(`${coreUrl}/v1/catalog/items/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items: productsBulk }),
      });
      const bulkResult = bulkRes.ok ? await bulkRes.json() : null;
      results.products = {
        ok: bulkRes.ok,
        count: bulkResult?.upserted ?? 0,
        message: `${bulkResult?.created ?? 0} novos, ${bulkResult?.updated ?? 0} atualizados`,
      };
    } catch (error) {
      results.products = { ok: false, count: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 4. Estoque — fallback multi-nível via InventoryEnrichmentService
    try {
      const invResult = await getInventoryEnrichment().syncToCore(coreUrl, correlationId);
      results.inventory = { ok: invResult.ok, count: invResult.count, message: invResult.message };
    } catch (error) {
      results.inventory = { ok: false, count: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 5. Clientes (com U_REGIAO)
    try {
      const bps = await entSvc.listBusinessPartners({ limit: 1000 }, correlationId);
      const custBulk = bps.map((bp) => ({
        card_code: bp.CardCode, card_name: bp.CardName || bp.CardCode,
        card_type: bp.CardType === "cSupplier" ? "S" : "C",
        phone: bp.Phone1 || null, email: bp.EmailAddress || null,
        address: bp.Address || null, city: bp.City || null, state: bp.State || null,
        is_active: bp.Valid !== "tNO" && bp.Frozen !== "tYES",
        sap_update_date: bp.UpdateDate || null,
      }));
      const res = await fetch(`${coreUrl}/v1/customers/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items: custBulk }),
      });
      const result = res.ok ? await res.json() : null;
      results.customers = { ok: res.ok, count: result?.upserted ?? 0, message: `${result?.created ?? 0} novos, ${result?.updated ?? 0} atualizados` };
    } catch (error) {
      results.customers = { ok: false, count: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 6. Notas Fiscais
    try {
      const invoices = await entSvc.listInvoices(
        { limit: Number(query.limit) || 5000, dateFrom: query.dateFrom, dateTo: query.dateTo },
        correlationId
      );
      results.invoices = { ok: true, count: invoices.length, message: `${invoices.length} notas fiscais` };
    } catch (error) {
      results.invoices = { ok: false, count: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 7. Pedidos de Venda (Sales Orders)
    try {
      const salesOrders = await entSvc.listSalesOrders(
        { limit: Number(query.limit) || 5000, dateFrom: query.dateFrom, dateTo: query.dateTo },
        correlationId
      );
      results.salesOrders = { ok: true, count: salesOrders.length, message: `${salesOrders.length} pedidos de venda` };
    } catch (error) {
      results.salesOrders = { ok: false, count: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    const allOk = Object.values(results).every((r) => r.ok);
    const totalCount = Object.values(results).reduce((acc, r) => acc + r.count, 0);

    reply.code(200).send({
      ok: allOk,
      message: `Cockpit sync completo: ${totalCount} registros processados`,
      results,
      timestamp: new Date().toISOString(),
    });
  });

  // ========================================
  // NOTAS FISCAIS — base local (PostgreSQL)
  // ========================================

  /**
   * GET /api/sap/invoices
   * Consulta notas fiscais da base local (sincronizada do SAP).
   * Query: dateFrom, dateTo, cardCode, salesPerson, cancelled (active|cancelled), search, limit, offset
   */
  app.get("/sap/invoices", async (req, reply) => {
    const query = req.query as any;
    try {
      const result = await queryInvoices({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        cardCode: query.cardCode,
        salesPerson: query.salesPerson ? Number(query.salesPerson) : undefined,
        cancelled: query.cancelled,
        search: query.search,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });

      reply.code(200).send({
        ok: true,
        total: result.total,
        count: result.items.length,
        items: result.items,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/invoices/sync
   * Dispara sync manual: busca notas do SAP e persiste no PostgreSQL.
   */
  app.post("/sap/invoices/sync", async (req, reply) => {
    try {
      const result = await runInvoicesSync();
      reply.code(result.ok ? 200 : 500).send({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  // ========================================
  // PEDIDOS DE VENDA — base local (PostgreSQL)
  // ========================================

  /**
   * GET /api/sap/products/analytics
   * Pre-aggregated product analytics (SQL server-side).
   * Returns ~200-500 product rows instead of 50k raw orders.
   */
  app.get("/sap/products/analytics", async (req, reply) => {
    const q = req.query as any;
    try {
      const result = await queryProductAnalytics({
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
        date3mCutoff: q.date3mCutoff,
        estado: q.estado || undefined,
        salesPerson: q.salesPerson ? Number(q.salesPerson) : undefined,
      });
      reply.code(200).send({ ok: true, ...result, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * GET /api/sap/products/orders
   * Order lines for specific item codes (modal detail lazy load).
   */
  app.get("/sap/products/orders", async (req, reply) => {
    const q = req.query as any;
    try {
      const itemCodes = typeof q.itemCodes === "string" ? q.itemCodes.split(",") : [];
      const result = await queryProductOrders({
        itemCodes,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      });
      reply.code(200).send({ ok: true, count: result.orders.length, orders: result.orders, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * GET /api/sap/sales-orders
   * Consulta pedidos de venda da base local (sincronizada do SAP).
   * Query: dateFrom, dateTo, cardCode, status (open|closed|cancelled),
   *        salesPerson, search, limit, offset
   */
  app.get("/sap/sales-orders", async (req, reply) => {
    const query = req.query as any;

    try {
      const result = await querySalesOrders({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        cardCode: query.cardCode,
        status: query.status,
        salesPerson: query.salesPerson ? Number(query.salesPerson) : undefined,
        search: query.search,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });

      reply.code(200).send({
        ok: true,
        total: result.total,
        count: result.items.length,
        items: result.items,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sales-orders/sync
   * Dispara sync manual: busca pedidos do SAP e persiste no PostgreSQL.
   */
  app.post("/sap/sales-orders/sync", async (req, reply) => {
    try {
      const result = await runSalesOrdersSync();
      reply.code(result.ok ? 200 : 500).send({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * GET /api/sap/sales-orders/sync/history
   * Retorna histórico das últimas sincronizações.
   */
  app.get("/sap/sales-orders/sync/history", async (req, reply) => {
    const query = req.query as any;
    try {
      const history = await querySyncHistory(Number(query.limit) || 20);
      reply.code(200).send({ ok: true, items: history, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * GET /api/sap/sales-orders/stats
   * Retorna estatísticas da base local de pedidos de venda.
   */
  app.get("/sap/sales-orders/stats", async (req, reply) => {
    try {
      const stats = await queryDbStats();
      reply.code(200).send({ ok: true, stats, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * GET /api/sap/sales-orders/:docEntry/lines
   * Busca linhas de um pedido específico do SAP sob demanda.
   * Se já tiver linhas na base local, retorna. Senão, busca no SAP e salva.
   */
  app.get("/sap/sales-orders/:docEntry/lines", async (req, reply) => {
    const docEntry = Number((req.params as any).docEntry);
    if (!docEntry) return reply.code(400).send({ ok: false, message: "docEntry inválido" });

    const { getDbPool } = await import("../scheduler/dailySync.js");
    const db = getDbPool();

    try {
      const existing = await db.query(
        `SELECT line_num as "LineNum", item_code as "ItemCode", item_description as "ItemDescription",
                quantity as "Quantity", unit_price as "UnitPrice", line_total as "LineTotal",
                discount_percent as "DiscountPercent", warehouse_code as "WarehouseCode",
                price as "Price", cfop_code as "CFOPCode", weight as "Weight", tax_code as "TaxCode", usage_code as "Usage"
         FROM sap_sales_order_lines WHERE doc_entry = $1 ORDER BY line_num`,
        [docEntry]
      );

      if (existing.rows.length > 0) {
        return reply.code(200).send({ ok: true, lines: existing.rows, source: "cache" });
      }

      const sapClient = getSapClient();
      const full = await sapClient.get<any>(`/Orders(${docEntry})`, {});
      const sapLines = full.data?.DocumentLines ?? [];

      if (sapLines.length > 0) {
        await db.query(`DELETE FROM sap_sales_order_lines WHERE doc_entry = $1`, [docEntry]);
        for (const l of sapLines) {
          await db.query(
            `INSERT INTO sap_sales_order_lines (doc_entry, line_num, item_code, item_description, quantity, unit_price, line_total, discount_percent, warehouse_code, price, cfop_code, weight, tax_code, usage_code)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [docEntry, l.LineNum, l.ItemCode, l.ItemDescription, l.Quantity ?? 0, l.UnitPrice ?? l.Price ?? 0, l.LineTotal ?? 0, l.DiscountPercent ?? 0, l.WarehouseCode, l.Price ?? 0, l.CFOPCode ?? null, l.Weight1 ?? 0, l.TaxCode ?? null, l.Usage ?? null]
          );
        }

        await db.query(
          `UPDATE sap_sales_orders SET num_lines = $1, total_quantity = $2 WHERE doc_entry = $3`,
          [sapLines.length, sapLines.reduce((s: number, l: any) => s + (l.Quantity ?? 0), 0), docEntry]
        );
      }

      const lines = sapLines.map((l: any) => ({
        LineNum: l.LineNum,
        ItemCode: l.ItemCode,
        ItemDescription: l.ItemDescription,
        Quantity: l.Quantity,
        UnitPrice: l.UnitPrice ?? l.Price,
        LineTotal: l.LineTotal,
        DiscountPercent: l.DiscountPercent,
        WarehouseCode: l.WarehouseCode,
        Price: l.Price,
        CFOPCode: l.CFOPCode,
        Weight: l.Weight1,
        TaxCode: l.TaxCode,
        Usage: l.Usage,
      }));

      reply.code(200).send({ ok: true, lines, source: "sap" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message });
    }
  });

  // ========================================
  // TABELAS DE PREÇO (ITM1 + OPLN)
  // ========================================

  app.get("/sap/prices", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;

    try {
      const entSvc = getEntitiesService();
      const rows = await entSvc.listItemPrices(correlationId);

      const priceListSet = new Set<string>();
      for (const r of rows) priceListSet.add(r.ListName);

      reply.code(200).send({
        ok: true,
        count: rows.length,
        items: rows,
        priceLists: Array.from(priceListSet).sort(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error, correlationId }, "Erro ao buscar tabelas de preço");
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  // ========================================
  // PREÇOS TRANSACIONAIS (baseados em vendas reais)
  // ========================================

  app.get("/sap/prices/practiced", async (req, reply) => {
    try {
      const { getDbPool } = await import("../scheduler/dailySync.js");
      const db = getDbPool();

      const sql = `
        WITH line_data AS (
          SELECT
            l.item_code,
            l.item_description,
            l.unit_price,
            l.line_total,
            l.quantity,
            l.discount_percent,
            o.doc_date,
            o.doc_num,
            o.card_code,
            o.card_name
          FROM sap_sales_order_lines l
          INNER JOIN sap_sales_orders o ON o.doc_entry = l.doc_entry
          WHERE o.cancelled = 'N'
            AND l.unit_price > 0
            AND l.quantity > 0
        )
        SELECT
          item_code,
          MAX(item_description)                                         AS item_description,
          ROUND(AVG(unit_price)::numeric, 2)::float                    AS avg_price,
          MIN(unit_price)::float                                        AS min_price,
          MAX(unit_price)::float                                        AS max_price,
          ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY unit_price))::numeric, 2)::float AS median_price,
          SUM(quantity)::float                                          AS total_qty_sold,
          SUM(line_total)::float                                        AS total_revenue,
          COUNT(*)::int                                                 AS sale_count,
          COUNT(DISTINCT card_code)::int                                AS unique_clients,
          MAX(doc_date)::text                                           AS last_sale_date,
          (ARRAY_AGG(unit_price ORDER BY doc_date DESC))[1]::float      AS last_price,
          ROUND(AVG(discount_percent)::numeric, 1)::float               AS avg_discount
        FROM line_data
        WHERE item_code IS NOT NULL AND item_code <> ''
        GROUP BY item_code
        ORDER BY total_revenue DESC
      `;

      const res = await db.query(sql);
      const items = res.rows;

      const totals = items.reduce(
        (acc, r) => {
          acc.totalRevenue += r.total_revenue;
          acc.totalQty += r.total_qty_sold;
          acc.totalSales += r.sale_count;
          return acc;
        },
        { totalRevenue: 0, totalQty: 0, totalSales: 0 }
      );

      reply.code(200).send({
        ok: true,
        count: items.length,
        items,
        totals,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error }, "Erro ao buscar preços praticados");
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  // ─── MarkUp ─────────────────────────────────────────────────

  app.get("/sap/markup/items", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    try {
      const { MarkupService } = await import("../services/markupService.js");
      const { getDbPool } = await import("../scheduler/dailySync.js");

      let ent: SapEntitiesService | null = null;
      try { ent = getEntitiesService(); } catch { /* SAP offline */ }

      const svc = new MarkupService(getDbPool(), ent);
      const items = await svc.listMarkupItems(correlationId);

      reply.code(200).send({
        ok: true,
        count: items.length,
        items,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error, correlationId }, "Erro ao buscar markup items");
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  app.post("/sap/markup/overrides", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    try {
      const { MarkupService } = await import("../services/markupService.js");
      const { getDbPool } = await import("../scheduler/dailySync.js");

      let ent: SapEntitiesService | null = null;
      try { ent = getEntitiesService(); } catch { /* SAP offline */ }

      const svc = new MarkupService(getDbPool(), ent);
      const body = req.body as any;

      if (!body?.itemCode) {
        return reply.code(400).send({ ok: false, message: "itemCode é obrigatório" });
      }

      await svc.saveOverride({
        itemCode: body.itemCode,
        frete: body.frete,
        embalagem: body.embalagem,
        comissao: body.comissao,
        pisCofins: body.pisCofins,
        icmsCompra: body.icmsCompra,
        ipi: body.ipi,
        custoFixoSaco: body.custoFixoSaco,
        custoFixoPallet: body.custoFixoPallet,
        qtdPallet: body.qtdPallet,
        qtdSaco: body.qtdSaco,
        precoSemImp: body.precoSemImp,
        updatedBy: body.updatedBy ?? "painel",
      });

      reply.code(200).send({ ok: true, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error, correlationId }, "Erro ao salvar markup override");
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  app.log.info("Rotas SAP registradas (com cache, store, session management, sync de entidades, cockpit, pedidos de venda, tabelas de preço e markup)");
}
