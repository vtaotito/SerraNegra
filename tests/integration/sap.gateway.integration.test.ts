/**
 * Testes de integração para endpoints SAP do Gateway
 * NOTA: Estes testes requerem que o gateway esteja rodando e configurado
 */
import test from "node:test";
import assert from "node:assert/strict";

/**
 * IMPORTANTE: Estes testes são "esqueleto" e devem ser executados em ambiente controlado
 * com SAP mockado ou sandbox.
 * 
 * Para rodar contra API real:
 * 1. Configure variáveis de ambiente SAP no .env
 * 2. Inicie o gateway: cd gateway && npm run dev
 * 3. Execute: npm test
 */

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";
const SKIP_INTEGRATION = process.env.SKIP_SAP_INTEGRATION === "true";

test("GET /api/sap/health - deve retornar estrutura esperada", { skip: SKIP_INTEGRATION }, async () => {
  const res = await fetch(`${GATEWAY_URL}/api/sap/health`);
  const data = await res.json() as any;

  assert.ok(typeof data.ok === "boolean");
  assert.ok(typeof data.message === "string");
  assert.ok(typeof data.timestamp === "string");
  
  // Não deve expor credenciais
  const text = JSON.stringify(data).toLowerCase();
  assert.ok(!text.includes("password"));
  assert.ok(!text.includes("senha"));
});

test("GET /api/sap/orders - deve retornar lista de pedidos", { skip: SKIP_INTEGRATION }, async () => {
  const res = await fetch(`${GATEWAY_URL}/api/sap/orders?status=open&limit=10`);
  
  if (res.ok) {
    const data = await res.json() as any;
    
    assert.ok(Array.isArray(data.orders));
    assert.ok(typeof data.count === "number");
    assert.ok(typeof data.timestamp === "string");
    
    if (data.orders.length > 0) {
      const firstOrder = data.orders[0];
      assert.ok(typeof firstOrder.DocEntry === "number");
      assert.ok(typeof firstOrder.DocNum === "number");
      assert.ok(typeof firstOrder.CardCode === "string");
    }
  } else {
    // Se falhar, validar estrutura de erro
    const error = await res.json() as any;
    assert.ok(typeof error.error === "string");
    assert.ok(typeof error.message === "string");
  }
});

test("GET /api/sap/orders/:docEntry - deve retornar pedido específico", { skip: SKIP_INTEGRATION }, async () => {
  const docEntry = 999999; // DocEntry fictício
  const res = await fetch(`${GATEWAY_URL}/api/sap/orders/${docEntry}`);
  
  // Esperado: 404 (pedido não existe) ou 200 (pedido existe)
  assert.ok(res.status === 404 || res.status === 200 || res.status === 500);
  
  const data = await res.json() as any;
  
  if (res.status === 404) {
    assert.ok(data.message.includes("não encontrado"));
  }
  
  if (res.status === 200) {
    assert.ok(typeof data.order === "object");
    assert.equal(data.order.DocEntry, docEntry);
  }
});

test("PATCH /api/sap/orders/:docEntry/status - deve validar payload", { skip: SKIP_INTEGRATION }, async () => {
  const docEntry = 999999; // DocEntry fictício
  
  // Teste 1: Sem body (deve retornar 400)
  const res1 = await fetch(`${GATEWAY_URL}/api/sap/orders/${docEntry}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  
  assert.equal(res1.status, 400);
  const error1 = await res1.json() as any;
  assert.ok(error1.error.includes("Body inválido"));
  
  // Teste 2: Com body válido (pode retornar 404 se pedido não existe)
  const res2 = await fetch(`${GATEWAY_URL}/api/sap/orders/${docEntry}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "EM_SEPARACAO",
      orderId: "WMS-TEST-123",
      lastEvent: "INICIAR_SEPARACAO"
    })
  });
  
  // Aceita 404 (pedido não existe) ou 200 (atualizado)
  assert.ok(res2.status === 404 || res2.status === 200 || res2.status === 500);
});

test("Segurança: headers de correlação devem ser propagados", { skip: SKIP_INTEGRATION }, async () => {
  const correlationId = "test-corr-" + Date.now();
  
  const res = await fetch(`${GATEWAY_URL}/api/sap/health`, {
    headers: {
      "X-Correlation-Id": correlationId
    }
  });
  
  const responseCorrelationId = res.headers.get("x-correlation-id");
  assert.equal(responseCorrelationId, correlationId);
});

test("Segurança: respostas não devem conter cookies SAP", { skip: SKIP_INTEGRATION }, async () => {
  const res = await fetch(`${GATEWAY_URL}/api/sap/health`);
  
  const setCookie = res.headers.get("set-cookie");
  // Gateway não deve retornar cookies do SAP para o cliente
  if (setCookie) {
    const cookieLower = setCookie.toLowerCase();
    assert.ok(!cookieLower.includes("b1session"));
    assert.ok(!cookieLower.includes("routeid"));
  }
});
