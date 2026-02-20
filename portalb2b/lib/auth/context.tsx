"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { post, get } from "@/lib/api/client";

interface Customer {
  cardCode: string;
  cardName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
}

interface AuthState {
  customer: Customer | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (cardCode: string, password?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    customer: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const token = localStorage.getItem("b2b_token");
    const stored = localStorage.getItem("b2b_customer");
    if (token && stored) {
      try {
        const customer = JSON.parse(stored);
        setState({ customer, token, isLoading: false, isAuthenticated: true });
      } catch {
        localStorage.removeItem("b2b_token");
        localStorage.removeItem("b2b_customer");
        setState((s) => ({ ...s, isLoading: false }));
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (cardCode: string, password?: string) => {
    const res = await post<{ token: string; customer: Customer }>("/b2b/auth/login", {
      cardCode,
      password,
    });
    localStorage.setItem("b2b_token", res.token);
    localStorage.setItem("b2b_customer", JSON.stringify(res.customer));
    setState({
      customer: res.customer,
      token: res.token,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("b2b_token");
    localStorage.removeItem("b2b_customer");
    setState({ customer: null, token: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
