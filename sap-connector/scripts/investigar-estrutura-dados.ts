/**
 * Investigação da Estrutura de Dados do SAP B1
 *
 * Consulta o SAP real e captura a estrutura completa de:
 *   1. Orders (Pedidos de Venda) + DocumentLines
 *   2. Items (Produtos/Itens)
 *   3. BusinessPartners (Clientes)
 *   4. Warehouses (Depósitos)
 *   5. DeliveryNotes (Notas de Entrega)
 *   6. Invoices (Notas Fiscais)
 *   7. StockTransfers (Transferências de Estoque)
 *   8. InventoryGenEntries (Entradas de Inventário)
 *
 * Saída: JSON com 1 amostra de cada entidade + lista de campos.
 * Salva em: sap-connector/data/estrutura-dados-sap.json
 *
 * Pré-requisito: preencher .env com credenciais reais:
 *   SAP_B1_BASE_URL=https://sap-garrafariasnegra-sl.skyinone.net:50000
 *   SAP_B1_COMPANY_DB=SBO_GARRAFARIA_TST
 *   SAP_B1_USERNAME=lorenzo.naves
 *   SAP_B1_PASSWORD=<senha real>
 *
 * Rodar: npm run sap:investigar-estrutura
 */

import "dotenv/config";
import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const DIVIDER = "─".repeat(60);

// ============================================================================
// Config
// ============================================================================

const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "",
  username: process.env.SAP_B1_USERNAME ?? "",
  password: process.env.SAP_B1_PASSWORD ?? "",
  timeoutMs: parseInt(process.env.SAP_B1_TIMEOUT_MS ?? "60000", 10),
};

// ============================================================================
// Helpers
// ============================================================================

function extractFields(obj: Record<string, unknown>, prefix = ""): string[] {
  const fields: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      fields.push(...extractFields(value as Record<string, unknown>, path));
    } else {
      const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
      fields.push(`${path} (${type})`);
    }
  }
  return fields;
}

function summarize(label: string, obj: unknown): void {
  if (!obj || typeof obj !== "object") {
    console.log(`  ⚠️  ${label}: sem dados`);
    return;
  }
  const fields = extractFields(obj as Record<string, unknown>);
  console.log(`  📋 ${label}: ${fields.length} campos`);
}

// ============================================================================
// Queries por entidade
// ============================================================================

interface EntityQuery {
  name: string;
  endpoint: string;
  description: string;
}

