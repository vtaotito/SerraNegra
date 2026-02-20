"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface AdminState {
  user: string | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AdminContextType extends AdminState {
  setAdmin: (token: string, user: string) => void;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const token = localStorage.getItem("b2b_admin_token");
    const user = localStorage.getItem("b2b_admin_user");
    if (token && user) {
      setState({ user, token, isLoading: false, isAuthenticated: true });
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const setAdmin = useCallback((token: string, user: string) => {
    localStorage.setItem("b2b_admin_token", token);
    localStorage.setItem("b2b_admin_user", user);
    setState({ user, token, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("b2b_admin_token");
    localStorage.removeItem("b2b_admin_user");
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AdminContext.Provider value={{ ...state, setAdmin, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
