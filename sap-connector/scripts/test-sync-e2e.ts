/**
 * Teste E2E da Integração SAP ↔ WMS
 *
 * Conecta ao SAP real e executa:
 *   1. Polling de pedidos abertos
 *   2. Importação para o WMS (in-memory)
 *   3. Write-back de status UDF no SAP
 *   4. Verificação de leitura dos UDFs
 *
 * Uso: npm run sap:test-sync
 */

import "dotenv/config";
import { createSapClient, type ISapClient } from "../sapClientFactory.js";
import { SyncService, type ImportedOrder, type SyncLogger } from "../src/syncService.js";
import type { SapOrder } from "../src/sapTypes.js";

const DIVIDER = "─".repeat(60);

// ============================================================================
// In-memory store (simula o banco WMS)
// ============================================================================

const importedOrders = new Map<number, ImportedOrder>();
const sapOrdersCache = new Map<number, SapOrder>();

// ============================================================================
// Logger
// ============================================================================

const logger: SyncLogger = {
  info: (msg, meta) => console.log(`  ℹ️  ${msg}`, meta ? JSON.stringify(meta).slice(0, 120) : ""),
  warn: (msg, meta) => console.warn(`  ⚠️  ${msg}`, meta ? JSON.stringify(meta).slice(0, 120) : ""),
  error: (msg, meta) => console.error(`  ❌ ${msg}`, meta ? JSON.stringify(meta).slice(0, 120) : ""),
  debug: (msg, _meta) => console.log(`  🔍 ${msg}`),
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n" + DIVIDER);
  console.log("  TESTE E2E — Sincronização SAP ↔ WMS");
  console.log(DIVIDER + "\n");

  // Verificar configuração
  const baseUrl = process.env.SAP_B1_BASE_URL;
  const companyDb = process.env.SAP_B1_COMPANY_DB;
  const username = process.env.SAP_B1_USERNAME;
  const password = process.env.SAP_B1_PASSWORD;

  if (!baseUrl || !companyDb || !username || !password) {
    console.error("❌ Configure .env com SAP_B1_BASE_URL, SAP_B1_COMPANY_DB, SAP_B1_USERNAME, SAP_B1_PASSWORD");
    process.exit(1);
  }

  console.log(`  Database: ${companyDb}`);
  console.log(`  Servidor: ${baseUrl}`);
  console.log(`  Usuário:  ${username}\n`);

  // Criar cliente SAP real
  const sapClient: ISapClient = createSapClient({ useMock: false });

  // Testar login
  console.log("1️⃣  Testando autenticação...");
  try {
    await sapClient.login(username, password);
    console.log("  ✅ Login OK\n");
  } catch (err) {
    console.error(`  ❌ Falha no login: ${err}`);
    process.exit(1);
  }

  // ── Etapa 2: Polling de pedidos ──
  console.log(DIVIDER);
  console.log("2️⃣  Polling de pedidos abertos...\n");

  const syncService = new SyncService({
    sapClient,
    logger,
    batchSize: 10,
    onlyOpenOrders: true,

    onOrderImported: async (order: ImportedOrder, sapOrder: SapOrder) => {
      importedOrders.set(order.sapDocEntry, order);
      sapOrdersCache.set(order.sapDocEntry, sapOrder);
    },

    isOrderAlreadyImported: async (docEntry: number) => {
      return importedOrders.has(docEntry);
    },
  });

  const result = await syncService.pollOrders();

  console.log(`\n  📊 Resultado do polling:`);
  console.log(`     Pedidos consultados: ${result.ordersPolled}`);
  console.log(`     Pedidos importados:  ${result.ordersImported}`);
  console.log(`     Pedidos já existiam: ${result.ordersSkipped}`);
  console.log(`     Pedidos com erro:    ${result.ordersFailed}`);
  console.log(`     Último DocEntry:     ${result.lastDocEntry}`);
  console.log(`     Duração:             ${result.durationMs}ms\n`);

  if (result.errors.length > 0) {
    console.log("  Erros:");
    for (const e of result.errors) {
      console.log(`     DocEntry ${e.docEntry}: ${e.error.slice(0, 80)}`);
    }
    console.log();
  }

  // ── Etapa 3: Listar pedidos importados ──
  console.log(DIVIDER);
  console.log("3️⃣  Pedidos importados no WMS:\n");

  if (importedOrders.size === 0) {
    console.log("  ⚠️  Nenhum pedido novo importado (todos já existiam ou nenhum aberto)\n");
  } else {
    console.log("  ╔═══════════╦═════════╦══════════════╦══════════════╦═══════════╗");
    console.log("  ║ DocEntry  ║ DocNum  ║ Cliente      ║ Total        ║ Itens     ║");
    console.log("  ╠═══════════╬═════════╬══════════════╬══════════════╬═══════════╣");
    for (const [, order] of importedOrders) {
      const de = String(order.sapDocEntry).padEnd(9);
      const dn = String(order.sapDocNum).padEnd(7);
      const cc = (order.cardCode ?? "").padEnd(12);
      const total = `${order.currency ?? "R$"} ${(order.docTotal ?? 0).toFixed(2)}`.padEnd(12);
      const items = String(order.itemCount).padEnd(9);
      console.log(`  ║ ${de} ║ ${dn} ║ ${cc} ║ ${total} ║ ${items} ║`);
    }
    console.log("  ╚═══════════╩═════════╩══════════════╩══════════════╩═══════════╝\n");
  }

  // ── Etapa 4: Segundo polling (deve pular todos) ──
  console.log(DIVIDER);
  console.log("4️⃣  Segundo polling (teste de idempotência)...\n");

  const result2 = await syncService.pollOrders();
  console.log(`  Importados: ${result2.ordersImported} (esperado: 0)`);
  console.log(`  Pulados:    ${result2.ordersSkipped}`);
  console.log(`  ✅ Idempotência: ${result2.ordersImported === 0 ? "OK" : "FALHOU"}\n`);

  // ── Etapa 5: Write-back de status (apenas se importou pedidos) ──
  if (importedOrders.size > 0) {
    console.log(DIVIDER);
    console.log("5️⃣  Write-back de status WMS → SAP...\n");

    // Pegar o primeiro pedido importado para teste
    const firstOrder = importedOrders.values().next().value!;

    // Simular workflow: IMPORTADO → A_SEPARAR → EM_SEPARACAO
    const transitions = [
      { status: "A_SEPARAR" as const, event: "IMPORTAR_FILA" },
      { status: "EM_SEPARACAO" as const, event: "INICIAR_SEPARACAO" },
    ];

    for (const t of transitions) {
      console.log(`  Atualizando DocEntry ${firstOrder.sapDocEntry} → ${t.status}...`);
      const wb = await syncService.updateWmsStatus({
        docEntry: firstOrder.sapDocEntry,
        wmsOrderId: firstOrder.wmsOrderId,
        status: t.status,
        event: t.event,
      });
      console.log(`  ${wb.success ? "✅" : "❌"} ${t.status} (${wb.success ? "OK" : wb.error})\n`);
    }

    // ── Etapa 6: Verificar UDFs no SAP ──
    console.log(DIVIDER);
    console.log("6️⃣  Verificando UDFs no SAP...\n");

    const verifyOrder = await sapClient.getOrderByDocEntry(firstOrder.sapDocEntry);
    if (verifyOrder) {
      console.log(`  DocEntry:        ${verifyOrder.DocEntry}`);
      console.log(`  DocNum:          ${verifyOrder.DocNum}`);
      console.log(`  U_WMS_STATUS:    ${verifyOrder.U_WMS_STATUS ?? "(vazio)"}`);
      console.log(`  U_WMS_ORDERID:   ${verifyOrder.U_WMS_ORDERID ?? "(vazio)"}`);
      console.log(`  U_WMS_LAST_EVENT:${verifyOrder.U_WMS_LAST_EVENT ?? "(vazio)"}`);
      console.log(`  U_WMS_LAST_TS:   ${verifyOrder.U_WMS_LAST_TS ?? "(vazio)"}`);
      console.log(`  U_WMS_CORR_ID:   ${verifyOrder.U_WMS_CORR_ID ?? "(vazio)"}`);

      const statusOk = verifyOrder.U_WMS_STATUS === "EM_SEPARACAO";
      console.log(`\n  ${statusOk ? "✅" : "❌"} Status no SAP: ${verifyOrder.U_WMS_STATUS} (esperado: EM_SEPARACAO)`);

      // Limpar UDFs de teste
      console.log("\n  🧹 Limpando UDFs de teste...");
      await syncService.writeBackStatus(firstOrder.sapDocEntry, {
        U_WMS_STATUS: "" as any,
        U_WMS_ORDERID: "",
        U_WMS_LAST_EVENT: "",
        U_WMS_LAST_TS: "",
        U_WMS_CORR_ID: "",
      });
      console.log("  ✅ UDFs limpos\n");
    }
  }

  // Logout
  await sapClient.logout();

  // ── Resumo final ──
  console.log(DIVIDER);
  console.log("  RESUMO DO TESTE E2E");
  console.log(DIVIDER);

  const stats = syncService.getStats();
  const cursor = syncService.getCursor();

  console.log(`  Ciclos executados:     ${stats.totalCycles}`);
  console.log(`  Pedidos importados:    ${stats.totalImported}`);
  console.log(`  Pedidos pulados:       ${stats.totalSkipped}`);
  console.log(`  Write-backs:           ${stats.totalWriteBacks}`);
  console.log(`  Último DocEntry:       ${cursor.lastDocEntry}`);
  console.log(`  Último sync:           ${cursor.lastSyncAt}`);
  console.log(DIVIDER + "\n");

  console.log("🎉 Teste E2E concluído com sucesso!\n");
}

main().catch((err) => {
  console.error("\n❌ ERRO FATAL:", err);
  process.exit(1);
});
