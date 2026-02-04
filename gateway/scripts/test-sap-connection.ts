/**
 * Script manual para testar conexão SAP.
 * 
 * USO:
 *   1. Configure o .env com as credenciais SAP
 *   2. Execute: npm run dev (ou tsx gateway/scripts/test-sap-connection.ts)
 * 
 * Este script NÃO loga senhas ou tokens.
 */

import "dotenv/config";
import { createSapClient } from "../src/config/sap.js";
import { SapOrdersService } from "../src/services/sapOrdersService.js";

const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    console.log(`[DEBUG] ${msg}`, meta || "");
  },
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${msg}`, meta || "");
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${msg}`, meta || "");
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${msg}`, meta || "");
  }
};

async function main() {
  console.log("\n=== Teste de Conexão SAP B1 ===\n");

  // Verificar variáveis de ambiente (sem logar senhas)
  const requiredVars = ["SAP_B1_BASE_URL", "SAP_B1_COMPANY_DB", "SAP_B1_USERNAME", "SAP_B1_PASSWORD"];
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error(`❌ Variáveis de ambiente faltando: ${missing.join(", ")}`);
    console.error("Configure o arquivo .env antes de executar este script.\n");
    process.exit(1);
  }

  console.log("✓ Variáveis de ambiente configuradas");
  console.log(`  Base URL: ${process.env.SAP_B1_BASE_URL}`);
  console.log(`  Company DB: ${process.env.SAP_B1_COMPANY_DB}`);
  console.log(`  Username: ${process.env.SAP_B1_USERNAME}`);
  console.log(`  Password: ${"*".repeat(8)}\n`);

  try {
    // 1. Criar cliente SAP
    console.log("1. Criando cliente SAP...");
    const client = createSapClient(logger);
    console.log("   ✓ Cliente criado\n");

    // 2. Testar login
    console.log("2. Testando login...");
    const service = new SapOrdersService(client);
    const healthResult = await service.healthCheck("test-script-001");

    if (!healthResult.ok) {
      console.error(`   ❌ Falha no login: ${healthResult.message}\n`);
      process.exit(1);
    }

    console.log(`   ✓ Login bem-sucedido: ${healthResult.message}\n`);

    // 3. Listar pedidos abertos
    console.log("3. Listando pedidos abertos (primeiros 5)...");
    const orders = await service.listOrders(
      { limit: 5, docStatus: "O" },
      "test-script-002"
    );

    console.log(`   ✓ Encontrados ${orders.length} pedido(s)\n`);

    if (orders.length > 0) {
      console.log("   Primeiros pedidos:");
      orders.forEach((order, idx) => {
        console.log(`   ${idx + 1}. DocNum: ${order.sapDocNum} | Cliente: ${order.customerId} (${order.customerName || "N/A"}) | Status WMS: ${order.status} | Itens: ${order.items.length}`);
      });
      console.log();

      // 4. Buscar detalhes do primeiro pedido
      const firstOrder = orders[0];
      if (firstOrder) {
        console.log(`4. Buscando detalhes do pedido DocEntry=${firstOrder.sapDocEntry}...`);
        const orderDetail = await service.getOrder(firstOrder.sapDocEntry, "test-script-003");

        console.log(`   ✓ Pedido recuperado:`);
        console.log(`     Order ID: ${orderDetail.orderId}`);
        console.log(`     DocNum: ${orderDetail.sapDocNum}`);
        console.log(`     Cliente: ${orderDetail.customerId} - ${orderDetail.customerName || "N/A"}`);
        console.log(`     Status: ${orderDetail.status}`);
        console.log(`     Itens (${orderDetail.items.length}):`);
        orderDetail.items.forEach((item, idx) => {
          console.log(`       ${idx + 1}. ${item.sku} | Qtd: ${item.quantity} | ${item.description || "N/A"}`);
        });
        console.log();
      }
    } else {
      console.log("   ⚠ Nenhum pedido aberto encontrado.");
      console.log("   Dica: Crie um pedido de venda no SAP para testar a integração.\n");
    }

    console.log("=== ✅ Teste concluído com sucesso ===\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erro durante o teste:");
    console.error(error);
    console.log();
    process.exit(1);
  }
}

main();
