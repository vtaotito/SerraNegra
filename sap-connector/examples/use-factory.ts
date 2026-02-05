/**
 * Exemplo de uso do SAP Client Factory
 * 
 * Demonstra como usar o factory para alternar entre mock e SAP real
 * de forma transparente no código da aplicação.
 * 
 * Execute:
 *   USE_SAP_MOCK=true tsx sap-connector/examples/use-factory.ts
 */

import { createSapClient, getSapClient, resetSapClient } from '../sapClientFactory';

// ============================================================================
// EXEMPLO 1: Uso Básico
// ============================================================================

async function example1_BasicUsage() {
  console.log('\n=== Exemplo 1: Uso Básico ===\n');

  // Criar cliente (automaticamente escolhe mock ou real baseado no .env)
  const sapClient = createSapClient();

  // Usar normalmente
  await sapClient.login('admin', 'password');
  
  const orders = await sapClient.getOrders({ status: 'open' });
  console.log(`📦 Pedidos encontrados: ${orders.value.length}`);

  await sapClient.logout();
}

// ============================================================================
// EXEMPLO 2: Forçar Mock (útil para testes)
// ============================================================================

async function example2_ForceMock() {
  console.log('\n=== Exemplo 2: Forçar Mock ===\n');

  // Forçar uso do mock (ignora .env)
  const sapClient = createSapClient({ useMock: true });

  await sapClient.login('test', 'test');
  
  const orders = await sapClient.getOrders();
  console.log(`📦 Pedidos mock: ${orders.value.length}`);

  await sapClient.logout();
}

// ============================================================================
// EXEMPLO 3: Singleton Pattern
// ============================================================================

async function example3_Singleton() {
  console.log('\n=== Exemplo 3: Singleton Pattern ===\n');

  // Obter instância singleton
  const sap1 = getSapClient();
  const sap2 = getSapClient();

  // Mesma instância
  console.log(`✅ Mesma instância: ${sap1 === sap2}`);

  await sap1.login('user', 'pass');
  
  const orders = await sap2.getOrders(); // Usa mesma sessão
  console.log(`📦 Pedidos: ${orders.value.length}`);

  await sap1.logout();

  // Reset para testes
  resetSapClient();
}

// ============================================================================
// EXEMPLO 4: Service Layer Pattern
// ============================================================================

/**
 * Serviço de importação de pedidos
 */
class OrderImportService {
  private sapClient = getSapClient();

  async importOpenOrders() {
    console.log('🔄 Importando pedidos abertos do SAP...');

    await this.sapClient.login(
      process.env.SAP_USER || 'admin',
      process.env.SAP_PASS || 'password'
    );

    const response = await this.sapClient.getOrders({ status: 'open' });
    
    console.log(`📥 ${response.value.length} pedidos abertos encontrados`);

    const imported = [];
    
    for (const sapOrder of response.value) {
      const wmsOrder = this.convertToWmsOrder(sapOrder);
      imported.push(wmsOrder);

      // Atualizar SAP com status WMS
      await this.sapClient.updateOrderStatus(sapOrder.DocEntry, {
        U_WMS_STATUS: 'PENDING',
        U_WMS_ORDERID: wmsOrder.id,
        U_WMS_LAST_EVENT: 'Importado para WMS',
        U_WMS_LAST_TS: new Date().toISOString()
      });
    }

    await this.sapClient.logout();

    return imported;
  }

  private convertToWmsOrder(sapOrder: any) {
    return {
      id: `WMS-${sapOrder.DocEntry}`,
      externalId: sapOrder.DocEntry,
      customerId: sapOrder.CardCode,
      customerName: sapOrder.CardName,
      status: 'PENDING',
      lines: sapOrder.DocumentLines.map((line: any) => ({
        itemCode: line.ItemCode,
        quantity: line.Quantity,
        warehouse: line.WarehouseCode
      }))
    };
  }
}

async function example4_ServiceLayer() {
  console.log('\n=== Exemplo 4: Service Layer Pattern ===\n');

  const importService = new OrderImportService();
  const orders = await importService.importOpenOrders();

  console.log(`\n✅ Total importado: ${orders.length} pedidos`);
  
  orders.forEach(order => {
    console.log(`  - ${order.id}: ${order.customerName} (${order.lines.length} itens)`);
  });
}

// ============================================================================
// EXEMPLO 5: Uso em API REST
// ============================================================================

/**
 * Controller para endpoints da API
 */
class OrdersController {
  private sapClient = getSapClient();

  /**
   * GET /api/orders
   */
  async listOrders(req: any) {
    const { status, customer } = req.query;

    await this.sapClient.login('api_user', 'api_pass');

    const response = await this.sapClient.getOrders({
      status: status === 'open' ? 'open' : undefined,
      cardCode: customer
    });

    await this.sapClient.logout();

    return {
      total: response.value.length,
      orders: response.value
    };
  }

