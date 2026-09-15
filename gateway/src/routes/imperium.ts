import type { FastifyInstance } from "fastify";
import { getDbPool } from "../scheduler/dailySync.js";
import { ImperiumNotConfiguredError, ImperiumSyncService } from "../services/imperium/index.js";

function service(app: FastifyInstance) {
  return new ImperiumSyncService(getDbPool(), {
    info: (obj, msg) => app.log.info(obj as object, msg),
    warn: (obj, msg) => app.log.warn(obj as object, msg),
    error: (obj, msg) => app.log.error(obj as object, msg),
  });
}

function sendError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof ImperiumNotConfiguredError) {
    return reply.code(503).send({ ok: false, error: err.message });
  }
  const message = err instanceof Error ? err.message : "Erro interno";
  return reply.code(400).send({ ok: false, error: message });
}

export async function registerImperiumRoutes(app: FastifyInstance) {
  app.get("/integrations/imperium/health", async (req, reply) => {
    try {
      const svc = service(app);
      try {
        await svc.init();
      } catch (err) {
        app.log.warn({ err }, "Schema Imperium indisponível no health");
      }
      const probe = await svc.probe();
      return reply.code(probe.configured && probe.healthy ? 200 : probe.configured ? 503 : 200).send({
        ok: probe.healthy,
        ...probe,
        timestamp: new Date().toISOString(),
        correlationId: (req as { correlationId?: string }).correlationId,
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/smoke", async (_req, reply) => {
    try {
      const svc = service(app);
      await svc.init();
      const result = await svc.smokeTest();
      return reply.send({ ok: result.wsdl.ok, ...result });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/estoque/sync", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { ponteiro?: string; skus?: string[] };
      const svc = service(app);
      return reply.send(await svc.syncEstoque(body));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/integrations/imperium/estoque", async (req, reply) => {
    try {
      const q = req.query as { limit?: string };
      const svc = service(app);
      const items = await svc.listEstoque(Number(q.limit) || 200);
      return reply.send({ ok: true, items });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/produtos/sync", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { limit?: number };
      const svc = service(app);
      const result = await svc.syncProducts({ limit: body.limit });
      return reply.send(result);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/cargas", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as {
        docNums?: number[];
        docNum?: number;
        placa?: string;
        placaExpedicao?: string;
      };
      const docNums = body.docNums ?? (body.docNum != null ? [body.docNum] : []);
      const svc = service(app);
      const result = await svc.sendCargas({
        docNums,
        placa: body.placa,
        placaExpedicao: body.placaExpedicao,
      });
      return reply.send(result);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/integrations/imperium/cargas", async (req, reply) => {
    try {
      const q = req.query as { limit?: string };
      const svc = service(app);
      const items = await svc.listLocalCargas(Number(q.limit) || 50);
      return reply.send({ ok: true, items });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/cargas/:codCarga/refresh", async (req, reply) => {
    try {
      const { codCarga } = req.params as { codCarga: string };
      const svc = service(app);
      const result = await svc.refreshCarga(codCarga);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/cargas/poll", async (_req, reply) => {
    try {
      const svc = service(app);
      return reply.send(await svc.pollCargas());
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/fornecedores", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as {
        idFornecedor?: string;
        nome?: string;
        cnpj?: string;
        insc?: string;
      };
      if (!body.idFornecedor || !body.nome) {
        return reply.code(400).send({ ok: false, error: "idFornecedor e nome obrigatórios" });
      }
      const svc = service(app);
      return reply.send(await svc.saveFornecedor(body as { idFornecedor: string; nome: string }));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/notas-entrada", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as {
        idFornecedor?: string;
        numero?: string;
        serie?: string;
        dataEmissao?: string;
        placa?: string;
        itens?: Array<{ idProduto: string; grade?: string; quantidade: number }>;
      };
      if (!body.idFornecedor || !body.numero || !body.dataEmissao || !body.itens?.length) {
        return reply.code(400).send({ ok: false, error: "idFornecedor, numero, dataEmissao e itens são obrigatórios" });
      }
      const svc = service(app);
      return reply.send(
        await svc.saveNotaEntrada({
          idFornecedor: body.idFornecedor,
          numero: body.numero,
          serie: body.serie ?? "1",
          dataEmissao: body.dataEmissao,
          placa: body.placa,
          itens: body.itens,
        }),
      );
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/notas", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { docNums?: number[] };
      const svc = service(app);
      return reply.send(await svc.informarNotas(body.docNums ?? []));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/pedidos/:docNum/cancelar", async (req, reply) => {
    try {
      const { docNum } = req.params as { docNum: string };
      const svc = service(app);
      return reply.send(await svc.cancelarPedido(Number(docNum)));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/integrations/imperium/notas/cancelar", async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { numeroNf?: number; serieNf?: string; cnpjEmitente?: string };
      if (!body.numeroNf) return reply.code(400).send({ ok: false, error: "numeroNf obrigatório" });
      const svc = service(app);
      return reply.send(await svc.cancelarNotaFiscal(body as { numeroNf: number; serieNf?: string; cnpjEmitente?: string }));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/integrations/imperium/pedidos/:docNum", async (req, reply) => {
    try {
      const { docNum } = req.params as { docNum: string };
      const svc = service(app);
      return reply.send(await svc.consultarPedido(docNum));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/integrations/imperium/outbox", async (req, reply) => {
    try {
      const q = req.query as { limit?: string };
      const svc = service(app);
      const items = await svc.listOutbox(Number(q.limit) || 30);
      return reply.send({ ok: true, items });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
