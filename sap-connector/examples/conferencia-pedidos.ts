/**
 * Script de conferência: valida conexão SAP B1 e lista pedidos da base SBO_GARRAFARIA_TST.
 *
 * Para rodar:
 * npm run build && node dist/sap-connector/examples/conferencia-pedidos.js
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import type { ServiceLayerOrder } from "../../mappings/src/order.js";
import { mapOrderFromSapB1 } from "../../mappings/src/order.js";

// Carregar configuração do .env
const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "https://sap-garrafariasnegra-sl.skyinone.net:50000",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "SBO_GARRAFARIA_TST",
  username: process.env.SAP_B1_USERNAME ?? "lorenzo.naves",
  password: process.env.SAP_B1_PASSWORD ?? "382105",
  timeoutMs: parseInt(process.env.SAP_B1_TIMEOUT_MS ?? "20000", 10),
  maxAttempts: parseInt(process.env.SAP_B1_MAX_ATTEMPTS ?? "5", 10)
};

// Logger colorido para console
const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    console.log(`🔍 [DEBUG] ${msg}`, meta ? JSON.stringify(meta, null, 2) : "");
  },
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(`ℹ️  [INFO] ${msg}`, meta ? JSON.stringify(meta, null, 2) : "");
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(`⚠️  [WARN] ${msg}`, meta ? JSON.stringify(meta, null, 2) : "");
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(`❌ [ERROR] ${msg}`, meta ? JSON.stringify(meta, null, 2) : "");
  }
};

async function main() {
  console.log("========================================");
  console.log("🔍 CONFERÊNCIA DE PEDIDOS - SAP B1");
  console.log("========================================\n");

  console.log("📋 Configuração:");
  console.log(`   Base URL: ${config.baseUrl}`);
  console.log(`   Company DB: ${config.companyDb}`);
  console.log(`   Username: ${config.username}`);
  console.log(`   Timeout: ${config.timeoutMs}ms`);
  console.log("");

  // Validar que estamos na base correta
  if (config.companyDb !== "SBO_GARRAFARIA_TST") {
    console.error("❌ ERRO: Base de dados incorreta!");
    console.error(`   Esperado: SBO_GARRAFARIA_TST`);
    console.error(`   Atual: ${config.companyDb}`);
    process.exit(1);
  }

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password
    },
    logger,
    timeoutMs: config.timeoutMs,
    retry: {
      maxAttempts: config.maxAttempts,
      baseDelayMs: 500,
      maxDelayMs: 10_000,
      jitterRatio: 0.2
    }
  });

  const correlationId = `conferencia-${Date.now()}`;

  try {
    // 1. Login
    logger.info("Fazendo login no SAP Service Layer...");
    await client.login(correlationId);
    logger.info("✅ Login realizado com sucesso!\n");

    // 2. Confirmar database conectada
    console.log("📊 Database conectada:");
    console.log(`   ${config.companyDb} ✅`);
    console.log("");

    // 3. Consultar pedidos (Orders) - usando campos básicos
    logger.info("Consultando pedidos (Orders) na base SBO_GARRAFARIA_TST...");
    const ordersRes = await client.get<{ value: ServiceLayerOrder[] }>(
      "/Orders?$top=10&$select=DocEntry,DocNum,CardCode&$orderby=DocEntry desc",
      { correlationId }
    );

    const orders = ordersRes.data.value ?? [];
    logger.info(`✅ ${orders.length} pedido(s) encontrado(s).\n`);

    if (orders.length === 0) {
      console.log("⚠️  Nenhum pedido encontrado na base SBO_GARRAFARIA_TST.");
      console.log("   Verifique se existem pedidos cadastrados no SAP.");
    } else {
      console.log("========================================");
      console.log("📦 PEDIDOS ENCONTRADOS");
      console.log("========================================\n");

      for (let i = 0; i < orders.length; i++) {
        const sapOrder = orders[i]!;

        console.log(`--- Pedido ${i + 1}/${orders.length} ---`);
        console.log(`📄 SAP B1 (Original):`);
        console.log(`   DocEntry: ${sapOrder.DocEntry}`);
        console.log(`   DocNum: ${sapOrder.DocNum}`);
        console.log(`   Cliente: ${sapOrder.CardCode}`);
        
        // Buscar linhas do pedido separadamente
        try {
          const linesRes = await client.get<{ value: Array<{ LineNum: number; ItemCode: string; Quantity: number; WarehouseCode?: string }> }>(
            `/Orders(${sapOrder.DocEntry})/DocumentLines?$select=LineNum,ItemCode,Quantity,WarehouseCode`,
            { correlationId }
          );
          const lines = linesRes.data.value ?? [];
          sapOrder.DocumentLines = lines.map(l => ({
            LineNum: l.LineNum,
            ItemCode: l.ItemCode,
            Quantity: l.Quantity,
            WarehouseCode: l.WarehouseCode
          }));
          
          console.log(`   Itens: ${lines.length}`);
          if (lines.length > 0) {
            console.log(`   Produtos:`);
            for (const line of lines.slice(0, 3)) {
              console.log(`      - ${line.ItemCode} (${line.Quantity} un) [${line.WarehouseCode ?? "sem depósito"}]`);
            }
            if (lines.length > 3) {
              console.log(`      ... e mais ${lines.length - 3} item(ns)`);
            }
          }

          const wmsOrder = mapOrderFromSapB1(sapOrder);
          console.log(`\n🗺️  WMS (Mapeado):`);
          console.log(`   External Order ID: ${wmsOrder.externalOrderId}`);
          console.log(`   Customer ID: ${wmsOrder.customerId}`);
          console.log(`   SAP Doc ID: ${wmsOrder.sapDocumentId}`);
          console.log(`   Itens WMS: ${wmsOrder.items.length}`);
        } catch (err) {
          console.log(`   ⚠️  Não foi possível buscar itens: ${err}`);
        }
        console.log("");
      }
    }

    // 4. Contar total de pedidos
    logger.info("Contando total de pedidos...");
    try {
      const countRes = await client.get<{ value: number }>(
        "/Orders/$count",
        { correlationId }
      );
      console.log("========================================");
      console.log("📊 ESTATÍSTICAS DE PEDIDOS");
      console.log("========================================");
      console.log(`   Total de pedidos na base: ${countRes.data.value ?? countRes.data}`);
      console.log("");
    } catch (err) {
      logger.warn("Não foi possível contar pedidos.");
    }

    // 5. Logout
    logger.info("Fazendo logout...");
    await client.logout(correlationId);
    logger.info("✅ Logout OK.\n");

    console.log("========================================");
    console.log("✅ CONFERÊNCIA CONCLUÍDA COM SUCESSO!");
    console.log("========================================");
    console.log(`Base de dados confirmada: ${config.companyDb}`);
    console.log(`Total de pedidos consultados: ${orders.length}`);
    console.log("");

  } catch (err) {
    logger.error("Erro durante a conferência:", { error: String(err) });
    console.error("\n❌ CONFERÊNCIA FALHOU!");
    console.error("Detalhes do erro:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro crítico:", err);
  process.exit(1);
});
