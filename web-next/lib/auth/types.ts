export interface AuthUser {
  id: string;
  name: string;
  role: "ADMIN" | "SUPERVISOR" | "OPERADOR";
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const SESSION_COOKIE = "wms-session";
