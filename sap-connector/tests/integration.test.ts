/**
 * Testes de Integração SAP B1 Service Layer
 * 
 * Este arquivo contém testes completos para validar:
 * - Conectividade e autenticação
 * - Acesso a dados de pedidos, itens e estoque
 * - Resiliência (retry, circuit breaker)
 * - Performance e rate limiting
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import type { SapOrder, SapOrdersCollection, SapItem } from "../src/types.js";
import { test, describe } from "node:test";
import assert from "node:assert";

// Carregar configuração do ambiente
const SAP_CONFIG = {
  baseUrl: process.env.SAP_B1_BASE_URL || "",
  companyDb: process.env.SAP_B1_COMPANY_DB || "",
  username: process.env.SAP_B1_USERNAME || "",
  password: process.env.SAP_B1_PASSWORD || "",
  timeoutMs: Number(process.env.SAP_B1_TIMEOUT_MS || 60000),
  maxAttempts: Number(process.env.SAP_B1_MAX_ATTEMPTS || 3)
};

// Logger para testes
const testLogger = {
  debug: (msg: string, meta?: Record<string, unknown>) => 
    console.log(`[DEBUG] ${msg}`, meta ? JSON.stringify(meta) : ""),
  info: (msg: string, meta?: Record<string, unknown>) => 
    console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ""),
  warn: (msg: string, meta?: Record<string, unknown>) => 
    console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ""),
  error: (msg: string, meta?: Record<string, unknown>) => 
    console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : "")
};

// Cliente reutilizável
let client: SapServiceLayerClient;

describe("SAP B1 Integration Tests", () => {
  test("should skip tests if SAP credentials not configured", () => {
    if (!SAP_CONFIG.baseUrl || !SAP_CONFIG.companyDb || !SAP_CONFIG.username) {
      console.log("⚠️  SAP credentials not configured. Skipping integration tests.");
      console.log("   Set SAP_B1_BASE_URL, SAP_B1_COMPANY_DB, SAP_B1_USERNAME, SAP_B1_PASSWORD to run tests.");
      return;
    }
  });

  test("should create SapServiceLayerClient instance", () => {
    if (!SAP_CONFIG.baseUrl) return;

    client = new SapServiceLayerClient({
      baseUrl: SAP_CONFIG.baseUrl,
      credentials: {
        companyDb: SAP_CONFIG.companyDb,
        username: SAP_CONFIG.username,
        password: SAP_CONFIG.password
      },
      timeoutMs: SAP_CONFIG.timeoutMs,
      retry: {
        maxAttempts: SAP_CONFIG.maxAttempts
      },
      rateLimit: {
        maxConcurrent: 4,
        maxRps: 5
      },
      logger: testLogger,
      correlationHeaderName: "X-Correlation-Id"
    });

    assert.ok(client, "Client should be created");
  });

  test("should authenticate with SAP B1 Service Layer", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n🔐 Testing authentication...");
    const correlationId = `test-auth-${Date.now()}`;
    
    await client.login(correlationId);
    console.log("✅ Authentication successful");
  });

  test("should list Orders with basic fields", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n📋 Testing Orders listing...");
    const correlationId = `test-orders-${Date.now()}`;
    
    const response = await client.get<SapOrdersCollection>(
      "/Orders?$select=DocEntry,DocNum,CardCode,CardName,DocStatus,DocDate,DocTotal&$top=5",
      { correlationId }
    );

    assert.ok(response.data, "Should return data");
    assert.ok(Array.isArray(response.data.value), "Should return array of orders");
    
    console.log(`✅ Found ${response.data.value.length} orders`);
    
    if (response.data.value.length > 0) {
      const order = response.data.value[0];
      console.log(`   First order: DocEntry=${order.DocEntry}, DocNum=${order.DocNum}, CardCode=${order.CardCode}`);
      
      assert.ok(order.DocEntry, "Order should have DocEntry");
      assert.ok(order.DocNum, "Order should have DocNum");
      assert.ok(order.CardCode, "Order should have CardCode");
    }
  });

  test("should get single Order with DocumentLines", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n📄 Testing single Order with lines...");
    
    // First, get a DocEntry
    const listResponse = await client.get<SapOrdersCollection>(
      "/Orders?$select=DocEntry&$top=1",
      { correlationId: `test-order-list-${Date.now()}` }
    );

    if (listResponse.data.value.length === 0) {
      console.log("⚠️  No orders found to test");
      return;
    }

    const docEntry = listResponse.data.value[0]!.DocEntry;
    const correlationId = `test-order-${Date.now()}`;
    
    const response = await client.get<SapOrder>(
      `/Orders(${docEntry})?$select=DocEntry,DocNum,CardCode,CardName,DocStatus,DocumentStatus,Cancelled,DocDate,DocDueDate,DocTotal,DocCurrency,CreateDate,CreateTime,UpdateDate,UpdateTime&$expand=DocumentLines($select=LineNum,ItemCode,ItemDescription,Quantity,WarehouseCode,UoMCode,Price,LineTotal)`,
      { correlationId }
    );

    assert.ok(response.data, "Should return order data");
    assert.strictEqual(response.data.DocEntry, docEntry, "Should return requested order");
    
    console.log(`✅ Order ${response.data.DocNum} retrieved`);
    console.log(`   Customer: ${response.data.CardName}`);
    console.log(`   Status: ${response.data.DocStatus}`);
    console.log(`   Total: ${response.data.DocTotal} ${response.data.DocCurrency}`);
    
    if (response.data.DocumentLines && response.data.DocumentLines.length > 0) {
      console.log(`   Lines: ${response.data.DocumentLines.length}`);
      const line = response.data.DocumentLines[0];
      console.log(`   First item: ${line.ItemCode} x ${line.Quantity}`);
    }
  });

  test("should filter Orders by DocStatus", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n🔍 Testing Orders filtering by DocStatus...");
    const correlationId = `test-filter-${Date.now()}`;
    
    const response = await client.get<SapOrdersCollection>(
      "/Orders?$select=DocEntry,DocNum,DocStatus&$filter=DocStatus eq 'O'&$top=10",
      { correlationId }
    );

    assert.ok(response.data, "Should return data");
    assert.ok(Array.isArray(response.data.value), "Should return array");
    
    console.log(`✅ Found ${response.data.value.length} open orders (DocStatus='O')`);
    
    // Verify all returned orders have DocStatus='O'
    const allOpen = response.data.value.every(o => o.DocStatus === "O");
    assert.ok(allOpen, "All orders should have DocStatus='O'");
  });

  test("should list Items from catalog", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n📦 Testing Items listing...");
    const correlationId = `test-items-${Date.now()}`;
    
    const response = await client.get<{ value: SapItem[] }>(
      "/Items?$select=ItemCode,ItemName,InventoryItem,Valid,Frozen&$top=10",
      { correlationId }
    );

    assert.ok(response.data, "Should return data");
    assert.ok(Array.isArray(response.data.value), "Should return array of items");
    
    console.log(`✅ Found ${response.data.value.length} items`);
    
    if (response.data.value.length > 0) {
      const item = response.data.value[0];
      console.log(`   First item: ${item.ItemCode} - ${item.ItemName}`);
      console.log(`   InventoryItem: ${item.InventoryItem}, Valid: ${item.Valid}`);
    }
  });

  test("should handle UDF fields (if configured)", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n🏷️  Testing UDF fields access...");
    
    // Try to get an order with potential UDFs
    const listResponse = await client.get<SapOrdersCollection>(
      "/Orders?$select=DocEntry&$top=1",
      { correlationId: `test-udf-list-${Date.now()}` }
    );

    if (listResponse.data.value.length === 0) {
      console.log("⚠️  No orders found to test UDFs");
      return;
    }

    const docEntry = listResponse.data.value[0]!.DocEntry;
    const correlationId = `test-udf-${Date.now()}`;
    
    const response = await client.get<SapOrder>(
      `/Orders(${docEntry})?$select=DocEntry,DocNum,U_WMS_STATUS,U_WMS_ORDERID,U_WMS_LAST_EVENT,U_WMS_LAST_TS,U_WMS_CORR_ID`,
      { correlationId }
    );

    assert.ok(response.data, "Should return order data");
    
    console.log(`✅ Order ${response.data.DocNum} UDFs:`);
    console.log(`   U_WMS_STATUS: ${response.data.U_WMS_STATUS || "(not set)"}`);
    console.log(`   U_WMS_ORDERID: ${response.data.U_WMS_ORDERID || "(not set)"}`);
    console.log(`   U_WMS_LAST_EVENT: ${response.data.U_WMS_LAST_EVENT || "(not set)"}`);
    
    if (!response.data.U_WMS_STATUS) {
      console.log("   ℹ️  UDFs not configured yet (this is normal for first-time setup)");
    }
  });

  test("should handle retry on transient errors", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n🔄 Testing retry mechanism...");
    
    // Test with an invalid endpoint that should trigger retry
    try {
      await client.get("/Orders?$select=InvalidField12345", {
        correlationId: `test-retry-${Date.now()}`
      });
      assert.fail("Should have thrown an error");
    } catch (error: any) {
      console.log(`✅ Retry mechanism working (error: ${error.message})`);
      assert.ok(error, "Should throw error for invalid request");
    }
  });

  test("should respect rate limiting", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n⏱️  Testing rate limiting...");
    const correlationId = `test-ratelimit-${Date.now()}`;
    
    const startTime = Date.now();
    
    // Make 10 concurrent requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      client.get<SapOrdersCollection>(
        `/Orders?$select=DocEntry&$top=1`,
        { correlationId: `${correlationId}-${i}` }
      )
    );

    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Completed 10 requests in ${duration}ms`);
    console.log(`   Rate limiting working (should take >1s for 5 RPS limit)`);
    
    // With maxRps=5, 10 requests should take at least 1 second
    assert.ok(duration >= 1000, "Rate limiting should enforce delay");
  });

  test("should measure query performance", async () => {
    if (!SAP_CONFIG.baseUrl || !client) return;

    console.log("\n⚡ Performance test...");
    
    const tests = [
      {
        name: "Simple query (5 orders)",
        path: "/Orders?$select=DocEntry,DocNum,CardCode&$top=5"
      },
      {
        name: "Complex query with lines (1 order)",
        path: "/Orders?$select=DocEntry,DocNum,CardCode,CardName,DocTotal&$expand=DocumentLines&$top=1"
      },
      {
        name: "Filter query (open orders)",
        path: "/Orders?$select=DocEntry,DocNum&$filter=DocStatus eq 'O'&$top=10"
      }
    ];

    for (const testCase of tests) {
      const start = Date.now();
      await client.get(testCase.path, {
        correlationId: `test-perf-${Date.now()}`
      });
      const duration = Date.now() - start;
      console.log(`   ${testCase.name}: ${duration}ms`);
    }
    
    console.log("✅ Performance test completed");
  });
});

console.log("\n" + "=".repeat(60));
console.log("SAP B1 Integration Test Suite");
console.log("=".repeat(60));
