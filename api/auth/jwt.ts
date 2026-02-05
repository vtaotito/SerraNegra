import jwt from "jsonwebtoken";
import { WmsError } from "../../wms-core/src/errors.js";
import { ApiRole } from "../http.js";

export type UserType = "INTERNAL" | "CLIENT";

export type JwtPayload = {
  sub: string;
  userId: string;
  role: ApiRole;
  userType: UserType;
  tenantId?: string;
  displayName?: string;
  customerId?: string;
  iat?: number;
  exp?: number;
};

export type JwtConfig = {
  secret: string;
  expiresIn?: string;
  issuer?: string;
  audience?: string;
};

export const createJwtToken = (payload: Omit<JwtPayload, "iat" | "exp">, config: JwtConfig): string => {
  const options: jwt.SignOptions = {
    expiresIn: config.expiresIn ?? "8h",
    issuer: config.issuer ?? "wms-api",
    audience: config.audience ?? "wms-clients"
  };
  return jwt.sign(payload, config.secret, options);
};

export const verifyJwtToken = (token: string, config: JwtConfig): JwtPayload => {
  try {
    const decoded = jwt.verify(token, config.secret, {
      issuer: config.issuer ?? "wms-api",
      audience: config.audience ?? "wms-clients"
    });
    if (typeof decoded === "string") {
      throw new WmsError("WMS-AUTH-001", "Token invalido.");
    }
    return decoded as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new WmsError("WMS-AUTH-001", "Token expirado.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new WmsError("WMS-AUTH-001", "Token invalido ou malformado.");
    }
    throw new WmsError("WMS-AUTH-001", "Falha na verificacao do token.");
  }
};

export const extractBearerToken = (authorization: string | undefined): string | undefined => {
  if (!authorization) {
    return undefined;
  }
  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") {
    return undefined;
  }
  return parts[1];
};
