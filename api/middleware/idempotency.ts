import { WmsError } from "../../wms-core/src/errors.js";
import { ApiHandler, HttpResponse, Middleware } from "../http.js";
import { getHeaderValue } from "../utils/headers.js";

export type IdempotencyRecord = {
  key: string;
  method: string;
  path: string;
  response: HttpResponse;
  createdAt: string;
};

export type IdempotencyStore = {
  get: (key: string, method: string, path: string) => Promise<IdempotencyRecord | undefined>;
  set: (record: IdempotencyRecord) => Promise<void>;
};

export const createInMemoryIdempotencyStore = (): IdempotencyStore => {
  const store = new Map<string, IdempotencyRecord>();
  return {
    get: async (key, method, path) => store.get(`${key}:${method}:${path}`),
    set: async (record) => {
      store.set(`${record.key}:${record.method}:${record.path}`, record);
    }
  };
};

export const createIdempotencyMiddleware = (handler: ApiHandler, store: IdempotencyStore): ApiHandler => {
  return async (req, ctx) => {
    const idempotencyKey = ctx.idempotencyKey ?? getHeaderValue(req.headers, "idempotency-key");
    if (!idempotencyKey) {
      throw new WmsError("WMS-VAL-002", "Idempotency-Key obrigatorio para esta operacao.");
    }
    const cached = await store.get(idempotencyKey, req.method, req.path);
    if (cached) {
      return cached.response;
    }
    ctx.idempotencyKey = idempotencyKey;
    const response = await handler(req, ctx);
    if (response.status >= 200 && response.status < 300) {
      await store.set({
        key: idempotencyKey,
        method: req.method,
        path: req.path,
        response,
        createdAt: new Date().toISOString()
      });
    }
    return response;
  };
};

export const withOptionalIdempotency = (store: IdempotencyStore): Middleware => {
  return async (req, ctx, next) => {
    const key = getHeaderValue(req.headers, "idempotency-key");
    if (key) {
      ctx.idempotencyKey = key;
      const cached = await store.get(key, req.method, req.path);
      if (cached) {
        return cached.response;
      }
      const response = await next(req, ctx);
      if (response.status >= 200 && response.status < 300) {
        await store.set({
          key,
          method: req.method,
          path: req.path,
          response,
          createdAt: new Date().toISOString()
        });
      }
      return response;
    }
    return next(req, ctx);
  };
};
