/**
 * Teste do Mock SAP B1 — Somente dados reais da REDACTED_COMPANY_DB
 *
 * Valida:
 *  1. Login com credenciais reais
 *  2. Pedido completo DocEntry 60 (todos os campos reais)
 *  3. 20 cabeçalhos da CONFERENCIA (DocEntry + DocNum + CardCode)
 *  4. Itens reais: TP0000016, EM00000004, IS0000001
 *  5. Depósitos reais: 01.04 PAINTGRAF GSN, 02.02
 *  6. BP real C00369 com dados completos
 *  7. Workflow de UDFs (escrita + leitura, validado no SAP real)
 *  8. Reset e consistência
 */

import { sapMockService } from "../mocks/sapMockService.js";

const DIVIDER = "─".repeat(60);
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FALHOU: ${label}`);
    failed++;
  }
}

async function main() {
  console.log("\n" + DIVIDER);
  console.log("  SAP B1 Mock — Dados Reais REDACTED_COMPANY_DB");
  console.log(DIVIDER + "\n");

  // ────────────────────────────────────────────────────────────────────────
  // 1. Login (credenciais reais do ambiente)
  // ────────────────────────────────────────────────────────────────────────
  console.log("1️⃣  Login");
  const session = await sapMockService.login(
    "REDACTED_USER",
    "***",
    "REDACTED_COMPANY_DB",
  );
  assert(!!session.SessionId, "Login retorna SessionId");

  // ────────────────────────────────────────────────────────────────────────
  // 2. Pedido completo DocEntry 60 [fonte: Orders-structure.json]
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Pedido DocEntry 60 (dados reais completos)");
  const order60 = await sapMockService.getOrderByDocEntry(60);
  assert(order60 !== null, "DocEntry 60 encontrado");
  assert(order60!.DocNum === 5, `DocNum = 5`);
  assert(order60!.CardCode === "C00369", `CardCode = C00369`);
  assert(order60!.CardName === "EUTIDES JACKSON SARMENTO", "CardName real");
  assert(order60!.DocTotal === 65, `DocTotal = R$ 65,00`);
  assert(order60!.DocDate === "2023-02-10T00:00:00Z", "DocDate = 2023-02-10");
  assert(order60!.DocDueDate === "2023-02-10T00:00:00Z", "DocDueDate real");
  assert(order60!.DocumentStatus === "bost_Close", "DocumentStatus = bost_Close");
  assert(order60!.DocCurrency === "R$", "DocCurrency = R$");
  assert(order60!.Comments === undefined, "Comments = undefined (null no SAP)");
  assert(order60!.CreateTime === "1026", "CreateTime = 1026 (10:26)");

  // Linha do pedido
  const line0 = order60!.DocumentLines![0];
  assert(line0.LineNum === 0, "LineNum = 0");
  assert(line0.ItemCode === "TP0000016", "ItemCode = TP0000016");
  assert(
    line0.ItemDescription === "TAMPA PLASTICA CONTA.GOTAS PRETA 820 LISA REF>GUALA - UND",
    "ItemDescription real",
  );
  assert(line0.Quantity === 100, "Quantity = 100");
  assert(line0.WarehouseCode === "02.02", "WarehouseCode = 02.02");
  assert(line0.Price === 0.65, "Price = 0.65");
  assert(line0.UnitPrice === 0.65, "UnitPrice = 0.65");
  assert(line0.LineTotal === 65, "LineTotal = 65");
  assert(line0.MeasureUnit === "UN", "MeasureUnit = UN");

  // ────────────────────────────────────────────────────────────────────────
  // 3. 20 cabeçalhos da CONFERENCIA [fonte: CONFERENCIA_RESULTADO.md]
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Cabeçalhos CONFERENCIA (20 pedidos reais)");
  const allOrders = await sapMockService.getOrders({ status: "all" });
  assert(
    allOrders.value.length === 21,
    `Total = 21 pedidos (1 completo + 20 cabeçalhos) → got ${allOrders.value.length}`,
  );

  // Verificar todos os DocEntry/DocNum/CardCode reais
  const conferencia: [number, number, string][] = [
    [59037, 38317, "C01153"],
    [59038, 38318, "C02217"],
    [59040, 38319, "C08083"],
    [59041, 38320, "C02507"],
    [59043, 38321, "C08231"],
    [59045, 38322, "C00534"],
    [59046, 38323, "C00391"],
    [59047, 38324, "C07125"],
    [59048, 38325, "C01977"],
    [59049, 38326, "C07125"],
    [59051, 38327, "C00033"],
    [59052, 38328, "C00037"],
    [59053, 38329, "C00037"],
    [59054, 38330, "C09540"],
    [59056, 38331, "C05695"],
    [59057, 38332, "C00037"],
    [59058, 38333, "C06818"],
    [59059, 38334, "C09706"],
    [59060, 38335, "C00173"],
    [59061, 38336, "C01161"],
  ];

  let confOk = 0;
  for (const [de, dn, cc] of conferencia) {
    const o = allOrders.value.find((x) => x.DocEntry === de);
    if (o && o.DocNum === dn && o.CardCode === cc) confOk++;
  }
  assert(confOk === 20, `20/20 cabeçalhos CONFERENCIA conferem → got ${confOk}/20`);

  // Pedidos da conferência não têm linhas (dados não capturados)
  const order59061 = allOrders.value.find((o) => o.DocEntry === 59061);
  assert(
    order59061!.DocumentLines!.length === 0,
    "DocEntry 59061: sem DocumentLines (dado não capturado)",
  );

  // ────────────────────────────────────────────────────────────────────────
  // 4. Itens reais
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Itens reais");
  const items = await sapMockService.getItems();
  assert(items.value.length === 3, `3 itens reais → got ${items.value.length}`);

  const tp16 = await sapMockService.getItemByCode("TP0000016");
  assert(tp16 !== null, "TP0000016 existe");
  assert(
    tp16!.ItemName === "TAMPA PLASTICA CONTA.GOTAS PRETA 820 LISA REF>GUALA - UND",
    "Descrição real do TP0000016",
  );

  const em04 = await sapMockService.getItemByCode("EM00000004");
  assert(em04 !== null, "EM00000004 existe (real do endpoint /Items)");

  const is01 = await sapMockService.getItemByCode("IS0000001");
  assert(is01 !== null, "IS0000001 existe (OriginalItem do pedido 60)");

  // ────────────────────────────────────────────────────────────────────────
  // 5. Depósitos reais
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Depósitos reais");
  const warehouses = await sapMockService.getWarehouses();
  assert(warehouses.value.length === 2, `2 depósitos reais → got ${warehouses.value.length}`);

  const wh0104 = warehouses.value.find((w) => w.WarehouseCode === "01.04");
  assert(wh0104?.WarehouseName === "PAINTGRAF GSN", "01.04 = PAINTGRAF GSN (real)");

  const wh0202 = warehouses.value.find((w) => w.WarehouseCode === "02.02");
  assert(wh0202 !== undefined, "02.02 presente (usado no pedido 60)");

  // ────────────────────────────────────────────────────────────────────────
  // 6. Business Partners reais
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n6️⃣  Business Partners reais");
  const partners = await sapMockService.getBusinessPartners();
  // C00369 + C00363 + 17 únicos da CONFERENCIA = 19
  // (C00037 aparece 3x e C07125 2x na CONFERENCIA, mas são únicos no array)
  assert(partners.value.length === 19, `19 BPs reais (únicos) → got ${partners.value.length}`);

  const bp369 = partners.value.find((p) => p.CardCode === "C00369");
  assert(bp369?.CardName === "EUTIDES JACKSON SARMENTO", "C00369: nome real");
  assert(bp369?.FederalTaxID === "677.855.576-91", "C00369: CPF real");
  assert(bp369?.City === "Belo Horizonte", "C00369: cidade real");
  assert(bp369?.State === "MG", "C00369: estado real");

  // BPs da CONFERENCIA sem nome capturado
  const bp037 = partners.value.find((p) => p.CardCode === "C00037");
  assert(bp037?.CardName === "C00037", "C00037: nome = código (não capturado)");

  // ────────────────────────────────────────────────────────────────────────
  // 7. Estoque — sem dados reais disponíveis
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Estoque (endpoint retornou 400 na investigação)");
  const stock = await sapMockService.getItemWarehouseInfo("TP0000016");
  assert(stock.value.length === 0, "Sem dados de estoque (não capturado)");

  // ────────────────────────────────────────────────────────────────────────
  // 8. Workflow UDF — reproduz teste real [fonte D: VALIDACAO_UDF_COMPLETA.md]
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n8️⃣  Workflow UDF (reproduz validação real)");

  // Valores que foram realmente escritos no SAP (VALIDACAO_UDF_COMPLETA.md)
  const realTestValues = {
    U_WMS_STATUS: "TESTE_INTEGRACAO",
    U_WMS_ORDERID: "WMS-TEST-001",
    U_WMS_LAST_EVENT: "TESTE_VALIDACAO",
    U_WMS_LAST_TS: "2026-02-06T00:00:00Z",
    U_WMS_CORR_ID: "test-corr-123",
  };

  const updated = await sapMockService.updateOrderStatus(60, realTestValues);
  assert(updated !== null, "PATCH DocEntry 60 OK");
  assert(updated!.U_WMS_STATUS === "TESTE_INTEGRACAO", "U_WMS_STATUS = TESTE_INTEGRACAO (real)");
  assert(updated!.U_WMS_ORDERID === "WMS-TEST-001", "U_WMS_ORDERID = WMS-TEST-001 (real)");
  assert(updated!.U_WMS_LAST_EVENT === "TESTE_VALIDACAO", "U_WMS_LAST_EVENT = TESTE_VALIDACAO (real)");
  assert(updated!.U_WMS_LAST_TS === "2026-02-06T00:00:00Z", "U_WMS_LAST_TS = 2026-02-06 (real)");
  assert(updated!.U_WMS_CORR_ID === "test-corr-123", "U_WMS_CORR_ID = test-corr-123 (real)");

  // Leitura após escrita (como no teste real que retornou HTTP 204 → GET)
  const readBack = await sapMockService.getOrderByDocEntry(60);
  assert(readBack!.U_WMS_STATUS === "TESTE_INTEGRACAO", "GET: UDF persistido");

  // Testar workflow de produção
  console.log("\n  Simulando workflow WMS completo:");
  const wmsSteps = [
    "IMPORTADO", "A_SEPARAR", "EM_SEPARACAO", "SEPARADO",
    "EM_CONFERENCIA", "CONFERIDO", "EM_EXPEDICAO", "DESPACHADO",
  ];

  for (const status of wmsSteps) {
    const r = await sapMockService.updateOrderStatus(59061, {
      U_WMS_STATUS: status,
      U_WMS_LAST_EVENT: status,
      U_WMS_LAST_TS: new Date().toISOString(),
    });
    assert(r!.U_WMS_STATUS === status, `  → ${status}`);
  }

  // ────────────────────────────────────────────────────────────────────────
  // 9. Reset e consistência
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n9️⃣  Reset");
  sapMockService.resetData();
  const afterReset = await sapMockService.getOrders({ status: "all" });
  assert(afterReset.value.length === 21, `Após reset = 21 pedidos`);

  const order60After = await sapMockService.getOrderByDocEntry(60);
  assert(order60After!.U_WMS_STATUS === null, "DocEntry 60: UDFs voltaram a null");

  // Logout
  const logoutResult = await sapMockService.logout();
  assert(logoutResult.success === true, "Logout OK");

  // ────────────────────────────────────────────────────────────────────────
  // Resultado
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n" + DIVIDER);
  console.log(`  RESULTADO: ${passed} passou, ${failed} falhou`);
  console.log(DIVIDER);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("\n✅ Todos os dados são reais da REDACTED_COMPANY_DB!\n");
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
