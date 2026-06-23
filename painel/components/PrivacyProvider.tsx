"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const STORAGE_KEY = "gsn-privacy-mode";
const BODY_CLASS = "privacy-mode";

interface PrivacyContextValue {
  /** Quando true, números e valores ficam mascarados (blur) em todo o painel. */
  enabled: boolean;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Carrega preferência salva no primeiro render no cliente
  useEffect(() => {
    try {
      setEnabledState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ambiente sem localStorage */
    }
    setHydrated(true);
  }, []);

  // Reflete o estado na classe do <body> e persiste
  useEffect(() => {
    if (!hydrated) return;
    const body = document.body;
    if (enabled) body.classList.add(BODY_CLASS);
    else body.classList.remove(BODY_CLASS);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [enabled, hydrated]);

  // Atalho de teclado: Shift+H alterna o modo privacidade
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        (e.key === "H" || e.key === "h") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable)
          return;
        e.preventDefault();
        setEnabledState((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = useCallback(() => setEnabledState((v) => !v), []);
  const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);

  return (
    <PrivacyContext.Provider value={{ enabled, toggle, setEnabled }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    // Fallback inerte caso o provider não esteja montado (ex.: testes)
    return { enabled: false, toggle: () => {}, setEnabled: () => {} };
  }
  return ctx;
}