  /**
   * GET /api/orders/:docEntry
   */
  async getOrder(req: any) {
    const { docEntry } = req.params;

    await this.sapClient.login('api_user', 'api_pass');

    const order = await this.sapClient.getOrderByDocEntry(parseInt(docEntry));

    await this.sapClient.logout();

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  /**
   * PATCH /api/orders/:docEntry/status
   */
  async updateOrderStatus(req: any) {
    const { docEntry } = req.params;
    const { wmsStatus, event } = req.body;

    await this.sapClient.login('api_user', 'api_pass');

    const updated = await this.sapClient.updateOrderStatus(parseInt(docEntry), {
      U_WMS_STATUS: wmsStatus,
      U_WMS_LAST_EVENT: event,
      U_WMS_LAST_TS: new Date().toISOString()
    });

    await this.sapClient.logout();

    return updated;
  }
}

async function example5_ApiController() {
  console.log('\n=== Exemplo 5: API Controller ===\n');

  const controller = new OrdersController();

  // Simular requisições
  console.log('📡 GET /api/orders?status=open');
  const list = await controller.listOrders({ query: { status: 'open' } });
  console.log(`  Resposta: ${list.total} pedidos`);

  console.log('\n📡 GET /api/orders/60');
  const order = await controller.getOrder({ params: { docEntry: '60' } });
  console.log(`  Resposta: Pedido ${order.DocNum} - ${order.CardName}`);

  console.log('\n📡 PATCH /api/orders/60/status');
  const updated = await controller.updateOrderStatus({
    params: { docEntry: '60' },
    body: { wmsStatus: 'PICKING', event: 'Separação iniciada' }
  });
  console.log(`  Resposta: Status atualizado para ${updated?.U_WMS_STATUS}`);
}

// ============================================================================
// EXEMPLO 6: Testes Unitários
// ============================================================================

async function example6_UnitTests() {
  console.log('\n=== Exemplo 6: Testes Unitários ===\n');

  // Em um teste real, você usaria Jest/Vitest/etc
  // Este é apenas um exemplo da estrutura

  console.log('✅ Test: Deve importar pedidos');
  
  // Setup
  resetSapClient();
  const sapClient = createSapClient({ useMock: true });

  // Test
  await sapClient.login('test', 'test');
  const orders = await sapClient.getOrders({ status: 'open' });
  
  const passed = orders.value.length > 0;
  console.log(`  ${passed ? '✅' : '❌'} ${orders.value.length} pedidos encontrados`);

  await sapClient.logout();

  // Cleanup
  resetSapClient();
}

// ============================================================================
// EXEMPLO 7: Configuração por Ambiente
// ============================================================================

async function example7_EnvironmentConfig() {
  console.log('\n=== Exemplo 7: Configuração por Ambiente ===\n');

  const env = process.env.NODE_ENV || 'development';
  console.log(`🌍 Ambiente: ${env}`);

  let sapClient;

  switch (env) {
    case 'test':
      console.log('  → Usando mock (testes)');
      sapClient = createSapClient({ useMock: true, mockDelay: 0 });
      break;

    case 'development':
      console.log('  → Usando mock (desenvolvimento)');
      sapClient = createSapClient({ useMock: true, mockDelay: 300 });
      break;

    case 'production':
      console.log('  → Usando SAP real (produção)');
      sapClient = createSapClient({ useMock: false });
      break;

    default:
      console.log('  → Usando mock (padrão)');
      sapClient = createSapClient({ useMock: true });
  }

  // Usar normalmente
  try {
    await sapClient.login('user', 'pass');
    const orders = await sapClient.getOrders();
    console.log(`  ✅ Conectado: ${orders.value.length} pedidos`);
    await sapClient.logout();
  } catch (error: any) {
    console.log(`  ❌ Erro: ${error.message}`);
  }
}

// ============================================================================
// EXECUTAR EXEMPLOS
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('  Exemplos de Uso do SAP Client Factory');
  console.log('='.repeat(60));

  try {
    await example1_BasicUsage();
    await example2_ForceMock();
    await example3_Singleton();
    await example4_ServiceLayer();
    await example5_ApiController();
    await example6_UnitTests();
    await example7_EnvironmentConfig();

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ Todos os exemplos executados com sucesso!');
    console.log('='.repeat(60));
    console.log('\n💡 Dicas:');
    console.log('  - Use createSapClient() para criar nova instância');
    console.log('  - Use getSapClient() para singleton');
    console.log('  - Configure USE_SAP_MOCK=true no .env');
    console.log('  - Em testes, force mock com { useMock: true }');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  }
}

// Executar se for arquivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Exports para uso em outros arquivos
export {
  OrderImportService,
  OrdersController
};
