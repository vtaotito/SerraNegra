"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  type B2BCustomer,
  authLogin,
  fetchMe,
  setToken,
  getToken,
  clearToken,
} from "@/lib/b2b-api";

interface B2BAuthContextType {
  customer: B2BCustomer | null;
  token: string | null;
  loading: boolean;
  login: (cnpj: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  setSession: (token: string, customer: B2BCustomer) => void;
}

const B2BAuthContext = createContext<B2BAuthContextType | null>(null);

const PUBLIC_PORTAL_PATHS = ["/portal/login"];

export function B2BAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<B2BCustomer | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkSession = useCallback(async () => {
    const stored = getToken();
    if (!stored) {
      setCustomer(null);
      setTokenState(null);
      setLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setCustomer(me);
      setTokenState(stored);
    } catch {
      clearToken();
      setCustomer(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!loading && !customer && !PUBLIC_PORTAL_PATHS.some((p) => pathname.startsWith(p))) {
      if (pathname.startsWith("/portal")) {
        router.replace("/portal/login");
      }
    }
  }, [loading, customer, pathname, router]);

  const login = useCallback(
    async (cnpj: string, password: string) => {
      const res = await authLogin(cnpj, password);
      setToken(res.token);
      setTokenState(res.token);
      setCustomer(res.customer);
      router.replace("/portal");
    },
    [router],
  );

  const logout = useCallback(() => {
    clearToken();
    setCustomer(null);
    setTokenState(null);
    router.replace("/portal/login");
  }, [router]);

  const refreshMe = useCallback(async () => {
    try {
      const me = await fetchMe();
      setCustomer(me);
    } catch {
      logout();
    }
  }, [logout]);

  const setSession = useCallback(
    (tok: string, cust: B2BCustomer) => {
      setToken(tok);
      setTokenState(tok);
      setCustomer(cust);
      router.replace("/portal");
    },
    [router],
  );

  return (
    <B2BAuthContext.Provider
      value={{ customer, token: tokenState, loading, login, logout, refreshMe, setSession }}
    >
      {children}
    </B2BAuthContext.Provider>
  );
}

export function useB2BAuth() {
  const ctx = useContext(B2BAuthContext);
  if (!ctx) throw new Error("useB2BAuth deve ser usado dentro de B2BAuthProvider");
  return ctx;
}