const queries: EntityQuery[] = [
  {
    name: "Orders",
    endpoint: "/Orders?$top=1&$orderby=DocEntry desc",
    description: "Pedidos de Venda (Sales Orders)",
  },
  {
    name: "Items",
    endpoint: "/Items?$top=1",
    description: "Produtos / Itens do Catálogo",
  },
  {
    name: "BusinessPartners",
    endpoint: "/BusinessPartners?$top=1&$filter=CardType eq 'cCustomer'",
    description: "Clientes (Business Partners)",
  },
  {
    name: "Warehouses",
    endpoint: "/Warehouses?$top=5",
    description: "Depósitos / Armazéns",
  },
  {
    name: "DeliveryNotes",
    endpoint: "/DeliveryNotes?$top=1&$orderby=DocEntry desc",
    description: "Notas de Entrega (Delivery Notes)",
  },
  {
    name: "Invoices",
    endpoint: "/Invoices?$top=1&$orderby=DocEntry desc",
    description: "Notas Fiscais (Invoices)",
  },
  {
    name: "StockTransfers",
    endpoint: "/StockTransfers?$top=1&$orderby=DocEntry desc",
    description: "Transferências de Estoque",
  },
  {
    name: "InventoryGenEntries",
    endpoint: "/InventoryGenEntries?$top=1&$orderby=DocEntry desc",
    description: "Entradas/Saídas de Inventário",
  },
  {
    name: "PurchaseOrders",
    endpoint: "/PurchaseOrders?$top=1&$orderby=DocEntry desc",
    description: "Pedidos de Compra",
  },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n" + DIVIDER);
  console.log("  Investigação de Estrutura de Dados — SAP B1");
  console.log(DIVIDER);
  console.log(`  Database:  ${config.companyDb}`);
  console.log(`  Servidor:  ${config.baseUrl}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(DIVIDER + "\n");

  if (!config.baseUrl || !config.companyDb || !config.username || !config.password) {
    console.error("❌ Preencha .env com as credenciais reais do SAP:");
    console.error("   SAP_B1_BASE_URL, SAP_B1_COMPANY_DB, SAP_B1_USERNAME, SAP_B1_PASSWORD");
    process.exit(1);
  }

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password,
    },
    timeoutMs: config.timeoutMs,
    retry: { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 10000, jitterRatio: 0.2 },
    circuitBreaker: { failureThreshold: 10, successThreshold: 2, openStateTimeoutMs: 60000 },
  });

  const correlationId = `invest-${Date.now()}`;
  const resultado: Record<string, unknown> = {
    _meta: {
      timestamp: new Date().toISOString(),
      database: config.companyDb,
      server: config.baseUrl,
    },
  };

  try {
    // Login
    console.log("🔐 Autenticando...");
    await client.login(correlationId);
    console.log("✅ Login OK\n");

    // Consultar cada entidade
    for (const q of queries) {
      console.log(`${DIVIDER}`);
      console.log(`📦 ${q.name} — ${q.description}`);

      try {
        const res = await client.get<{ value: unknown[] }>(q.endpoint, {
          correlationId,
        });

        const items = res.data.value ?? [];
        const sample = items[0] ?? null;

        resultado[q.name] = {
          status: "OK",
          total_retornado: items.length,
          campos: sample ? extractFields(sample as Record<string, unknown>) : [],
          amostra: sample,
          // Se for lista (ex: Warehouses), salvar todas
          ...(items.length > 1 ? { todas_amostras: items } : {}),
        };

        console.log(`  ✅ ${items.length} registro(s) retornado(s)`);
        if (sample) {
          summarize(q.name, sample);

          // Mostrar campos-chave
          const s = sample as Record<string, unknown>;
          const keys = Object.keys(s).filter(
            (k) =>
              !k.startsWith("U_") &&
              !k.startsWith("odata") &&
              s[k] !== null &&
              s[k] !== "" &&
              s[k] !== 0 &&
              s[k] !== "tNO",
          );
          console.log(`  🔑 Campos preenchidos (não-UDF): ${keys.length}`);
          console.log(`     ${keys.slice(0, 15).join(", ")}${keys.length > 15 ? " ..." : ""}`);

          // Listar UDFs encontrados
          const udfs = Object.keys(s).filter((k) => k.startsWith("U_") && s[k] !== null);
          if (udfs.length > 0) {
            console.log(`  🏷️  UDFs preenchidos: ${udfs.length}`);
            for (const u of udfs.slice(0, 10)) {
              console.log(`     ${u} = ${JSON.stringify(s[u])}`);
            }
            if (udfs.length > 10) console.log(`     ... +${udfs.length - 10} mais`);
          }

          // DocumentLines se existirem
          if (Array.isArray(s.DocumentLines) && s.DocumentLines.length > 0) {
            const firstLine = s.DocumentLines[0] as Record<string, unknown>;
            const lineFields = extractFields(firstLine);
            console.log(`  📄 DocumentLines: ${s.DocumentLines.length} linha(s), ${lineFields.length} campos/linha`);
            const lineKeys = Object.keys(firstLine).filter(
              (k) => !k.startsWith("U_") && firstLine[k] !== null && firstLine[k] !== "",
            );
            console.log(`     Campos-chave: ${lineKeys.slice(0, 12).join(", ")}${lineKeys.length > 12 ? " ..." : ""}`);

            // UDFs nas linhas
            const lineUdfs = Object.keys(firstLine).filter(
              (k) => k.startsWith("U_") && firstLine[k] !== null,
            );
            if (lineUdfs.length > 0) {
              console.log(`     UDFs na linha: ${lineUdfs.length}`);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        resultado[q.name] = { status: "ERRO", erro: msg };
        console.log(`  ❌ Erro: ${msg.slice(0, 120)}`);
      }

      console.log();
    }

    // ── UDFs WMS específicos ──
    console.log(DIVIDER);
    console.log("🏷️  Verificando UDFs WMS no pedido mais recente...");
    try {
      const udfRes = await client.get<{ value: unknown[] }>(
        "/Orders?$top=1&$orderby=DocEntry desc&$select=DocEntry,DocNum,CardCode,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID",
        { correlationId },
      );
      const udfOrder = udfRes.data.value?.[0] as Record<string, unknown> | undefined;
      if (udfOrder) {
        console.log(`  DocEntry: ${udfOrder.DocEntry}`);
        console.log(`  U_WMS_STATUS:     ${JSON.stringify(udfOrder.U_WMS_STATUS)}`);
        console.log(`  U_WMS_ORDERID:    ${JSON.stringify(udfOrder.U_WMS_ORDERID)}`);
        console.log(`  U_WMS_LAST_EVENT: ${JSON.stringify(udfOrder.U_WMS_LAST_EVENT)}`);
        console.log(`  U_WMS_LAST_TS:    ${JSON.stringify(udfOrder.U_WMS_LAST_TS)}`);
        console.log(`  U_WMS_CORR_ID:    ${JSON.stringify(udfOrder.U_WMS_CORR_ID)}`);
        resultado["UDFs_WMS"] = udfOrder;
      }
    } catch (err) {
      console.log(`  ⚠️  Não foi possível consultar UDFs: ${err}`);
    }

    // Logout
    await client.logout(correlationId);
    console.log("\n🔒 Logout OK");

    // Salvar resultado
    const outDir = resolve(import.meta.dirname ?? ".", "../data");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "estrutura-dados-sap.json");
    writeFileSync(outPath, JSON.stringify(resultado, null, 2), "utf-8");

    console.log(`\n📁 Resultado salvo em: ${outPath}`);

    // Resumo final
    console.log("\n" + DIVIDER);
    console.log("  RESUMO DA INVESTIGAÇÃO");
    console.log(DIVIDER);
    for (const q of queries) {
      const r = resultado[q.name] as Record<string, unknown> | undefined;
      const status = r?.status === "OK" ? "✅" : "❌";
      const campos = Array.isArray(r?.campos) ? (r.campos as string[]).length : 0;
      console.log(`  ${status} ${q.name.padEnd(25)} ${campos > 0 ? `${campos} campos` : (r?.erro as string || "sem dados")}`);
    }
    console.log(DIVIDER + "\n");

  } catch (err) {
    console.error("\n❌ ERRO FATAL:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
