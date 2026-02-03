export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpHeaders = Record<string, string | undefined>;

export type HttpRequest<TBody = unknown, TParams = Record<string, string>, TQuery = Record<string, string | undefined>> = {
  method: HttpMethod;
  path: string;
  headers: HttpHeaders;
  body?: TBody;
  params?: TParams;
  query?: TQuery;
  requestId: string;
  receivedAt: string;
  ip?: string;
  userAgent?: string;
};

export type HttpResponse<TBody = unknown> = {
  status: number;
  headers?: Record<string, string>;
  body?: TBody;
};

type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack: (...args: TArgs) => TResult;
}["bivarianceHack"];

export type ApiHandler<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string | undefined>
> = BivariantCallback<[req: HttpRequest<TBody, TParams, TQuery>, ctx: RequestContext], Promise<HttpResponse>>;

export type Middleware = BivariantCallback<[req: HttpRequest, ctx: RequestContext, next: ApiHandler], Promise<HttpResponse>>;

export const composeMiddlewares = (middlewares: Middleware[], handler: ApiHandler): ApiHandler => {
  return middlewares.reduceRight<ApiHandler>(
    (next, middleware) => (req, ctx) => middleware(req, ctx, next),
    handler
  );
};

export type ApiRole = "operador" | "supervisor" | "comercial" | "admin";

export type ApiVersion = "v1";

export type AuthContext = {
  userId: string;
  role: ApiRole;
  tenantId?: string;
  displayName?: string;
};

export type AuditContext = {
  correlationId: string;
  requestId: string;
  actorId: string;
  actorRole: ApiRole;
  ip?: string;
  userAgent?: string;
};

export type RequestContext = {
  version?: ApiVersion;
  auth?: AuthContext;
  audit?: AuditContext;
  idempotencyKey?: string;
  observability?: {
    requestId: string;
    correlationId: string;
    logger?: unknown;
    span?: unknown;
  };
};
