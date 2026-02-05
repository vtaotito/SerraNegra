/**
 * Script de Validação de Setup SAP B1
 * 
 * Valida:
 * 1. Conectividade com SAP B1 Service Layer
 * 2. Existência de UDFs necessários
 * 3. Acesso aos endpoints principais
 * 4. Performance básica
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import type { SapOrder, SapOrdersCollection } from "../src/types.js";

// Configuração
const SAP_CONFIG = {
  baseUrl: process.env.SAP_B1_BASE_URL || "",
  companyDb: process.env.SAP_B1_COMPANY_DB || "",
  username: process.env.SAP_B1_USERNAME || "",
  password: process.env.SAP_B1_PASSWORD || "",
  timeoutMs: Number(process.env.SAP_B1_TIMEOUT_MS || 60000)
};

const REQUIRED_UDFS = [
  "U_WMS_STATUS",
  "U_WMS_ORDERID",
  "U_WMS_LAST_EVENT",
  "U_WMS_LAST_TS",
  "U_WMS_CORR_ID"
];

// Logger
const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {},
  info: (msg: string, meta?: Record<string, unknown>) => 
    console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ""),
  warn: (msg: string, meta?: Record<string, unknown>) => 
    console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ""),
  error: (msg: string, meta?: Record<string, unknown>) => 
    console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : "")
};

async function validateSapSetup() {
  console.log("\n" + "=".repeat(70));
  console.log("  🔍 VALIDAÇÃO DE SETUP SAP B1");
  console.log("=".repeat(70) + "\n");

  // Verificar configuração
  if (!SAP_CONFIG.baseUrl || !SAP_CONFIG.companyDb || !SAP_CONFIG.username || !SAP_CONFIG.password) {
    console.error("❌ ERRO: Configuração SAP incompleta!");
    console.error("   Configure as variáveis de ambiente:");
    console.error("   - SAP_B1_BASE_URL");
    console.error("   - SAP_B1_COMPANY_DB");
    console.error("   - SAP_B1_USERNAME");
    console.error("   - SAP_B1_PASSWORD\n");
    process.exit(1);
  }

  console.log("📝 Configuração:");
  console.log(`   Base URL: ${SAP_CONFIG.baseUrl}`);
  console.log(`   Company DB: ${SAP_CONFIG.companyDb}`);
  console.log(`   Username: ${SAP_CONFIG.username}`);
  console.log(`   Timeout: ${SAP_CONFIG.timeoutMs}ms\n`);

  // Criar cliente
  const client = new SapServiceLayerClient({
    baseUrl: SAP_CONFIG.baseUrl,
    credentials: {
      companyDb: SAP_CONFIG.companyDb,
      username: SAP_CONFIG.username,
      password: SAP_CONFIG.password
    },
    timeoutMs: SAP_CONFIG.timeoutMs,
    retry: {
      maxAttempts: 3
    },
    rateLimit: {
      maxConcurrent: 4,
      maxRps: 5
    },
    logger,
    correlationHeaderName: "X-Correlation-Id"
  });

  let allPassed = true;

  // 1. Teste de Autenticação
  console.log("1️⃣  Teste de Autenticação");
  console.log("   " + "-".repeat(50));
  try {
    const start = Date.now();
    await client.login("validate-setup");
    const duration = Date.now() - start;
    console.log(`   ✅ Autenticação bem-sucedida (${duration}ms)\n`);
  } catch (error) {
    console.error(`   ❌ Falha na autenticação: ${error}\n`);
    allPassed = false;
    process.exit(1);
  }

  // 2. Teste de Endpoint Orders
  console.log("2️⃣  Teste de Endpoint Orders");
  console.log("   " + "-".repeat(50));
  try {
    const start = Date.now();
    const response = await client.get<SapOrdersCollection>(
      "/Orders?$select=DocEntry,DocNum,CardCode,DocumentStatus&$top=5",
      { correlationId: "validate-orders" }
    );
    const duration = Date.now() - start;
    
    if (response.data && Array.isArray(response.data.value)) {
      console.log(`   ✅ Endpoint Orders acessível (${duration}ms)`);
      console.log(`   📊 Encontrados ${response.data.value.length} pedidos`);
      
      if (response.data.value.length > 0) {
        const order = response.data.value[0]!;
        console.log(`   📄 Primeiro pedido: DocEntry=${order.DocEntry}, DocNum=${order.DocNum}\n`);
      }
    } else {
      console.error("   ❌ Resposta inesperada do endpoint Orders\n");
      allPassed = false;
    }
  } catch (error) {
    console.error(`   ❌ Falha ao acessar Orders: ${error}\n`);
    allPassed = false;
  }

  // 3. Teste de UDFs
  console.log("3️⃣  Verificação de UDFs");
  console.log("   " + "-".repeat(50));
  try {
    // Tentar buscar um pedido com UDFs (usar query corrigida)
    const listResponse = await client.get<SapOrdersCollection>(
      "/Orders?$select=DocEntry,DocNum&$top=1",
      { correlationId: "validate-udf-list" }
    );

    if (listResponse.data.value.length === 0) {
      console.log("   ⚠️  Sem pedidos para testar UDFs\n");
    } else {
      const docEntry = listResponse.data.value[0]!.DocEntry;
      
      // Tentar buscar pedido com UDFs - pode falhar se UDFs não existirem
      try {
        const udfResponse = await client.get<SapOrder>(
          `/Orders(${docEntry})?$select=DocEntry,DocNum,${REQUIRED_UDFS.join(",")}`,
          { correlationId: "validate-udfs" }
        );

        if (udfResponse.data) {
          console.log("   📋 Status dos UDFs:");
          
          let foundUdfs = 0;
          for (const udf of REQUIRED_UDFS) {
            const value = (udfResponse.data as any)[udf];
            const exists = value !== undefined && value !== null;
            
            if (exists) {
              console.log(`      ✅ ${udf}: ${value || "(vazio)"}`);
              foundUdfs++;
            } else {
              console.log(`      ⚠️  ${udf}: (não encontrado)`);
            }
          }

          if (foundUdfs === 0) {
            console.log("\n   ⚠️  ATENÇÃO: Nenhum UDF encontrado!");
            console.log("   📝 Para criar UDFs no SAP B1:");
            console.log("      1. Abra o SAP B1 Client");
            console.log("      2. Tools → Customization Tools → User-Defined Fields");
            console.log("      3. Selecione tabela: Marketing Documents - Rows (RDR1/ORDR)");
            console.log("      4. Crie os seguintes campos:");
            REQUIRED_UDFS.forEach(udf => {
              console.log(`         - ${udf} (tipo: Text, tamanho: 100)`);
            });
            console.log("");
          } else if (foundUdfs < REQUIRED_UDFS.length) {
            console.log(`\n   ⚠️  Apenas ${foundUdfs}/${REQUIRED_UDFS.length} UDFs encontrados\n`);
          } else {
            console.log(`\n   ✅ Todos os ${REQUIRED_UDFS.length} UDFs estão configurados!\n`);
          }
        }
      } catch (innerError: any) {
        if (innerError.message && (innerError.message.includes("invalid") || innerError.message.includes("400"))) {
          console.log("\n   ⚠️  UDFs não estão criados no SAP!");
          console.log("   📝 Para criar UDFs:");
          console.log("      1. Abra SAP B1 Client");
          console.log("      2. Tools → Customization Tools → User-Defined Fields");
          console.log("      3. Tabela: Marketing Documents - Rows (ORDR)");
          console.log("      4. Crie os seguintes campos:");
          REQUIRED_UDFS.forEach(udf => {
            console.log(`         - ${udf} (Alphanumeric, 100 caracteres)`);
          });
          console.log("");
        } else {
          throw innerError;
        }
      }
    }
  } catch (error: any) {
    console.error(`   ❌ Erro ao verificar UDFs: ${error}\n`);
    allPassed = false;
  }

  // 4. Teste de Performance
  console.log("4️⃣  Teste de Performance");
  console.log("   " + "-".repeat(50));
  try {
    const tests = [
      { name: "Query simples", path: "/Orders?$select=DocEntry,DocNum&$top=1" },
      { name: "Query com filtro", path: "/Orders?$select=DocEntry&$filter=DocumentStatus eq 'bost_Open'&$top=5" },
      { name: "Query com expand", path: "/Orders?$select=DocEntry,DocNum&$expand=DocumentLines&$top=1" }
    ];

    for (const test of tests) {
      const start = Date.now();
      await client.get(test.path, { correlationId: `perf-${test.name}` });
      const duration = Date.now() - start;
      
      const status = duration < 2000 ? "✅" : duration < 5000 ? "⚠️" : "❌";
      console.log(`   ${status} ${test.name}: ${duration}ms`);
    }
    console.log("");
  } catch (error) {
    console.error(`   ❌ Erro no teste de performance: ${error}\n`);
    allPassed = false;
  }

  // 5. Teste de Items
  console.log("5️⃣  Teste de Endpoint Items");
  console.log("   " + "-".repeat(50));
  try {
    const start = Date.now();
    const response = await client.get(
      "/Items?$select=ItemCode,ItemName,Valid&$top=5",
      { correlationId: "validate-items" }
    );
    const duration = Date.now() - start;
    
    if (response.data && Array.isArray(response.data.value)) {
      console.log(`   ✅ Endpoint Items acessível (${duration}ms)`);
      console.log(`   📦 Encontrados ${response.data.value.length} itens\n`);
    }
  } catch (error) {
    console.error(`   ❌ Falha ao acessar Items: ${error}\n`);
    allPassed = false;
  }

  // Resultado Final
  console.log("=".repeat(70));
  if (allPassed) {
    console.log("  ✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log("  🚀 Sistema pronto para integração SAP B1");
  } else {
    console.log("  ⚠️  VALIDAÇÃO CONCLUÍDA COM AVISOS");
    console.log("  📝 Corrija os problemas acima antes de prosseguir");
  }
  console.log("=".repeat(70) + "\n");

  process.exit(allPassed ? 0 : 1);
}

// Executar
validateSapSetup().catch(error => {
  console.error("\n❌ Erro fatal:", error);
  process.exit(1);
});
