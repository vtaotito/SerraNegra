/**
 * Script de investigação: descobre endpoints alternativos disponíveis no SAP B1 Service Layer.
 * Testa SQLQueries, $metadata e outros recursos.
 *
 * Para rodar:
 * npm run sap:investigar-endpoints
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import { writeFileSync } from "fs";
import { join } from "path";

const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "",
  username: process.env.SAP_B1_USERNAME ?? "",
  password: process.env.SAP_B1_PASSWORD ?? "",
  timeoutMs: parseInt(process.env.SAP_B1_TIMEOUT_MS ?? "60000", 10)
};

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`)
};

async function testEndpoint(
  client: SapServiceLayerClient,
  name: string,
  path: string,
  correlationId: string
): Promise<{ available: boolean; details?: string; error?: string }> {
  try {
    const res = await client.get<unknown>(path, { correlationId });
    return {
      available: true,
      details: typeof res.data === "object" ? JSON.stringify(res.data).slice(0, 200) : String(res.data).slice(0, 200)
    };
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    if (error.status === 404) {
      return { available: false, error: "404 Not Found" };
    }
    if (error.status === 400) {
      return { available: false, error: "400 Bad Request (pode precisar de parâmetros)" };
    }
    return { available: false, error: String(error.message ?? err).slice(0, 100) };
  }
}

async function main() {
  console.log("\n========================================");
  console.log("🔍 INVESTIGAÇÃO DE ENDPOINTS - SAP B1");
  console.log("========================================\n");

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password
    },
    timeoutMs: config.timeoutMs,
    retry: { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 3000, jitterRatio: 0.1 },
    circuitBreaker: { failureThreshold: 20, successThreshold: 2, openStateTimeoutMs: 60000 }
  });

  const correlationId = `investig-${Date.now()}`;
  const results: Array<{ endpoint: string; available: boolean; details?: string; error?: string }> = [];

  try {
    logger.info("Autenticando...");
    await client.login(correlationId);
    logger.success("Login OK\n");

    // Lista de endpoints para testar
    const endpointsToTest = [
      { name: "SQLQueries", path: "/SQLQueries" },
      { name: "SQLQueries (sample)", path: "/SQLQueries('test')" },
      { name: "QueryService", path: "/QueryService" },
      { name: "Items (produtos)", path: "/Items?$top=1&$select=ItemCode,ItemName" },
      { name: "BusinessPartners (clientes)", path: "/BusinessPartners?$top=1&$select=CardCode,CardName" },
      { name: "Warehouses (depósitos)", path: "/Warehouses?$top=1&$select=WarehouseCode,WarehouseName" },
      { name: "InventoryGenEntries", path: "/InventoryGenEntries?$top=1" },
      { name: "DeliveryNotes", path: "/DeliveryNotes?$top=1&$select=DocEntry,DocNum" },
      { name: "Invoices", path: "/Invoices?$top=1&$select=DocEntry,DocNum" },
      { name: "PurchaseOrders", path: "/PurchaseOrders?$top=1&$select=DocEntry,DocNum" },
      { name: "StockTransfers", path: "/StockTransfers?$top=1" },
      { name: "InventoryPostings", path: "/InventoryPostings?$top=1" },
      { name: "SeriesService", path: "/SeriesService" },
      { name: "UserDefaultGroups", path: "/UserDefaultGroups" },
      { name: "SalesPersons", path: "/SalesPersons?$top=1" },
      { name: "BinLocations", path: "/BinLocations?$top=1&$select=AbsEntry,BinCode" },
      { name: "ItemWarehouseInfo", path: "/ItemWarehouseInfoCollection?$top=1" }
    ];

    console.log("========================================");
    console.log("🧪 TESTANDO ENDPOINTS");
    console.log("========================================\n");

    for (const endpoint of endpointsToTest) {
      process.stdout.write(`Testando ${endpoint.name.padEnd(30)}... `);
      const result = await testEndpoint(client, endpoint.name, endpoint.path, correlationId);
      results.push({ endpoint: endpoint.name, ...result });

      if (result.available) {
        logger.success("Disponível");
        if (result.details) {
          console.log(`   Preview: ${result.details}`);
        }
      } else {
        logger.error(`Indisponível (${result.error})`);
      }
    }

    // Testar $metadata (estrutura OData)
    console.log("\n========================================");
    console.log("📋 TESTANDO $metadata");
    console.log("========================================\n");

    logger.info("Buscando $metadata (pode demorar)...");
    try {
      const metadataUrl = `${config.baseUrl}/b1s/v1/$metadata`;
      const metadataRes = await fetch(metadataUrl, {
        headers: {
          accept: "application/xml"
        }
      });

      if (metadataRes.ok) {
        const xml = await metadataRes.text();
        const metadataPath = join(process.cwd(), "sap-connector", "service-layer-metadata.xml");
        writeFileSync(metadataPath, xml, "utf-8");
        logger.success(`$metadata disponível (${(xml.length / 1024).toFixed(1)} KB)`);
        logger.info(`Salvo em: sap-connector/service-layer-metadata.xml`);

        // Contar entidades no metadata
        const entityMatches = xml.match(/<EntityType Name="([^"]+)"/g);
        const entityCount = entityMatches ? entityMatches.length : 0;
        console.log(`   Entidades encontradas: ${entityCount}`);
      } else {
        logger.warn("$metadata não acessível");
      }
    } catch (err) {
      logger.warn(`Erro ao buscar $metadata: ${err}`);
    }

    // Testar criação de SQLQuery (se disponível)
    console.log("\n========================================");
    console.log("🔍 TESTANDO SQLQueries (avançado)");
    console.log("========================================\n");

    const sqlQueriesAvailable = results.find(r => r.endpoint === "SQLQueries")?.available;

    if (sqlQueriesAvailable) {
      logger.info("SQLQueries está disponível!");
      logger.info("Tentando listar queries existentes...");

      try {
        const queriesRes = await client.get<{ value: Array<{ QueryCategory: number; QueryDescription: string }> }>(
          "/SQLQueries",
          { correlationId }
        );
        const queries = queriesRes.data.value ?? [];
        logger.success(`${queries.length} query(ies) encontrada(s)`);

        if (queries.length > 0) {
          console.log("\nPrimeiras 5 queries:");
          for (const query of queries.slice(0, 5)) {
            console.log(`   - ${query.QueryDescription} (Cat: ${query.QueryCategory})`);
          }
        }
      } catch (err) {
        logger.warn("Não foi possível listar queries");
      }
    } else {
      logger.warn("SQLQueries não está disponível neste Service Layer");
    }

    // Logout
    await client.logout(correlationId);

    // Resumo final
    console.log("\n========================================");
    console.log("📊 RESUMO DOS ENDPOINTS");
    console.log("========================================\n");

    const available = results.filter(r => r.available);
    const unavailable = results.filter(r => !r.available);

    console.log(`✅ Disponíveis: ${available.length}/${results.length}`);
    console.log(`❌ Indisponíveis: ${unavailable.length}/${results.length}\n`);

    console.log("Endpoints Disponíveis:");
    for (const r of available) {
      console.log(`   ✅ ${r.endpoint}`);
    }

    if (unavailable.length > 0) {
      console.log("\nEndpoints Indisponíveis:");
      for (const r of unavailable) {
        console.log(`   ❌ ${r.endpoint}`);
      }
    }

    // Salvar relatório
    const report = {
      timestamp: new Date().toISOString(),
      database: config.companyDb,
      serviceLayerUrl: config.baseUrl,
      totalEndpoints: results.length,
      available: available.length,
      unavailable: unavailable.length,
      endpoints: results
    };

    const reportPath = join(process.cwd(), "sap-connector", "endpoints-investigation.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
    logger.success(`\nRelatório salvo em: sap-connector/endpoints-investigation.json`);

    console.log("\n========================================");
    console.log("✅ INVESTIGAÇÃO CONCLUÍDA");
    console.log("========================================\n");

  } catch (err) {
    logger.error(`Falha: ${err}`);
    console.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
