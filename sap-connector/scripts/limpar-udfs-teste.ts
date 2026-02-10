/**
 * Limpar UDFs de teste dos pedidos que foram marcados como IMPORTADO
 * durante o teste E2E.
 *
 * Uso: npm run sap:limpar-udfs-teste
 */

import "dotenv/config";
import { SapServiceLayerClient } from "../src/serviceLayerClient.js";

const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "",
  username: process.env.SAP_B1_USERNAME ?? "",
  password: process.env.SAP_B1_PASSWORD ?? "",
};

async function main() {
  console.log("\n🧹 Limpando UDFs de teste dos pedidos...\n");

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: { companyDb: config.companyDb, username: config.username, password: config.password },
    timeoutMs: 60_000,
    retry: { maxAttempts: 2, baseDelayMs: 1_000, maxDelayMs: 5_000, jitterRatio: 0.1 },
    circuitBreaker: { failureThreshold: 10, successThreshold: 2, openStateTimeoutMs: 60_000 },
  });

  await client.login();
  console.log("✅ Login OK\n");

  // Buscar pedidos com UDF WMS preenchido
  const res = await client.get<{ value: Array<{ DocEntry: number; DocNum: number; U_WMS_STATUS: string | null }> }>(
    "/Orders?$filter=U_WMS_STATUS ne null&$select=DocEntry,DocNum,U_WMS_STATUS&$top=50",
  );

  const orders = res.data.value?.filter((o) => o.U_WMS_STATUS && o.U_WMS_STATUS.trim() !== "") ?? [];
  console.log(`Encontrados ${orders.length} pedidos com UDF WMS preenchido\n`);

  for (const order of orders) {
    console.log(`  Limpando DocEntry ${order.DocEntry} (DocNum ${order.DocNum}, status: ${order.U_WMS_STATUS})...`);
    try {
      await client.patch(`/Orders(${order.DocEntry})`, {
        U_WMS_STATUS: null,
        U_WMS_ORDERID: null,
        U_WMS_LAST_EVENT: null,
        U_WMS_LAST_TS: null,
        U_WMS_CORR_ID: null,
      });
      console.log(`  ✅ Limpo`);
    } catch (err) {
      console.log(`  ❌ Falha: ${err instanceof Error ? err.message : err}`);
    }
  }

  await client.logout();
  console.log(`\n✅ Concluído. ${orders.length} pedidos processados.\n`);
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
