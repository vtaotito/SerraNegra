import { WmsError } from "../../wms-core/src/errors.js";
import { ApiRole, Middleware } from "../http.js";
import { getHeaderValue } from "../utils/headers.js";

const parseRole = (value: string | undefined): ApiRole | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "operador" || normalized === "supervisor" || normalized === "comercial" || normalized === "admin") {
    return normalized;
  }
  return undefined;
};

export const createAuthenticationMiddleware = (): Middleware => {
  return async (req, ctx, next) => {
    const userId = getHeaderValue(req.headers, "x-user-id");
    const roleHeader = getHeaderValue(req.headers, "x-user-role");
    const role = parseRole(roleHeader);
    if (!userId || !role) {
      throw new WmsError("WMS-AUTH-001", "Credenciais ausentes ou invalidas.");
    }
    ctx.auth = {
      userId,
      role,
      tenantId: getHeaderValue(req.headers, "x-tenant-id"),
      displayName: getHeaderValue(req.headers, "x-user-name")
    };
    return next(req, ctx);
  };
};
