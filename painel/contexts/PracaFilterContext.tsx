"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { matchesPraca, type Praca } from "@/lib/format";

const STORAGE_KEY = "bi-praca-filter";

export interface PracaFilterContextValue {
  praca: Praca;
  setPraca: (praca: Praca) => void;
  /** true quando o depósito pertence à praça selecionada. */
  matches: (warehouseCode: string | null | undefined) => boolean;
}

const PracaFilterContext = createContext<PracaFilterContextValue | null>(null);

function isPraca(v: unknown): v is Praca {
  return v === "todas" || v === "sp" || v === "bh";
}

export function PracaFilterProvider({ children }: { children: ReactNode }) {
  const [praca, setPracaState] = useState<Praca>("todas");

  // Restaura a última seleção (persistência leve entre navegações/sessões).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isPraca(stored)) setPracaState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setPraca = useCallback((next: Praca) => {
    setPracaState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const matches = useCallback(
    (warehouseCode: string | null | undefined) =>
      matchesPraca(warehouseCode, praca),
    [praca],
  );

  const value = useMemo<PracaFilterContextValue>(
    () => ({ praca, setPraca, matches }),
    [praca, setPraca, matches],
  );

  return (
    <PracaFilterContext.Provider value={value}>
      {children}
    </PracaFilterContext.Provider>
  );
}

export function usePracaFilter(): PracaFilterContextValue {
  const ctx = useContext(PracaFilterContext);
  if (!ctx)
    throw new Error("usePracaFilter must be used inside PracaFilterProvider");
  return ctx;
}
