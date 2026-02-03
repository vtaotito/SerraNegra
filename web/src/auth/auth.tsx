import { createContext, useContext } from "react";

export type Role = "LOGISTICA" | "COMERCIAL" | "ADMIN";

export type Permission =
  | "order.wave.release"
  | "order.reprocess"
  | "order.event.send";

export type User = {
  id: string;
  name: string;
  role: Role;
};

export type AuthState = {
  user: User;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthContext.Provider");
  }
  return ctx;
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  LOGISTICA: ["order.event.send", "order.wave.release"],
  COMERCIAL: ["order.reprocess"],
  ADMIN: ["order.event.send", "order.wave.release", "order.reprocess"]
};

export function hasPermission(role: Role, perm: Permission) {
  return ROLE_PERMISSIONS[role].includes(perm);
}

