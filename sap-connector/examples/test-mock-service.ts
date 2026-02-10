/**
 * Exemplo de Uso do SAP Mock Service
 * 
 * Demonstra como usar o mock para desenvolvimento e testes
 * sem necessidade de conexão com SAP real
 */

import { sapMockService } from "../mocks/sapMockService.js";

async function main() {
  console.log("=".repeat(70));
  console.log("SAP B1 MOCK SERVICE - EXEMPLO DE USO");
  console.log("=".repeat(70));
  console.log();

  // ============================================================================
  // 1. LOGIN
  // ============================================================================
  console.log("1️⃣  LOGIN NO SAP");
  console.log("-".repeat(70));
  
  const session = await sapMockService.login(
    "mock_user",
    "mock_pass",
    "MOCK_COMPANY_DB"
  );
  
  console.log("✓ Login realizado");
  console.log(`  SessionId: ${session.SessionId}`);
  console.log();

  // ============================================================================
  // 2. LISTAR PEDIDOS
  // ============================================================================
  console.log("2️⃣  LISTAR PEDIDOS");
  console.log("-".repeat(70));
  
  const ordersResponse = await sapMockService.getOrders({
    status: "open",
    limit: 5
  });
  
  console.log(`✓ ${ordersResponse.value.length} pedidos encontrados`);
  console.log();
  
  ordersResponse.value.forEach(order => {
    console.log(`  📦 Pedido #${order.DocNum} (DocEntry: ${order.DocEntry})`);
    console.log(`     Cliente: ${order.CardName} (${order.CardCode})`);
    console.log(`     Total: ${order.DocCurrency} ${order.DocTotal?.toFixed(2)}`);
    console.log(`     Status: ${order.DocStatus}`);
    console.log(`     Linhas: ${order.DocumentLines?.length || 0} itens`);
    console.log();
  });

  // ============================================================================
  // 3. DETALHES DE UM PEDIDO
  // ============================================================================
  console.log("3️⃣  DETALHES DE UM PEDIDO");
  console.log("-".repeat(70));
  
  const firstOrder = ordersResponse.value[0];
  const orderDetails = await sapMockService.getOrderByDocEntry(firstOrder.DocEntry);
  
  console.log(`✓ Pedido ${orderDetails.DocNum} - ${orderDetails.CardName}`);
  console.log();
  console.log("  Linhas do pedido:");
  
  orderDetails.DocumentLines?.forEach(line => {
    console.log(`    ${line.LineNum + 1}. ${line.ItemCode} - ${line.ItemDescription}`);
    console.log(`       Qtd: ${line.Quantity} ${line.WarehouseCode || ''}`);
    console.log(`       Valor: ${line.Currency} ${line.LineTotal?.toFixed(2)}`);
  });
  console.log();

  // ============================================================================
  // 4. ATUALIZAR STATUS DO PEDIDO (UDF)
  // ============================================================================
  console.log("4️⃣  ATUALIZAR STATUS WMS");
  console.log("-".repeat(70));
  
  await sapMockService.updateOrderStatus(firstOrder.DocEntry, {
    U_WMS_STATUS: "EM_SEPARACAO",
    U_WMS_ORDERID: "550e8400-e29b-41d4-a716-446655440099",
    U_WMS_LAST_EVENT: "INICIAR_SEPARACAO",
    U_WMS_LAST_TS: new Date().toISOString(),
    U_WMS_CORR_ID: `corr-${Date.now()}`
  });
  
  console.log(`✓ Status atualizado para pedido ${firstOrder.DocEntry}`);
  console.log();

  // Verificar atualização
  const updatedOrder = await sapMockService.getOrderByDocEntry(firstOrder.DocEntry);
  console.log("  Status WMS atual:");
  console.log(`    U_WMS_STATUS: ${updatedOrder.U_WMS_STATUS}`);
  console.log(`    U_WMS_ORDERID: ${updatedOrder.U_WMS_ORDERID}`);
  console.log(`    U_WMS_LAST_EVENT: ${updatedOrder.U_WMS_LAST_EVENT}`);
  console.log();

  // ============================================================================
  // 5. LISTAR PRODUTOS
  // ============================================================================
  console.log("5️⃣  LISTAR PRODUTOS");
  console.log("-".repeat(70));
  
  const itemsResponse = await sapMockService.getItems({ top: 5 });
  
  console.log(`✓ ${itemsResponse.value.length} produtos encontrados`);
  console.log();
  
  itemsResponse.value.forEach(item => {
    console.log(`  📦 ${item.ItemCode} - ${item.ItemName}`);
    console.log(`     UOM: ${item.InventoryUOM} | Ativo: ${item.Valid === 'tYES' ? 'Sim' : 'Não'}`);
  });
  console.log();

  // ============================================================================
  // 6. CONSULTAR ESTOQUE
  // ============================================================================
  console.log("6️⃣  CONSULTAR ESTOQUE DE UM PRODUTO");
  console.log("-".repeat(70));
  
  const itemCode = itemsResponse.value[0].ItemCode;
  const stockResponse = await sapMockService.getItemWarehouseInfo(itemCode);
  
  console.log(`✓ Estoque do produto ${itemCode}`);
  console.log();
  
  let totalStock = 0;
  let totalAvailable = 0;
  
  stockResponse.value.forEach(stock => {
    console.log(`  📍 Depósito ${stock.WarehouseCode}`);
    console.log(`     Em estoque: ${stock.InStock}`);
    console.log(`     Comprometido: ${stock.Committed}`);
    console.log(`     Pedidos: ${stock.Ordered}`);
    console.log(`     Disponível: ${stock.Available}`);
    console.log();
    
    totalStock += stock.InStock || 0;
    totalAvailable += stock.Available || 0;
  });
  
  console.log(`  TOTAL GERAL:`);
  console.log(`     Estoque: ${totalStock}`);
  console.log(`     Disponível: ${totalAvailable}`);
  console.log();

  // ============================================================================
  // 7. LISTAR DEPÓSITOS
  // ============================================================================
  console.log("7️⃣  LISTAR DEPÓSITOS");
  console.log("-".repeat(70));
  
  const warehousesResponse = await sapMockService.getWarehouses();
  
  console.log(`✓ ${warehousesResponse.value.length} depósitos ativos`);
  console.log();
  
  warehousesResponse.value.forEach(wh => {
    console.log(`  🏢 ${wh.WarehouseCode} - ${wh.WarehouseName}`);
  });
  console.log();

  // ============================================================================
  // 8. LISTAR CLIENTES
  // ============================================================================
  console.log("8️⃣  LISTAR CLIENTES");
  console.log("-".repeat(70));
  
  const bpResponse = await sapMockService.getBusinessPartners({ cardType: "cCustomer" });
  
  console.log(`✓ ${bpResponse.value.length} clientes encontrados`);
  console.log();
  
  bpResponse.value.forEach(bp => {
    console.log(`  👤 ${bp.CardCode} - ${bp.CardName}`);
    console.log(`     ${bp.City}/${bp.State} | Segmento: ${bp.U_CRM_Segment || 'N/A'}`);
  });
  console.log();

  // ============================================================================
  // 9. FILTRAR PEDIDOS POR CLIENTE
  // ============================================================================
  console.log("9️⃣  PEDIDOS DE UM CLIENTE ESPECÍFICO");
  console.log("-".repeat(70));
  
  const customerCode = "C00512";
  const customerOrders = await sapMockService.getOrders({
    cardCode: customerCode,
    status: "all"
  });
  
  console.log(`✓ ${customerOrders.value.length} pedidos do cliente ${customerCode}`);
  console.log();
  
  let totalValue = 0;
  customerOrders.value.forEach(order => {
    console.log(`  📦 Pedido #${order.DocNum}`);
    console.log(`     Data: ${order.DocDate?.split('T')[0]}`);
    console.log(`     Valor: ${order.DocCurrency} ${order.DocTotal?.toFixed(2)}`);
    console.log(`     Status: ${order.DocStatus}`);
    console.log();
    totalValue += order.DocTotal || 0;
  });
  
  console.log(`  TOTAL: R$ ${totalValue.toFixed(2)}`);
  console.log();

  // ============================================================================
  // 10. GERAR PEDIDOS ALEATÓRIOS (TESTE DE CARGA)
  // ============================================================================
  console.log("🔟 GERAR PEDIDOS ALEATÓRIOS");
  console.log("-".repeat(70));
  
  const randomOrders = await sapMockService.generateRandomOrders(3);
  
  console.log(`✓ ${randomOrders.length} pedidos gerados`);
  console.log();
  
  randomOrders.forEach(order => {
    console.log(`  📦 Pedido #${order.DocNum} (${order.CardName})`);
    console.log(`     Total: R$ ${order.DocTotal.toFixed(2)}`);
    console.log(`     Linhas: ${order.DocumentLines?.length || 0} itens`);
  });
  console.log();

  // ============================================================================
  // 11. ESTATÍSTICAS
  // ============================================================================
  console.log("1️⃣1️⃣ ESTATÍSTICAS DO SISTEMA");
  console.log("-".repeat(70));
  
  const stats = sapMockService.getStats();
  
  console.log("✓ Estatísticas:");
  console.log(`  Total de pedidos: ${stats.totalOrders}`);
  console.log(`  Pedidos abertos: ${stats.openOrders}`);
  console.log(`  Pedidos fechados: ${stats.closedOrders}`);
  console.log(`  Total de produtos: ${stats.totalItems}`);
  console.log(`  Total de depósitos: ${stats.totalWarehouses}`);
  console.log(`  Total de clientes: ${stats.totalCustomers}`);
  console.log(`  Autenticado: ${stats.isAuthenticated ? 'Sim' : 'Não'}`);
  console.log();

  // ============================================================================
  // 12. LOGOUT
  // ============================================================================
  console.log("1️⃣2️⃣ LOGOUT");
  console.log("-".repeat(70));
  
  await sapMockService.logout();
  
  console.log("✓ Logout realizado");
  console.log();

  console.log("=".repeat(70));
  console.log("✅ TESTE CONCLUÍDO COM SUCESSO");
  console.log("=".repeat(70));
}

// Executar
main().catch(console.error);
