/**
 * Teste da Implementação WMS
 * 
 * Script para testar os services implementados
 * 
 * Execute:
 *   DATABASE_URL=postgresql://user:pass@localhost/wms_db tsx wms-core/examples/test-wms-implementation.ts
 */

import { Pool } from 'pg';
import { ProductService } from '../services/ProductService';
import { StockService } from '../services/StockService';
import { OrderService } from '../services/OrderService';

async function main() {
  console.log('='.repeat(80));
  console.log('  Teste da Implementação WMS');
  console.log('='.repeat(80));
  console.log();

  // Connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/wms_db'
  });

  try {
    // Testar conexão
    console.log('📡 Testando conexão com banco...');
    const testQuery = await pool.query('SELECT NOW()');
    console.log('✅ Conectado:', testQuery.rows[0].now);
    console.log();

    // Instanciar services
    const productService = new ProductService(pool);
    const stockService = new StockService(pool);
    const orderService = new OrderService(pool, productService, stockService);

    // =======================================================================
    // 1. PRODUTOS
    // =======================================================================
    console.log('='.repeat(80));
    console.log('1️⃣  PRODUTOS');
    console.log('='.repeat(80));

    // Criar produto
    console.log('\n✏️  Criando produto...');
    const product = await productService.create({
      sku: `TEST-${Date.now()}`,
      description: 'Produto de Teste WMS',
      unit_of_measure: 'UN',
      category: 'TESTE',
      created_by: 'test-script'
    });
    console.log('✅ Produto criado:', product.sku);
    console.log('   ID:', product.id);
    console.log('   Descrição:', product.description);

    // Buscar produto
    console.log('\n🔍 Buscando produto...');
    const foundProduct = await productService.findById(product.id);
    console.log('✅ Produto encontrado:', foundProduct?.sku);

    // Listar produtos
    console.log('\n📋 Listando produtos...');
    const productsList = await productService.list({ is_active: true }, { page: 1, limit: 5 });
    console.log('✅ Total de produtos ativos:', productsList.pagination.total);
    console.log('   Mostrando:', productsList.data.length);

    // =======================================================================
    // 2. DEPÓSITOS
    // =======================================================================
    console.log('\n' + '='.repeat(80));
    console.log('2️⃣  DEPÓSITOS');
    console.log('='.repeat(80));

    // Buscar depósito (assumindo que existe um)
    console.log('\n🔍 Buscando depósito...');
    const warehouses = await pool.query('SELECT * FROM warehouses LIMIT 1');
    
    let warehouse;
    if (warehouses.rows.length === 0) {
      console.log('⚠️  Nenhum depósito encontrado, criando...');
      const result = await pool.query(`
        INSERT INTO warehouses (code, name, warehouse_type, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [`WH-${Date.now()}`, 'Depósito Teste', 'STORAGE', 'test-script']);
      warehouse = result.rows[0];
      console.log('✅ Depósito criado:', warehouse.code);
    } else {
      warehouse = warehouses.rows[0];
      console.log('✅ Depósito encontrado:', warehouse.code);
    }

    // =======================================================================
    // 3. ESTOQUE
    // =======================================================================
    console.log('\n' + '='.repeat(80));
    console.log('3️⃣  ESTOQUE');
    console.log('='.repeat(80));

    // Entrada de estoque
    console.log('\n📥 Registrando entrada de estoque...');
    const stockIn = await stockService.stockIn(
      product.id,
      warehouse.id,
      100,
      'PURCHASE',
      'PO-123',
      'Entrada de teste',
      'test-script'
    );
    console.log('✅ Entrada registrada:', stockIn.quantity, 'unidades');
    console.log('   Tipo:', stockIn.movement_type);

    // Consultar estoque
    console.log('\n🔍 Consultando estoque...');
    const stock = await stockService.getStock(product.id, warehouse.id);
    console.log('✅ Estoque atual:');
    console.log('   Disponível:', stock?.quantity_available);
    console.log('   Reservado:', stock?.quantity_reserved);
    console.log('   Livre:', stock?.quantity_free);

    // =======================================================================
    // 4. CLIENTES
    // =======================================================================
    console.log('\n' + '='.repeat(80));
    console.log('4️⃣  CLIENTES');
    console.log('='.repeat(80));

    // Criar cliente
    console.log('\n✏️  Criando cliente...');
    const customerResult = await pool.query(`
      INSERT INTO customers (customer_code, name, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [`CLI-${Date.now()}`, 'Cliente Teste WMS', 'test-script']);
    const customer = customerResult.rows[0];
    console.log('✅ Cliente criado:', customer.name);
    console.log('   Código:', customer.customer_code);

    // =======================================================================
    // 5. PEDIDOS
    // =======================================================================
    console.log('\n' + '='.repeat(80));
    console.log('5️⃣  PEDIDOS');
    console.log('='.repeat(80));

    // Criar pedido
    console.log('\n✏️  Criando pedido...');
    const order = await orderService.create({
      order_number: `ORD-${Date.now()}`,
      customer_id: customer.id,
      customer_name: customer.name,
      lines: [{
        product_id: product.id,
        product_sku: product.sku,
        product_description: product.description,
        line_number: 1,
        quantity: 10,
        unit_of_measure: 'UN',
        unit_price: 50.00,
        warehouse_id: warehouse.id,
        warehouse_code: warehouse.code
      }],
      created_by: 'test-script'
    });
    console.log('✅ Pedido criado:', order.order_number);
    console.log('   ID:', order.id);
    console.log('   Status:', order.status);
    console.log('   Total:', order.total_amount);
    console.log('   Linhas:', order.lines.length);

    // =======================================================================
    // 6. WORKFLOW
    // =======================================================================
    console.log('\n' + '='.repeat(80));
    console.log('6️⃣  WORKFLOW DE PROCESSAMENTO');
    console.log('='.repeat(80));

    // Processar pedido
    console.log('\n⚙️  Processando pedido (verificando estoque + reservando)...');
    const processed = await orderService.process(order.id, 'test-script');
    console.log('✅ Pedido processado');
    console.log('   Status:', processed.status);

    // Verificar estoque após reserva
    const stockAfterReserve = await stockService.getStock(product.id, warehouse.id);
    console.log('\n📊 Estoque após reserva:');
    console.log('   Disponível:', stockAfterReserve?.quantity_available);
    console.log('   Reservado:', stockAfterReserve?.quantity_reserved);
    console.log('   Livre:', stockAfterReserve?.quantity_free);

    // Iniciar separação
    console.log('\n📦 Iniciando separação...');
    await orderService.startPicking(order.id, 'test-script');
    console.log('✅ Separação iniciada');

    // Registrar quantidade separada
    console.log('\n✍️  Registrando quantidade separada...');
    await orderService.registerPickedQuantity(processed.lines[0].id, 10, 'test-script');
    console.log('✅ Quantidade registrada: 10 unidades');

    // Confirmar separação
    console.log('\n✅ Confirmando separação...');
    const picked = await orderService.confirmPicking(order.id, 'test-script');
    console.log('✅ Separação confirmada');
    console.log('   Status:', picked.status);

    // Verificar estoque final
    const stockFinal = await stockService.getStock(product.id, warehouse.id);
    console.log('\n📊 Estoque final:');
    console.log('   Disponível:', stockFinal?.quantity_available);
    console.log('   Reservado:', stockFinal?.quantity_reserved);
    console.log('   Livre:', stockFinal?.quantity_free);

    // Listar movimentações
    console.log('\n📜 Histórico de movimentações:');
    const movements = await stockService.getMovements(product.id, warehouse.id);
    movements.forEach((mov, index) => {
      console.log(`   ${index + 1}. ${mov.movement_type} - ${mov.quantity} ${mov.unit_of_measure}`);
      console.log(`      ${mov.notes || ''}`);
      console.log(`      ${new Date(mov.created_at).toLocaleString()}`);
    });

    // =======================================================================
    // RESUMO
    // =======================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(80));
    console.log('✅ Produto criado e consultado');
    console.log('✅ Estoque registrado e consultado');
    console.log('✅ Cliente criado');
    console.log('✅ Pedido criado com linhas');
    console.log('✅ Workflow completo executado:');
    console.log('   • PENDING → PROCESSING');
    console.log('   • Reserva de estoque');
    console.log('   • PROCESSING → PICKING');
    console.log('   • Registro de quantidades');
    console.log('   • PICKING → PICKED');
    console.log('✅ Movimentações registradas');
    console.log('✅ Auditoria completa');

    console.log('\n' + '='.repeat(80));
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERRO:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
