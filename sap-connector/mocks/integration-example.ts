/**
 * Exemplo de Integração WMS + SAP Mock
 * 
 * Demonstra como importar pedidos do SAP mock para o WMS
 */

import { sapMockService } from "./sapMockService.js";
import { createOrderFromSap } from "../../wms-core/src/services/sapIntegrationService.js";
import { v4 as uuidv4 } from "uuid";

async function integrationExample() {
  console.log("=".repeat(70));
  console.log("INTEGRAÇÃO WMS + SAP MOCK - EXEMPLO");
  console.log("=".repeat(70));
  console.log();

  // ============================================================================
  // 1. LOGIN NO SAP (MOCK)
  // ============================================================================
  console.log("1️⃣  LOGIN NO SAP MOCK");
  console.log("-".repeat(70));
  
  await sapMockService.login("REDACTED_USER", "REDACTED_PASSWORD", "REDACTED_COMPANY_DB");
  console.log("✓ Autenticado no SAP");
  console.log();

  // ============================================================================
  // 2. BUSCAR PEDIDOS ABERTOS
  // ============================================================================
  console.log("2️⃣  BUSCAR PEDIDOS ABERTOS");
  console.log("-".repeat(70));
  
  const ordersResponse = await sapMockService.getOrders({
    status: "open",
    limit: 5
  });
  
  console.log(`✓ ${ordersResponse.value.length} pedidos abertos encontrados`);
  console.log();

  // ============================================================================
  // 3. CONVERTER PEDIDOS PARA WMS
  // ============================================================================
  console.log("3️⃣  CONVERTER PEDIDOS SAP → WMS");
  console.log("-".repeat(70));
  
  const wmsOrders = [];
  
  for (const sapOrder of ordersResponse.value) {
    const wmsOrder = createOrderFromSap({
      orderId: uuidv4(),
      sapOrder
    });
    
    wmsOrders.push(wmsOrder);
    
    console.log(`  ✓ Pedido SAP #${sapOrder.DocNum} (DocEntry: ${sapOrder.DocEntry})`);
    console.log(`    → WMS Order ID: ${wmsOrder.id}`);
    console.log(`    Cliente: ${wmsOrder.customerId} - ${wmsOrder.customerName}`);
    console.log(`    Items: ${wmsOrder.items.length} produtos`);
    console.log(`    Total: R$ ${sapOrder.DocTotal?.toFixed(2)}`);
    console.log(`    Status WMS: ${wmsOrder.status}`);
    console.log();
  }

  // ============================================================================
  // 4. SIMULAR PROCESSAMENTO NO WMS
  // ============================================================================
  console.log("4️⃣  SIMULAR PROCESSAMENTO WMS");
  console.log("-".repeat(70));
  
  const firstOrder = wmsOrders[0];
  const sapOrder = ordersResponse.value[0];
  
  console.log(`  Processando pedido WMS: ${firstOrder.id}`);
  console.log(`  Status inicial: ${firstOrder.status}`);
  console.log();

  // Simular transições de estado
  const transitions = [
    { status: "EM_SEPARACAO", event: "INICIAR_SEPARACAO" },
    { status: "CONFERIDO", event: "FINALIZAR_SEPARACAO" },
    { status: "AGUARDANDO_COTACAO", event: "CONFERIR" }
  ];

  for (const transition of transitions) {
    console.log(`  → Transição: ${transition.event}`);
    console.log(`    Novo status WMS: ${transition.status}`);
    
    // Atualizar UDFs no SAP
    await sapMockService.updateOrderStatus(sapOrder.DocEntry, {
      U_WMS_STATUS: transition.status,
      U_WMS_ORDERID: firstOrder.id,
      U_WMS_LAST_EVENT: transition.event,
      U_WMS_LAST_TS: new Date().toISOString(),
      U_WMS_CORR_ID: `corr-${Date.now()}`
    });
    
    console.log(`    ✓ SAP atualizado (DocEntry: ${sapOrder.DocEntry})`);
    console.log();
    
    // Delay para simular processamento
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // ============================================================================
  // 5. VERIFICAR ATUALIZAÇÃO NO SAP
  // ============================================================================
  console.log("5️⃣  VERIFICAR ATUALIZAÇÃO NO SAP");
  console.log("-".repeat(70));
  
  const updatedSapOrder = await sapMockService.getOrderByDocEntry(sapOrder.DocEntry);
  
  console.log(`  Pedido SAP #${updatedSapOrder.DocNum}`);
  console.log(`  UDFs atualizados:`);
  console.log(`    U_WMS_STATUS: ${updatedSapOrder.U_WMS_STATUS}`);
  console.log(`    U_WMS_ORDERID: ${updatedSapOrder.U_WMS_ORDERID}`);
  console.log(`    U_WMS_LAST_EVENT: ${updatedSapOrder.U_WMS_LAST_EVENT}`);
  console.log(`    U_WMS_LAST_TS: ${updatedSapOrder.U_WMS_LAST_TS}`);
  console.log();

  // ============================================================================
  // 6. CONSULTAR ESTOQUE DE PRODUTOS DO PEDIDO
  // ============================================================================
  console.log("6️⃣  CONSULTAR ESTOQUE DOS PRODUTOS");
  console.log("-".repeat(70));
  
  if (updatedSapOrder.DocumentLines && updatedSapOrder.DocumentLines.length > 0) {
    const firstLine = updatedSapOrder.DocumentLines[0];
    const stockResponse = await sapMockService.getItemWarehouseInfo(firstLine.ItemCode);
    
    console.log(`  Produto: ${firstLine.ItemCode} - ${firstLine.ItemDescription}`);
    console.log(`  Quantidade pedida: ${firstLine.Quantity}`);
    console.log();
    console.log("  Estoque por depósito:");
    
    stockResponse.value.forEach(stock => {
      console.log(`    ${stock.WarehouseCode}:`);
      console.log(`      Estoque: ${stock.InStock}`);
      console.log(`      Comprometido: ${stock.Committed}`);
      console.log(`      Disponível: ${stock.Available}`);
      console.log(`      ${stock.Available! >= firstLine.Quantity ? '✅' : '❌'} ${stock.Available! >= firstLine.Quantity ? 'Estoque suficiente' : 'Estoque insuficiente'}`);
      console.log();
    });
  }

  // ============================================================================
  // 7. ESTATÍSTICAS FINAIS
  // ============================================================================
  console.log("7️⃣  ESTATÍSTICAS FINAIS");
  console.log("-".repeat(70));
  
  const stats = sapMockService.getStats();
  
  console.log("  Resumo do Sistema:");
  console.log(`    Pedidos totais: ${stats.totalOrders}`);
  console.log(`    Pedidos abertos: ${stats.openOrders}`);
  console.log(`    Pedidos fechados: ${stats.closedOrders}`);
  console.log(`    Produtos: ${stats.totalItems}`);
  console.log(`    Depósitos: ${stats.totalWarehouses}`);
  console.log(`    Clientes: ${stats.totalCustomers}`);
  console.log();

  // ============================================================================
  // 8. RESUMO DA INTEGRAÇÃO
  // ============================================================================
  console.log("=".repeat(70));
  console.log("✅ INTEGRAÇÃO WMS + SAP CONCLUÍDA");
  console.log("=".repeat(70));
  console.log();
  console.log(`  Total de pedidos importados: ${wmsOrders.length}`);
  console.log(`  Pedido processado: ${firstOrder.id}`);
  console.log(`  Status final: ${transitions[transitions.length - 1].status}`);
  console.log(`  SAP sincronizado: ✅`);
  console.log();

  // ============================================================================
  // 9. LOGOUT
  // ============================================================================
  await sapMockService.logout();
  console.log("✓ Desconectado do SAP");
  console.log();
}

// Executar
integrationExample().catch(console.error);
