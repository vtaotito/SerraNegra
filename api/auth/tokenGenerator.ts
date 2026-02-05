import { createJwtToken, JwtConfig, JwtPayload } from "./jwt.js";
import { ApiRole } from "../http.js";

export type GenerateTokenInput = {
  userId: string;
  role: ApiRole;
  userType: "INTERNAL" | "CLIENT";
  displayName?: string;
  customerId?: string;
  tenantId?: string;
};

export const generateAccessToken = (input: GenerateTokenInput, config: JwtConfig): string => {
  const payload: Omit<JwtPayload, "iat" | "exp"> = {
    sub: input.userId,
    userId: input.userId,
    role: input.role,
    userType: input.userType,
    displayName: input.displayName,
    customerId: input.customerId,
    tenantId: input.tenantId
  };
  return createJwtToken(payload, config);
};

// Exemplo de uso:
export const exampleTokenGeneration = () => {
  const config: JwtConfig = {
    secret: process.env.JWT_SECRET ?? "your-secret-key-here",
    expiresIn: "8h",
    issuer: "wms-api",
    audience: "wms-clients"
  };

  // Token para usuário interno (operador)
  const operadorToken = generateAccessToken(
    {
      userId: "usr_123",
      role: "operador",
      userType: "INTERNAL",
      displayName: "João Silva",
      tenantId: "tenant_abc"
    },
    config
  );

  // Token para usuário interno (supervisor)
  const supervisorToken = generateAccessToken(
    {
      userId: "usr_456",
      role: "supervisor",
      userType: "INTERNAL",
      displayName: "Maria Santos",
      tenantId: "tenant_abc"
    },
    config
  );

  // Token para cliente externo
  const clientToken = generateAccessToken(
    {
      userId: "client_789",
      role: "comercial",
      userType: "CLIENT",
      displayName: "Empresa XYZ",
      customerId: "C00001",
      tenantId: "tenant_abc"
    },
    config
  );

  return {
    operadorToken,
    supervisorToken,
    clientToken
  };
};
