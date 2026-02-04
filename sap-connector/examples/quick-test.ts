/**
 * Script de teste rápido para validar conexão com SAP
 * Execute: tsx sap-connector/examples/quick-test.ts
 */
import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import type { SapCollectionResponse } from "../src/sapTypes.js";

// Carrega variáveis de ambiente
const BASE_URL = process.env.SAP_B1_BASE_URL;
const COMPANY_DB = process.env.SAP_B1_COMPANY_DB;
const USERNAME = process.env.SAP_B1_USERNAME;
const PASSWORD = process.env.SAP_B1_PASSWORD;

if (!BASE_URL || !COMPANY_DB || !USERNAME || !PASSWORD) {
  console.error("❌ Erro: Variáveis de ambiente não configuradas");
  console.error("Configure SAP_B1_BASE_URL, SAP_B1_COMPANY_DB, SAP_B1_USERNAME, SAP_B1_PASSWORD");
  process.exit(1);
}

const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => 
    console.log("🔍 [DEBUG]", msg, meta ? JSON.stringify(meta) : ""),
  info: (msg: string, meta?: Record<string, unknown>) => 
    console.log("ℹ️  [INFO]", msg, meta ? JSON.stringify(meta) : ""),
  warn: (msg: string, meta?: Record<string, unknown>) => 
    console.warn("⚠️  [WARN]", msg, meta ? JSON.stringify(meta) : ""),
  error: (msg: string, meta?: Record<string, unknown>) => 
    console.error("❌ [ERROR]", msg, meta ? JSON.stringify(meta) : "")
};

const client = new SapServiceLayerClient({
  baseUrl: BASE_URL,
  credentials: {
    companyDb: COMPANY_DB,
    username: USERNAME,
    password: PASSWORD
  },
  logger,
  timeoutMs: 20000,
  retry: { maxAttempts: 3 },
  rateLimit: { maxConcurrent: 4, maxRps: 5 }
});

async function main() {
  console.log("🚀 Iniciando teste de conexão SAP...\n");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🏢 Company DB: ${COMPANY_DB}`);
  console.log(`👤 Username: ${USERNAME}\n`);

  try {
    // 1. Login
    console.log("1️⃣  Testando login...");
    await client.login("test-corr-" + Date.now());
    console.log("✅ Login realizado com sucesso!\n");

    // 2. Buscar pedidos abertos (limitado a 5)
    console.log("2️⃣  Buscando pedidos abertos (top 5)...");
    const ordersPath = "/Orders?$select=DocEntry,DocNum,CardCode,CardName,DocStatus,U_WMS_STATUS&$filter=DocumentStatus eq 'bost_Open'&$top=5";
    const ordersResponse = await client.get<SapCollectionResponse<any>>(ordersPath);
    
    const orders = ordersResponse.data.value || [];
    console.log(`✅ Encontrados ${orders.length} pedidos:\n`);
    
    orders.forEach((order: any, idx: number) => {
      console.log(`   ${idx + 1}. DocEntry: ${order.DocEntry}, DocNum: ${order.DocNum}, Cliente: ${order.CardCode} (${order.CardName})`);
      console.log(`      Status SAP: ${order.DocStatus}, Status WMS: ${order.U_WMS_STATUS || '(não definido)'}\n`);
    });

    // 3. Testar atualização de UDF (apenas no primeiro pedido, se existir)
    if (orders.length > 0) {
      const testOrder = orders[0];
      console.log(`3️⃣  Testando atualização de UDF no pedido ${testOrder.DocEntry}...`);
      
      const updatePath = `/Orders(${testOrder.DocEntry})`;
      const updatePayload = {
        U_WMS_STATUS: "A_SEPARAR",
        U_WMS_ORDERID: `WMS-TEST-${Date.now()}`,
        U_WMS_LAST_EVENT: "TESTE_CONEXAO",
        U_WMS_LAST_TS: new Date().toISOString(),
        U_WMS_CORR_ID: "test-corr-" + Date.now()
      };

      await client.patch(updatePath, updatePayload);
      console.log("✅ UDF atualizado com sucesso!\n");

      // Verificar atualização
      console.log("4️⃣  Verificando atualização...");
      const verifyPath = `/Orders(${testOrder.DocEntry})?$select=DocEntry,DocNum,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS`;
      const verifyResponse = await client.get<any>(verifyPath);
      
      console.log("📄 Dados atualizados:");
      console.log(`   DocEntry: ${verifyResponse.data.DocEntry}`);
      console.log(`   DocNum: ${verifyResponse.data.DocNum}`);
      console.log(`   U_WMS_STATUS: ${verifyResponse.data.U_WMS_STATUS}`);
      console.log(`   U_WMS_ORDERID: ${verifyResponse.data.U_WMS_ORDERID}`);
      console.log(`   U_WMS_LAST_EVENT: ${verifyResponse.data.U_WMS_LAST_EVENT}`);
      console.log(`   U_WMS_LAST_TS: ${verifyResponse.data.U_WMS_LAST_TS}\n`);
    } else {
      console.log("⚠️  Nenhum pedido aberto encontrado para testar atualização\n");
    }

    // 5. Logout
    console.log("5️⃣  Realizando logout...");
    await client.logout();
    console.log("✅ Logout realizado com sucesso!\n");

    console.log("🎉 Teste completo! Integração SAP funcionando corretamente.");
    
  } catch (error) {
    console.error("\n❌ Erro durante o teste:");
    if (error instanceof Error) {
      console.error(`   Mensagem: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error(`   ${error}`);
    }
    process.exit(1);
  }
}

main();
