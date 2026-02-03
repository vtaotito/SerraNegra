/**
 * Exemplo de uso básico do SAP Service Layer Client.
 *
 * Para rodar:
 * 1. Configure as credenciais no arquivo .env (raiz do projeto)
 * 2. npm run build
 * 3. node dist/sap-connector/examples/basic-usage.js
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import type { ServiceLayerOrder } from "../../mappings/src/order.js";
import { mapOrderFromSapB1 } from "../../mappings/src/order.js";

// Simulação de variáveis de ambiente (em produção, usar process.env ou biblioteca de config)
const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "https://REDACTED_SAP_HOST/b1s/v1",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "",
  username: process.env.SAP_B1_USERNAME ?? "",
  password: process.env.SAP_B1_PASSWORD ?? "",
  token: process.env.SAP_B1_TOKEN ?? ""
};

async function main() {
  // Logger simples para console
  const logger = {
    debug: (msg: string, meta?: Record<string, unknown>) => console.debug(`[DEBUG] ${msg}`, meta ?? ""),
    info: (msg: string, meta?: Record<string, unknown>) => console.info(`[INFO] ${msg}`, meta ?? ""),
    warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, meta ?? ""),
    error: (msg: string, meta?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, meta ?? "")
  };

  const client = new SapServiceLayerClient({
    baseUrl: config.baseUrl,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password
    },
    logger,
    timeoutMs: 20_000,
    retry: {
      maxAttempts: 5,
      baseDelayMs: 500,
      maxDelayMs: 10_000,
      jitterRatio: 0.2
    },
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      openStateTimeoutMs: 30_000
    },
    rateLimit: {
      maxConcurrent: 8,
      maxRps: 10
    }
  });

  const correlationId = `example-${Date.now()}`;

  try {
    // 1. Login (automático no primeiro request, mas pode ser explícito)
    logger.info("Fazendo login no SAP Service Layer...");
    await client.login(correlationId);
    logger.info("Login OK.");

    // 2. Consultar pedidos (exemplo: últimos 5)
    logger.info("Consultando pedidos (Orders)...");
    const ordersRes = await client.get<{ value: ServiceLayerOrder[] }>(
      "/Orders?$top=5&$select=DocEntry,DocNum,CardCode,DocStatus,UpdateDate,UpdateTime&$expand=DocumentLines($select=LineNum,ItemCode,Quantity,WarehouseCode)",
      { correlationId }
    );

    const orders = ordersRes.data.value ?? [];
    logger.info(`${orders.length} pedido(s) encontrado(s).`);

    for (const sapOrder of orders) {
      const wmsOrder = mapOrderFromSapB1(sapOrder);
      console.log("\n--- Pedido SAP ---");
      console.log(`DocEntry: ${sapOrder.DocEntry}`);
      console.log(`DocNum: ${sapOrder.DocNum}`);
      console.log(`Cliente: ${sapOrder.CardCode}`);
      console.log(`Itens: ${sapOrder.DocumentLines?.length ?? 0}`);
      console.log("Mapeado para WMS:", wmsOrder);
    }

    // 3. Exemplo de escrita (PATCH): atualizar UDF de status (assumindo que o UDF já existe)
    // Descomente para testar:
    /*
    if (orders.length > 0) {
      const docEntry = orders[0]!.DocEntry;
      logger.info(`Atualizando UDF do pedido ${docEntry}...`);
      await client.patch(`/Orders(${docEntry})`, {
        U_WMS_STATUS: "EM_SEPARACAO",
        U_WMS_ORDERID: `wms-${Date.now()}`,
        U_WMS_LAST_TS: new Date().toISOString()
      }, { correlationId });
      logger.info("UDF atualizado com sucesso.");
    }
    */

    // 4. Logout (opcional)
    logger.info("Fazendo logout...");
    await client.logout(correlationId);
    logger.info("Logout OK.");
  } catch (err) {
    logger.error("Erro na integração SAP:", { error: String(err) });
    throw err;
  }
}

main().catch(console.error);
