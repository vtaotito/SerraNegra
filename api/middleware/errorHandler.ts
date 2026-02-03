import { WmsError } from "../../wms-core/src/errors.js";
import { ApiErrorResponse } from "../dtos/errors.js";
import { ApiHandler, HttpResponse, Middleware } from "../http.js";

const buildErrorResponse = (error: Error, requestId?: string): HttpResponse<ApiErrorResponse> => {
  if (error instanceof WmsError) {
    return {
      status: error.code.startsWith("WMS-AUTH") ? 403 : 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId
        }
      }
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "WMS-UNEXPECTED",
        message: "Erro inesperado.",
        requestId
      }
    }
  };
};

export const withErrorHandling = (): Middleware => {
  return async (req, ctx, next): Promise<HttpResponse> => {
    try {
      return await next(req, ctx);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Erro inesperado.");
      const maybeLogger = (ctx.observability as unknown as { logger?: { error?: (msg: string, meta?: Record<string, unknown>) => void } })
        ?.logger;
      maybeLogger?.error?.("Erro tratado pela API.", {
        requestId: req.requestId,
        code: (normalized as unknown as { code?: string }).code,
        message: normalized.message,
        stack: normalized.stack
      });
      return buildErrorResponse(normalized, req.requestId);
    }
  };
};

export const asSafeHandler = (handler: ApiHandler): ApiHandler => {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Erro inesperado.");
      return buildErrorResponse(normalized, req.requestId);
    }
  };
};
