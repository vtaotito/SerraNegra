import type { FastifyInstance } from "fastify";
import { createSapClient } from "../config/sap.js";
import { SapOrdersService } from "../services/sapOrdersService.js";
import { SapEntitiesService } from "../services/sapEntitiesService.js";
import { sapConfigStore } from "../config/sapConfigStore.js";

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
      const bulkResult = bulkRes.ok ? await bulkRes.json() : null;
      results.products = {
        ok: bulkRes.ok,
        imported: bulkResult?.upserted ?? 0,
        errors: 0,
        message: `${bulkResult?.created ?? 0} criados, ${bulkResult?.updated ?? 0} atualizados`,
      };
    } catch (error) {
      results.products = { ok: false, imported: 0, errors: 0, message: error instanceof Error ? error.message : "Erro" };
    }

    // 3. Sync Estoque (Inventory)
    try {
      const entSvc = getEntitiesService();
      const sapInventory = await entSvc.listInventory({ limit: 1000 }, correlationId);
      if (sapInventory.length > 0) {
        const inventoryBulk = sapInventory.map((row) => ({
          sku: row.ItemCode,
          warehouse_code: row.WarehouseCode,
          on_hand: row.InStock,
          committed: row.Committed,
          ordered: row.Ordered,
        }));

        const invRes = await fetch(`${coreUrl}/v1/inventory/bulk`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-correlation-id": correlationId },
          body: JSON.stringify({ items: inventoryBulk }),
        });
        const invResult = invRes.ok ? await invRes.json() : null;
        results.inventory = {
          ok: invRes.ok,
          imported: invResult?.upserted ?? 0,
          errors: 0,
          message: `${invResult?.created ?? 0} criados, ${invResult?.updated ?? 0} atualizados`,
        };
      } else {
        results.inventory = { ok: true, imported: 0, errors: 0, message: "Sem dados de estoque via Service Layer" };
      }
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
      const bulkResult = bulkRes.ok ? await bulkRes.json() : null;

      reply.code(200).send({
        ok: bulkRes.ok,
        message: `${bulkResult?.upserted ?? 0} produtos sincronizados (${bulkResult?.created ?? 0} novos, ${bulkResult?.updated ?? 0} atualizados)`,
        total_sap: sapItems.length,
        ...bulkResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ ok: false, message, timestamp: new Date().toISOString() });
    }
  });

  /**
   * POST /api/sap/sync/inventory
   * Sincroniza Estoque do SAP.
   */
  app.post("/sap/sync/inventory", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    const coreUrl = process.env.CORE_BASE_URL ?? "http://localhost:8000";

    try {
      const entSvc = getEntitiesService();
      const sapInv = await entSvc.listInventory({ limit: 1000 }, correlationId);

      if (sapInv.length === 0) {
        reply.code(200).send({
          ok: true,
          message: "Nenhum dado de estoque disponivel via Service Layer (expand nao suportado ou sem estoque)",
          upserted: 0,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const inventoryBulk = sapInv.map((row) => ({
        sku: row.ItemCode,
        warehouse_code: row.WarehouseCode,
        on_hand: row.InStock,
        committed: row.Committed,
        ordered: row.Ordered,
      }));

      const res = await fetch(`${coreUrl}/v1/inventory/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        body: JSON.stringify({ items: inventoryBulk }),
      });
      const result = res.ok ? await res.json() : null;

      reply.code(200).send({
        ok: res.ok,
        message: `${result?.upserted ?? 0} registros de estoque sincronizados`,
        total_sap: sapInv.length,
        ...result,
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

  app.log.info("Rotas SAP registradas (com cache, store, session management e sync de entidades)");
}
