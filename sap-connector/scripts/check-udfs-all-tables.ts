/**
 * Busca UDFs WMS em TODAS as tabelas possíveis
 * 
 * Investiga onde os campos foram criados e se estão acessíveis.
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

async function checkUdfsAllTables() {
  console.log("\n" + "=".repeat(70));
  console.log("  🔍 INVESTIGAÇÃO COMPLETA DE UDFs WMS");
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

  await client.login("check-udfs-all");
  console.log("✅ Autenticado\n");

  // Tabelas possíveis onde os UDFs podem ter sido criados
  const tablesToCheck = [
    "ORDR",  // Marketing Documents (Header) - CORRETO
    "RDR1",  // Marketing Documents (Rows) - ERRADO mas comum
    "@ORDR", // User-Defined Object (se criaram UDT)
    "OQUT",  // Quotations
    "ODLN"   // Delivery Notes
  ];

  console.log("🔍 Buscando UDFs WMS em todas as tabelas...\n");

  let totalWmsUdfs = 0;

  for (const table of tablesToCheck) {
    console.log(`📋 Tabela: ${table}`);
    console.log("   " + "-".repeat(50));

    try {
      const response = await client.get<{ value: any[] }>(
        `/UserFieldsMD?$filter=TableName eq '${table}'`,
        { correlationId: `check-${table}` }
      );

      const udfs = response.data.value;
      const wmsUdfs = udfs.filter(u => 
        u.Name.includes("WMS") || u.Name.includes("wms")
      );

      if (wmsUdfs.length > 0) {
        console.log(`   ✅ Encontrados ${wmsUdfs.length} UDFs WMS:`);
        for (const udf of wmsUdfs) {
          console.log(`      - ${udf.Name} (${udf.Type}) - ${udf.Description}`);
          totalWmsUdfs++;
        }
      } else {
        console.log(`   ⚪ Nenhum UDF WMS encontrado (${udfs.length} UDFs no total)`);
      }
      console.log("");
    } catch (error: any) {
      console.log(`   ⚠️  Erro ao consultar: ${error.message}\n`);
    }
  }

  // Buscar TODOS os UDFs que contenham "WMS" em qualquer tabela
  console.log("🔎 Busca global por UDFs contendo 'WMS'...");
  console.log("   " + "-".repeat(50));

  try {
    const response = await client.get<{ value: any[] }>(
      "/UserFieldsMD?$select=TableName,FieldID,Name,Type,Description",
      { correlationId: "check-all-tables" }
    );

    const allWmsUdfs = response.data.value.filter(u => 
      u.Name.toUpperCase().includes("WMS")
    );

    if (allWmsUdfs.length > 0) {
      console.log(`   ✅ Encontrados ${allWmsUdfs.length} UDFs com 'WMS' no sistema:\n`);
      
      // Agrupar por tabela
      const byTable: Record<string, any[]> = {};
      for (const udf of allWmsUdfs) {
        if (!byTable[udf.TableName]) {
          byTable[udf.TableName] = [];
        }
        byTable[udf.TableName].push(udf);
      }

      for (const [table, udfs] of Object.entries(byTable)) {
        console.log(`   📋 Tabela ${table}:`);
        for (const udf of udfs) {
          console.log(`      ✅ ${udf.Name} - ${udf.Description}`);
        }
        console.log("");
      }
    } else {
      console.log("   ❌ Nenhum UDF com 'WMS' encontrado em nenhuma tabela\n");
    }
  } catch (error: any) {
    console.log(`   ⚠️  Erro: ${error.message}\n`);
  }

  // Tentar ler um pedido com todos os possíveis nomes de UDF
  console.log("🧪 Testando leitura de UDFs em um pedido real...");
  console.log("   " + "-".repeat(50));

  try {
    // Buscar um pedido
    const ordersResponse = await client.get<{ value: any[] }>(
      "/Orders?$select=DocEntry,DocNum&$top=1",
      { correlationId: "get-order-for-test" }
    );

    if (ordersResponse.data.value.length === 0) {
      console.log("   ⚠️  Nenhum pedido encontrado para testar\n");
    } else {
      const docEntry = ordersResponse.data.value[0].DocEntry;
      console.log(`   📄 Testando pedido DocEntry=${docEntry}\n`);

      // Tentar diferentes variações de nome
      const variations = [
        "U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID",
        "WMS_STATUS,WMS_ORDERID,WMS_LAST_EVENT,WMS_LAST_TS,WMS_CORR_ID",
        "U_WMSSTATUS,U_WMSORDERID,U_WMSLASTEVENT,U_WMSLASTTS,U_WMSCORRID"
      ];

      for (let i = 0; i < variations.length; i++) {
        console.log(`   🔍 Tentativa ${i + 1}: ${variations[i].split(',')[0]}...`);
        
        try {
          const orderResponse = await client.get(
            `/Orders(${docEntry})?$select=DocEntry,DocNum,${variations[i]}`,
            { correlationId: `test-variation-${i}` }
          );

          console.log(`      ✅ SUCESSO! UDFs encontrados com este padrão:\n`);
          
          const data = orderResponse.data as any;
          const fields = variations[i].split(',');
          
          for (const field of fields) {
            const value = data[field];
            const exists = value !== undefined && value !== null;
            console.log(`         ${exists ? "✅" : "⚪"} ${field}: ${exists ? value || "(vazio)" : "(não existe)"}`);
          }
          
          console.log("\n   🎉 Padrão correto identificado!\n");
          break;
        } catch (error: any) {
          if (error.message.includes("400") || error.message.includes("invalid")) {
            console.log(`      ❌ Padrão não funciona (campos não existem ou nome incorreto)\n`);
          } else {
            console.log(`      ⚠️  Erro: ${error.message}\n`);
          }
        }
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.message}\n`);
  }

  console.log("=".repeat(70));
  console.log("  📊 RESUMO");
  console.log("=".repeat(70));
  console.log(`  Total de UDFs WMS encontrados: ${totalWmsUdfs}`);
  console.log("=".repeat(70) + "\n");
}

checkUdfsAllTables().catch(error => {
  console.error("\n❌ Erro fatal:", error);
  process.exit(1);
});
