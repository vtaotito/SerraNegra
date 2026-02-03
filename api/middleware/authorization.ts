import { WmsError } from "../../wms-core/src/errors.js";
import { ApiRole, Middleware } from "../http.js";

const isRoleAllowed = (role: ApiRole, allowed: ApiRole[]): boolean => {
  if (role === "admin") {
    return true;
  }
  return allowed.includes(role);
};

export const createAuthorizationMiddleware = (allowedRoles: ApiRole[]): Middleware => {
  return async (req, ctx, next) => {
    if (!ctx.auth) {
      throw new WmsError("WMS-AUTH-001", "Autenticacao obrigatoria.");
    }
    if (!isRoleAllowed(ctx.auth.role, allowedRoles)) {
      throw new WmsError("WMS-AUTH-001", "Permissao insuficiente.", { allowedRoles });
    }
    return next(req, ctx);
  };
};
