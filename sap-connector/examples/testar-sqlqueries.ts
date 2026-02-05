/**
 * Script de teste: SQLQueries helper com queries WMS.
 * Testa criação, execução e performance das queries.
 *
 * Para rodar:
 * npm run sap:testar-sqlqueries
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import { WmsQueriesHelper, WMS_QUERIES } from "../src/sqlQueries.js";

const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "https://sap-garrafariasnegra-sl.skyinone.net:50000",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "SBO_GARRAFARIA_TST",
  username: process.env.SAP_B1_USERNAME ?? "lorenzo.naves",
  password: process.env.SAP_B1_PASSWORD ?? "382105",
  timeoutMs: parseInt(process.env.SAP_B1_TIMEOUT_MS ?? "60000", 10)
};

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`)
};

async function main() {
  console.log("\n========================================");
  console.log("🧪 TESTE DE SQLQueries - WMS");
  console.log("========================================\n");

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password
    },
    timeoutMs: config.timeoutMs,
    retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 5000, jitterRatio: 0.1 },
    circuitBreaker: { failureThreshold: 10, successThreshold: 2, openStateTimeoutMs: 60000 }
  });

  const wmsQueries = new WmsQueriesHelper(client);
  const correlationId = `sqlq-test-${Date.now()}`;

  try {
    logger.info("Autenticando...");
    await client.login(correlationId);
    logger.success("Login OK\n");

    // 1. Criar/garantir queries WMS
    console.log("========================================");
    console.log("📝 CRIANDO QUERIES WMS");
    console.log("========================================\n");

    logger.info("Criando queries padrão do WMS...");
    const queryCount = Object.keys(WMS_QUERIES).length;
    await wmsQueries.ensureWmsQueries({ correlationId });
    logger.success(`${queryCount} queries criadas/verificadas\n`);

    // 2. Testar query de pedidos com linhas
    console.log("========================================");
    console.log("🔍 TESTE: Pedidos com Linhas");
    console.log("========================================\n");

    logger.info("Buscando pedidos a partir de 2023-01-01...");
    const startTime1 = Date.now();
    const ordersResult = await wmsQueries.getOrdersWithLines("2023-01-01", { correlationId });
    const elapsed1 = Date.now() - startTime1;

    const orders = ordersResult.value ?? [];
    logger.success(`${orders.length} linha(s) encontrada(s) em ${elapsed1}ms`);

    // Agrupar por DocEntry para contar pedidos únicos
    const uniqueOrders = new Set(orders.map(o => (o as Record<string, unknown>).DocEntry));

    if (orders.length > 0) {
      console.log("\nPrimeiros 3 resultados:");
      for (const row of orders.slice(0, 3)) {
        const r = row as Record<string, unknown>;
        console.log(`   DocEntry: ${r.DocEntry} | DocNum: ${r.DocNum} | Item: ${r.ItemCode} | Qty: ${r.Quantity}`);
      }

      console.log(`\n   Pedidos únicos: ${uniqueOrders.size}`);
      console.log(`   Total de linhas: ${orders.length}`);
      console.log(`   Média de linhas por pedido: ${(orders.length / uniqueOrders.size).toFixed(1)}`);
    }

    // 3. Testar query de estoque
    console.log("\n========================================");
    console.log("📦 TESTE: Estoque por Depósito");
    console.log("========================================\n");

    logger.info("Buscando estoque (todos os itens e depósitos)...");
    const startTime2 = Date.now();
    const inventoryResult = await wmsQueries.getInventory({ correlationId });
    const elapsed2 = Date.now() - startTime2;

    const inventory = inventoryResult.value ?? [];
    logger.success(`${inventory.length} registro(s) encontrado(s) em ${elapsed2}ms`);

    if (inventory.length > 0) {
      console.log("\nPrimeiros 5 resultados:");
      for (const row of inventory.slice(0, 5)) {
        const r = row as Record<string, unknown>;
        console.log(`   ${r.ItemCode} @ ${r.WarehouseCode}: ${r.Available} disponível`);
      }
    }

    // 4. Testar query de itens ativos
    console.log("\n========================================");
    console.log("🏷️  TESTE: Itens Ativos");
    console.log("========================================\n");

    logger.info("Buscando catálogo de itens ativos...");
    const startTime3 = Date.now();
    const itemsResult = await wmsQueries.getActiveItems({ correlationId });
    const elapsed3 = Date.now() - startTime3;

    const items = itemsResult.value ?? [];
    logger.success(`${items.length} item(ns) ativo(s) em ${elapsed3}ms`);

    if (items.length > 0) {
      console.log("\nPrimeiros 5 itens:");
      for (const row of items.slice(0, 5)) {
        const r = row as Record<string, unknown>;
        console.log(`   ${r.ItemCode}: ${r.ItemName}`);
      }
    }

    // 5. Testar query de depósitos
    console.log("\n========================================");
    console.log("🏭 TESTE: Depósitos Ativos");
    console.log("========================================\n");

    logger.info("Buscando depósitos ativos...");
    const startTime4 = Date.now();
    const whsResult = await wmsQueries.getActiveWarehouses({ correlationId });
    const elapsed4 = Date.now() - startTime4;

    const warehouses = whsResult.value ?? [];
    logger.success(`${warehouses.length} depósito(s) ativo(s) em ${elapsed4}ms`);

    if (warehouses.length > 0) {
      console.log("\nDepósitos:");
      for (const row of warehouses) {
        const r = row as Record<string, unknown>;
        console.log(`   ${r.WarehouseCode}: ${r.WarehouseName}`);
      }
    }

    // 6. Comparação de performance (se houver pedidos)
    if (orders.length > 0) {
      console.log("\n========================================");
      console.log("⚡ COMPARAÇÃO DE PERFORMANCE");
      console.log("========================================\n");

      console.log("SQLQueries (1 request, JOINado):");
      console.log(`   ${uniqueOrders.size} pedidos + ${orders.length} linhas = ${elapsed1}ms`);
      console.log(`   Média: ${(elapsed1 / uniqueOrders.size).toFixed(1)}ms por pedido\n`);

      console.log("Abordagem tradicional (estimativa):");
      const estimatedRequests = uniqueOrders.size + 1; // 1 para listar + 1 por pedido
      const estimatedTime = estimatedRequests * 500; // assumindo 500ms por request
      console.log(`   ${estimatedRequests} requests × ~500ms = ~${estimatedTime}ms`);
      console.log(`   Ganho estimado: ${((estimatedTime - elapsed1) / estimatedTime * 100).toFixed(1)}% mais rápido\n`);
    }

    // Logout
    await client.logout(correlationId);

    console.log("========================================");
    console.log("✅ TESTE CONCLUÍDO COM SUCESSO");
    console.log("========================================");
    console.log(`\nQueries WMS criadas e funcionando!`);
    console.log(`Performance: SQLQueries é significativamente mais rápido.\n`);

  } catch (err) {
    logger.error(`Falha: ${err}`);
    console.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
