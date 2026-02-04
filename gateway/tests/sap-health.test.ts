import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import Fastify from "fastify";
import { registerSapRoutes } from "../src/routes/sap.js";

/**
 * Teste básico do endpoint /api/sap/health
 * 
 * NOTA: Este teste requer credenciais SAP válidas no .env para funcionar.
 * Se as credenciais não estiverem configuradas, o teste verificará se o erro é tratado corretamente.
 */
describe("SAP Health Check", () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    app = Fastify({
      logger: false // Desabilitar logs durante testes
    });

    // Mock do hook de correlationId
    app.addHook("onRequest", async (req, reply) => {
      (req as any).correlationId = "test-correlation-id";
      reply.header("X-Correlation-Id", "test-correlation-id");
    });

    // Registrar rotas SAP
    try {
      await registerSapRoutes(app);
    } catch (error) {
      // Se falhar ao registrar rotas (ex: credenciais faltando), ignorar
      // O teste irá verificar o comportamento esperado
    }

    await app.ready();
  });

  after(async () => {
    if (app) {
      await app.close();
    }
  });

  it("deve retornar status 200 ou 503 no health check", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sap/health"
    });

    // Aceitar tanto 200 (sucesso) quanto 503 (falha de conexão)
    // pois o teste pode rodar sem credenciais válidas
    assert.ok(
      response.statusCode === 200 || response.statusCode === 503,
      `Status esperado: 200 ou 503, recebido: ${response.statusCode}`
    );

    const body = JSON.parse(response.body);
    
    assert.ok(body.status, "Resposta deve conter campo 'status'");
    assert.ok(body.message, "Resposta deve conter campo 'message'");
    assert.ok(body.timestamp, "Resposta deve conter campo 'timestamp'");

    if (response.statusCode === 200) {
      assert.equal(body.status, "ok", "Status deve ser 'ok' para resposta 200");
    } else {
      assert.equal(body.status, "error", "Status deve ser 'error' para resposta 503");
    }
  });

  it("deve incluir X-Correlation-Id no response", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sap/health",
      headers: {
        "x-correlation-id": "test-123"
      }
    });

    const correlationId = response.headers["x-correlation-id"];
    assert.ok(correlationId, "Response deve conter X-Correlation-Id header");
  });
});
