import { ApiRole } from "../http.js";
import { UserType } from "./jwt.js";

export type PermissionContext = {
  role: ApiRole;
  userType: UserType;
  customerId?: string;
  tenantId?: string;
};

export type ResourcePermission = {
  resource: string;
  allowedRoles: ApiRole[];
  allowedUserTypes: UserType[];
  requireOwnership?: boolean;
};

const resourcePermissions: Record<string, ResourcePermission> = {
  "catalog:items:read": {
    resource: "catalog:items:read",
    allowedRoles: ["operador", "supervisor", "comercial", "admin"],
    allowedUserTypes: ["INTERNAL", "CLIENT"]
  },
  "catalog:items:write": {
    resource: "catalog:items:write",
    allowedRoles: ["comercial", "admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "catalog:warehouses:read": {
    resource: "catalog:warehouses:read",
    allowedRoles: ["operador", "supervisor", "comercial", "admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "catalog:warehouses:write": {
    resource: "catalog:warehouses:write",
    allowedRoles: ["admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "inventory:read": {
    resource: "inventory:read",
    allowedRoles: ["operador", "supervisor", "comercial", "admin"],
    allowedUserTypes: ["INTERNAL", "CLIENT"]
  },
  "inventory:write": {
    resource: "inventory:write",
    allowedRoles: ["supervisor", "admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "orders:read": {
    resource: "orders:read",
    allowedRoles: ["operador", "supervisor", "comercial", "admin"],
    allowedUserTypes: ["INTERNAL", "CLIENT"],
    requireOwnership: true
  },
  "orders:write": {
    resource: "orders:write",
    allowedRoles: ["comercial", "supervisor", "admin"],
    allowedUserTypes: ["INTERNAL", "CLIENT"],
    requireOwnership: true
  },
  "orders:delete": {
    resource: "orders:delete",
    allowedRoles: ["admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "shipments:read": {
    resource: "shipments:read",
    allowedRoles: ["operador", "supervisor", "comercial", "admin"],
    allowedUserTypes: ["INTERNAL", "CLIENT"],
    requireOwnership: true
  },
  "shipments:write": {
    resource: "shipments:write",
    allowedRoles: ["supervisor", "admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "customers:read": {
    resource: "customers:read",
    allowedRoles: ["comercial", "supervisor", "admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "customers:write": {
    resource: "customers:write",
    allowedRoles: ["comercial", "admin"],
    allowedUserTypes: ["INTERNAL"]
  },
  "customers:delete": {
    resource: "customers:delete",
    allowedRoles: ["admin"],
    allowedUserTypes: ["INTERNAL"]
  }
};

export const checkPermission = (
  permission: string,
  ctx: PermissionContext,
  resourceOwnerId?: string
): boolean => {
  const perm = resourcePermissions[permission];
  if (!perm) {
    return false;
  }

  if (ctx.role === "admin" && ctx.userType === "INTERNAL") {
    return true;
  }

  if (!perm.allowedUserTypes.includes(ctx.userType)) {
    return false;
  }

  if (!perm.allowedRoles.includes(ctx.role)) {
    return false;
  }

  if (perm.requireOwnership && ctx.userType === "CLIENT" && resourceOwnerId) {
    return ctx.customerId === resourceOwnerId;
  }

  return true;
};

export const requirePermission = (
  permission: string,
  ctx: PermissionContext,
  resourceOwnerId?: string
): void => {
  if (!checkPermission(permission, ctx, resourceOwnerId)) {
    throw new Error(`Permissao negada: ${permission}`);
  }
};
