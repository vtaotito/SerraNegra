export type UserRole = "admin" | "supervisor" | "operador" | "comercial" | "viewer";

export type PanelModule = "wms" | "cockpit" | "b2b";

export interface PanelUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl: string | null;
  allowedModules: PanelModule[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPayload {
  sub: string;
  username: string;
  role: UserRole;
  displayName: string;
  modules: PanelModule[];
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  operador: "Operador",
  comercial: "Comercial",
  viewer: "Visualizador",
};

export const MODULE_LABELS: Record<PanelModule, string> = {
  wms: "WMS / OMS",
  cockpit: "Cockpit BI",
  b2b: "Portal B2B",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  supervisor: 80,
  comercial: 60,
  operador: 40,
  viewer: 20,
};
