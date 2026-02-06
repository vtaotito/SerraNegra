/**
 * Teste de ESCRITA em UDFs WMS
 * 
 * Tenta atualizar um pedido com valores nos UDFs para verificar:
 * 1. Se os campos são aceitos (não erro 400)
 * 2. Se a escrita funciona
 * 3. Se conseguimos ler de volta
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";

const SAP_CONFIG = {
  baseUrl: process.env.SAP_B1_BASE_URL || "",
  companyDb: process.env.SAP_B1_COMPANY_DB || "",
  username: process.env.SAP_B1_USERNAME || "",
  password: process.env.SAP_B1_PASSWORD || "",
  timeoutMs: Number(process.env.SAP_B1_TIMEOUT_MS || 60000)
};

const logger = {
  debug: () => {},
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`)
};

async function testUdfWrite() {
  console.log("\n" + "=".repeat(70));
  console.log("  🧪 TESTE DE ESCRITA EM UDFs WMS");
  console.log("=".repeat(70) + "\n");

  const client = new SapServiceLayerClient({
    baseUrl: SAP_CONFIG.baseUrl,
    credentials: {
      companyDb: SAP_CONFIG.companyDb,
      username: SAP_CONFIG.username,
      password: SAP_CONFIG.password
    },
    timeoutMs: SAP_CONFIG.timeoutMs,
    retry: { maxAttempts: 3 },
    logger,
    correlationHeaderName: "X-Correlation-Id"
  });

  await client.login("test-udf-write");
  console.log("✅ Autenticado\n");

  // 1. Buscar um pedido para testar
  console.log("1️⃣  Buscando pedido para teste...");
  const ordersResponse = await client.get<{ value: any[] }>(
    "/Orders?$select=DocEntry,DocNum,CardCode,DocumentStatus&$top=1",
    { correlationId: "get-test-order" }
  );

  if (ordersResponse.data.value.length === 0) {
    console.log("   ❌ Nenhum pedido encontrado\n");
    process.exit(1);
  }

  const testOrder = ordersResponse.data.value[0];
  console.log(`   ✅ Pedido selecionado: DocEntry=${testOrder.DocEntry}, DocNum=${testOrder.DocNum}\n`);

  // 2. Ler estado atual dos UDFs
  console.log("2️⃣  Lendo estado atual dos UDFs...");
  try {
    const currentResponse = await client.get(
      `/Orders(${testOrder.DocEntry})?$select=DocEntry,DocNum,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID`,
      { correlationId: "read-before" }
    );

    const current = currentResponse.data as any;
    console.log("   📊 Estado atual:");
    console.log(`      U_WMS_STATUS: ${current.U_WMS_STATUS || "(vazio)"}`);
    console.log(`      U_WMS_ORDERID: ${current.U_WMS_ORDERID || "(vazio)"}`);
    console.log(`      U_WMS_LAST_EVENT: ${current.U_WMS_LAST_EVENT || "(vazio)"}`);
    console.log(`      U_WMS_LAST_TS: ${current.U_WMS_LAST_TS || "(vazio)"}`);
    console.log(`      U_WMS_CORR_ID: ${current.U_WMS_CORR_ID || "(vazio)"}`);
    console.log("");
  } catch (error: any) {
    console.log(`   ⚠️  Erro ao ler: ${error.message}\n`);
  }

  // 3. Tentar ESCREVER nos UDFs
  console.log("3️⃣  Tentando ESCREVER valores de teste nos UDFs...");
  
  const testData = {
    U_WMS_STATUS: "TESTE_INTEGRACAO",
    U_WMS_ORDERID: "WMS-TEST-001",
    U_WMS_LAST_EVENT: "TESTE_VALIDACAO",
    U_WMS_LAST_TS: new Date().toISOString(),
    U_WMS_CORR_ID: "test-corr-123"
  };

  console.log("   📝 Dados a escrever:");
  console.log(`      U_WMS_STATUS: ${testData.U_WMS_STATUS}`);
  console.log(`      U_WMS_ORDERID: ${testData.U_WMS_ORDERID}`);
  console.log(`      U_WMS_LAST_EVENT: ${testData.U_WMS_LAST_EVENT}`);
  console.log(`      U_WMS_LAST_TS: ${testData.U_WMS_LAST_TS}`);
  console.log(`      U_WMS_CORR_ID: ${testData.U_WMS_CORR_ID}\n`);

  try {
    const patchResponse = await client.patch(
      `/Orders(${testOrder.DocEntry})`,
      testData,
      { correlationId: "test-write" }
    );

    console.log("   ✅ ESCRITA BEM-SUCEDIDA!");
    console.log(`   📡 Status HTTP: ${patchResponse.status}\n`);

    // 4. Ler novamente para confirmar
    console.log("4️⃣  Lendo novamente para confirmar escrita...");
    const afterResponse = await client.get(
      `/Orders(${testOrder.DocEntry})?$select=DocEntry,DocNum,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID`,
      { correlationId: "read-after" }
    );

    const after = afterResponse.data as any;
    console.log("   📊 Estado após escrita:");
    console.log(`      U_WMS_STATUS: ${after.U_WMS_STATUS || "(vazio)"}`);
    console.log(`      U_WMS_ORDERID: ${after.U_WMS_ORDERID || "(vazio)"}`);
    console.log(`      U_WMS_LAST_EVENT: ${after.U_WMS_LAST_EVENT || "(vazio)"}`);
    console.log(`      U_WMS_LAST_TS: ${after.U_WMS_LAST_TS || "(vazio)"}`);
    console.log(`      U_WMS_CORR_ID: ${after.U_WMS_CORR_ID || "(vazio)"}`);
    console.log("");

    // Verificar se os valores foram persistidos
    const allWritten = 
      after.U_WMS_STATUS === testData.U_WMS_STATUS &&
      after.U_WMS_ORDERID === testData.U_WMS_ORDERID &&
      after.U_WMS_LAST_EVENT === testData.U_WMS_LAST_EVENT;

    if (allWritten) {
      console.log("=".repeat(70));
      console.log("  🎉 SUCESSO TOTAL!");
      console.log("  ✅ UDFs criados corretamente");
      console.log("  ✅ Escrita funcionando");
      console.log("  ✅ Leitura funcionando");
      console.log("  🚀 Integração WMS ↔ SAP totalmente operacional!");
      console.log("=".repeat(70) + "\n");
    } else {
      console.log("=".repeat(70));
      console.log("  ⚠️  ESCRITA PARCIAL");
      console.log("  Os UDFs aceitaram a escrita mas os valores não persistiram");
      console.log("  Possível causa: Permissões ou configuração do campo");
      console.log("=".repeat(70) + "\n");
    }

  } catch (error: any) {
    if (error.message.includes("204")) {
      console.log("   ✅ ESCRITA BEM-SUCEDIDA! (SAP retornou 204 No Content)\n");
    } else {
      console.log(`   ❌ ERRO AO ESCREVER: ${error.message}\n`);
      
      if (error.message.includes("400")) {
        console.log("   📝 Diagnóstico:");
        console.log("      - Erro 400 indica que os campos não existem ou nome está errado");
        console.log("      - Verifique se os UDFs foram criados na tabela ORDR (não RDR1)");
        console.log("      - Nome deve ser exatamente: WMS_STATUS (SAP adiciona U_ automaticamente)");
        console.log("      - Reinicie o IIS no servidor SAP: iisreset\n");
      } else if (error.message.includes("403")) {
        console.log("   📝 Diagnóstico:");
        console.log("      - Erro 403 indica falta de permissões");
        console.log("      - Verifique se o usuário tem permissão para editar pedidos\n");
      }

      console.log("=".repeat(70));
      console.log("  ❌ TESTE DE ESCRITA FALHOU");
      console.log("  📝 Siga as instruções de diagnóstico acima");
      console.log("=".repeat(70) + "\n");
      process.exit(1);
    }
  }
}

testUdfWrite().catch(error => {
  console.error("\n❌ Erro fatal:", error);
  process.exit(1);
});
