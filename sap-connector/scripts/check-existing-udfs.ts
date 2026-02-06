/**
 * Script para verificar UDFs existentes no SAP B1
 * 
 * Este script consulta o endpoint UserFieldsMD do Service Layer
 * para listar todos os User-Defined Fields criados na tabela ORDR.
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";

// Configuração
const SAP_CONFIG = {
  baseUrl: process.env.SAP_B1_BASE_URL || "",
  companyDb: process.env.SAP_B1_COMPANY_DB || "",
  username: process.env.SAP_B1_USERNAME || "",
  password: process.env.SAP_B1_PASSWORD || "",
  timeoutMs: Number(process.env.SAP_B1_TIMEOUT_MS || 60000)
};

const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {},
  info: (msg: string, meta?: Record<string, unknown>) => 
    console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ""),
  warn: (msg: string, meta?: Record<string, unknown>) => 
    console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ""),
  error: (msg: string, meta?: Record<string, unknown>) => 
    console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : "")
};

type UserFieldMD = {
  TableName: string;
  FieldID: number;
  Name: string;
  Type: string;
  Size: number;
  Description: string;
  SubType: string;
  EditSize?: number;
  Mandatory?: string;
  DefaultValue?: string;
};

async function checkExistingUdfs() {
  console.log("\n" + "=".repeat(70));
  console.log("  🔍 VERIFICAÇÃO DE UDFs EXISTENTES NO SAP B1");
  console.log("=".repeat(70) + "\n");

  // Verificar configuração
  if (!SAP_CONFIG.baseUrl || !SAP_CONFIG.companyDb || !SAP_CONFIG.username || !SAP_CONFIG.password) {
    console.error("❌ ERRO: Configuração SAP incompleta!\n");
    process.exit(1);
  }

  console.log("📝 Conectando ao SAP...");
  console.log(`   Base URL: ${SAP_CONFIG.baseUrl}`);
  console.log(`   Company DB: ${SAP_CONFIG.companyDb}\n`);

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
    logger,
    correlationHeaderName: "X-Correlation-Id"
  });

  try {
    // 1. Autenticar
    console.log("🔐 Autenticando...");
    await client.login("check-udfs");
    console.log("   ✅ Autenticação bem-sucedida\n");

    // 2. Buscar UDFs da tabela ORDR
    console.log("🔍 Buscando UDFs da tabela ORDR (Marketing Documents)...\n");
    
    const response = await client.get<{ value: UserFieldMD[] }>(
      "/UserFieldsMD?$filter=TableName eq 'ORDR'&$select=TableName,FieldID,Name,Type,Size,Description,SubType,EditSize,Mandatory,DefaultValue",
      { correlationId: "check-udfs-ordr" }
    );

    if (!response.data || !Array.isArray(response.data.value)) {
      console.log("⚠️  Resposta inesperada do SAP\n");
      process.exit(1);
    }

    const udfs = response.data.value;

    if (udfs.length === 0) {
      console.log("❌ NENHUM UDF ENCONTRADO na tabela ORDR!\n");
      console.log("📝 Os UDFs precisam ser criados no SAP B1 Client:");
      console.log("   1. Tools → Customization Tools → User-Defined Fields - Management");
      console.log("   2. Selecione tabela: ORDR (Marketing Documents)");
      console.log("   3. Crie os campos necessários\n");
      process.exit(1);
    }

    console.log(`✅ Encontrados ${udfs.length} UDFs na tabela ORDR:\n`);
    console.log("┌─────────────────────────────────────────────────────────────────┐");
    console.log("│ UDFs Existentes na Tabela ORDR                                 │");
    console.log("├──────────────────────┬──────────────┬──────────────────────────┤");
    console.log("│ Nome                 │ Tipo         │ Descrição                │");
    console.log("├──────────────────────┼──────────────┼──────────────────────────┤");

    for (const udf of udfs) {
      const name = udf.Name.padEnd(20);
      const type = `${udf.Type}${udf.Size ? `(${udf.Size})` : ""}`.padEnd(12);
      const desc = (udf.Description || "").substring(0, 24).padEnd(24);
      console.log(`│ ${name} │ ${type} │ ${desc} │`);
    }

    console.log("└──────────────────────┴──────────────┴──────────────────────────┘\n");

    // 3. Verificar UDFs WMS específicos
    const wmsUdfs = udfs.filter(u => u.Name.startsWith("U_WMS_") || u.Name.startsWith("WMS_"));
    
    console.log("🏷️  UDFs do WMS:");
    if (wmsUdfs.length === 0) {
      console.log("   ❌ Nenhum UDF do WMS encontrado (começando com U_WMS_ ou WMS_)\n");
      console.log("   📝 Campos necessários:");
      console.log("      - U_WMS_STATUS (ou WMS_STATUS)");
      console.log("      - U_WMS_ORDERID (ou WMS_ORDERID)");
      console.log("      - U_WMS_LAST_EVENT (ou WMS_LAST_EVENT)");
      console.log("      - U_WMS_LAST_TS (ou WMS_LAST_TS)");
      console.log("      - U_WMS_CORR_ID (ou WMS_CORR_ID)\n");
    } else {
      console.log("");
      for (const udf of wmsUdfs) {
        const mandatory = udf.Mandatory === "tYES" ? " (obrigatório)" : "";
        const defaultVal = udf.DefaultValue ? ` [default: ${udf.DefaultValue}]` : "";
        console.log(`   ✅ ${udf.Name} - ${udf.Description}${mandatory}${defaultVal}`);
      }
      console.log("");

      // Verificar se tem todos os necessários
      const requiredUdfs = [
        "U_WMS_STATUS", "WMS_STATUS",
        "U_WMS_ORDERID", "WMS_ORDERID",
        "U_WMS_LAST_EVENT", "WMS_LAST_EVENT",
        "U_WMS_LAST_TS", "WMS_LAST_TS",
        "U_WMS_CORR_ID", "WMS_CORR_ID"
      ];

      const foundNames = wmsUdfs.map(u => u.Name);
      const hasStatus = foundNames.some(n => n === "U_WMS_STATUS" || n === "WMS_STATUS");
      const hasOrderId = foundNames.some(n => n === "U_WMS_ORDERID" || n === "WMS_ORDERID");
      const hasEvent = foundNames.some(n => n === "U_WMS_LAST_EVENT" || n === "WMS_LAST_EVENT");
      const hasTs = foundNames.some(n => n === "U_WMS_LAST_TS" || n === "WMS_LAST_TS");
      const hasCorr = foundNames.some(n => n === "U_WMS_CORR_ID" || n === "WMS_CORR_ID");

      console.log("📋 Checklist de UDFs Necessários:");
      console.log(`   ${hasStatus ? "✅" : "❌"} Status (U_WMS_STATUS ou WMS_STATUS)`);
      console.log(`   ${hasOrderId ? "✅" : "❌"} Order ID (U_WMS_ORDERID ou WMS_ORDERID)`);
      console.log(`   ${hasEvent ? "✅" : "❌"} Last Event (U_WMS_LAST_EVENT ou WMS_LAST_EVENT)`);
      console.log(`   ${hasTs ? "✅" : "❌"} Timestamp (U_WMS_LAST_TS ou WMS_LAST_TS)`);
      console.log(`   ${hasCorr ? "✅" : "❌"} Correlation ID (U_WMS_CORR_ID ou WMS_CORR_ID)\n`);

      if (hasStatus && hasOrderId && hasEvent && hasTs && hasCorr) {
        console.log("🎉 SUCESSO! Todos os UDFs necessários estão criados!\n");
      } else {
        console.log("⚠️  Alguns UDFs ainda precisam ser criados.\n");
      }
    }

    // 4. Testar leitura em um pedido real
    console.log("🧪 Testando leitura de UDFs em um pedido...");
    
    const ordersResponse = await client.get<{ value: any[] }>(
      "/Orders?$select=DocEntry&$top=1",
      { correlationId: "check-udfs-order" }
    );

    if (ordersResponse.data.value.length > 0) {
      const docEntry = ordersResponse.data.value[0].DocEntry;
      
      // Montar select com todos os UDFs WMS encontrados
      const wmsUdfNames = wmsUdfs.map(u => u.Name).join(",");
      const selectClause = wmsUdfNames ? `DocEntry,DocNum,${wmsUdfNames}` : "DocEntry,DocNum";
      
      try {
        const orderResponse = await client.get(
          `/Orders(${docEntry})?$select=${selectClause}`,
          { correlationId: "check-udfs-read" }
        );

        console.log(`   ✅ Pedido ${orderResponse.data.DocNum} lido com sucesso`);
        console.log("   📊 Valores dos UDFs:");
        
        for (const udf of wmsUdfs) {
          const value = (orderResponse.data as any)[udf.Name];
          console.log(`      ${udf.Name}: ${value || "(vazio)"}`);
        }
        console.log("");
      } catch (error: any) {
        console.log(`   ⚠️  Erro ao ler UDFs: ${error.message}\n`);
      }
    }

    console.log("=".repeat(70));
    console.log("  ✅ VERIFICAÇÃO CONCLUÍDA");
    console.log("=".repeat(70) + "\n");

  } catch (error) {
    console.error("\n❌ Erro fatal:", error);
    console.log("");
    process.exit(1);
  }
}

// Executar
checkExistingUdfs();
