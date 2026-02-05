/**
 * Script de conferência simplificado: valida conexão e lista pedidos básicos.
 * Versão otimizada para SAP B1 Service Layer com limitações de endpoint.
 *
 * Para rodar:
 * npm run sap:conferencia-simples
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import type { ServiceLayerOrder } from "../../mappings/src/order.js";

// Carregar configuração do .env
const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "https://REDACTED_SAP_HOST:50000",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "REDACTED_COMPANY_DB",
  username: process.env.SAP_B1_USERNAME ?? "REDACTED_USER",
  password: process.env.SAP_B1_PASSWORD ?? "REDACTED_PASSWORD",
  timeoutMs: parseInt(process.env.SAP_B1_TIMEOUT_MS ?? "60000", 10),
  maxAttempts: parseInt(process.env.SAP_B1_MAX_ATTEMPTS ?? "3", 10)
};

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`)
};

async function main() {
  console.log("\n========================================");
  console.log("🔍 CONFERÊNCIA SIMPLES - SAP B1");
  console.log("========================================\n");

  console.log(`Database: ${config.companyDb}`);
  console.log(`Servidor: ${config.baseUrl}\n`);

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password
    },
    timeoutMs: config.timeoutMs,
    retry: { maxAttempts: config.maxAttempts, baseDelayMs: 1000, maxDelayMs: 5000, jitterRatio: 0.1 },
    circuitBreaker: { failureThreshold: 10, successThreshold: 2, openStateTimeoutMs: 60000 }
  });

  const correlationId = `conf-${Date.now()}`;

  try {
    // Login
    logger.info("Autenticando...");
    await client.login(correlationId);
    console.log("✅ Login OK\n");

    // Consultar pedidos
    logger.info("Buscando pedidos...");
    const ordersRes = await client.get<{ value: ServiceLayerOrder[] }>(
      "/Orders?$top=20&$select=DocEntry,DocNum,CardCode&$orderby=DocEntry desc",
      { correlationId }
    );

    const orders = ordersRes.data.value ?? [];
    console.log(`\n✅ ${orders.length} pedidos encontrados\n`);

    if (orders.length > 0) {
      console.log("╔═══════════╦═════════╦════════════╗");
      console.log("║ DocEntry  ║ DocNum  ║ Cliente    ║");
      console.log("╠═══════════╬═════════╬════════════╣");
      for (const order of orders) {
        const docEntry = String(order.DocEntry).padEnd(9);
        const docNum = String(order.DocNum).padEnd(7);
        const cardCode = order.CardCode.padEnd(10);
        console.log(`║ ${docEntry} ║ ${docNum} ║ ${cardCode} ║`);
      }
      console.log("╚═══════════╩═════════╩════════════╝");
    }

    // Logout
    await client.logout(correlationId);

    console.log("\n========================================");
    console.log("✅ CONFERÊNCIA CONCLUÍDA");
    console.log("========================================");
    console.log(`Base confirmada: ${config.companyDb}`);
    console.log(`Total: ${orders.length} pedidos`);
    console.log("========================================\n");

  } catch (err) {
    logger.error(`Falha: ${err}`);
    console.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
