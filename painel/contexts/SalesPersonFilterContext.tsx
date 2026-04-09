"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { useFetch } from "@/hooks/useFetch";
import { fetchSalesPersons } from "@/lib/cockpit-api";

interface SalesPersonFilterValue {
  salesPersonCode: number | undefined;
  isComercial: boolean;
  ready: boolean;
}

const SalesPersonFilterContext = createContext<SalesPersonFilterValue>({
  salesPersonCode: undefined,
  isComercial: false,
  ready: true,
});

export function SalesPersonFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isComercial = user?.role === "comercial";

  const { data: spData, loading: spLoading } = useFetch(
    () => fetchSalesPersons(),
    [],
  );

  const salesPersonCode = useMemo(() => {
    if (!isComercial || !user || !spData?.items?.length) return undefined;
    const target = user.displayName.trim().toLowerCase();
    const match = spData.items.find(
      (sp) => sp.SalesEmployeeName.trim().toLowerCase() === target,
    );
    return match?.SalesEmployeeCode;
  }, [isComercial, user, spData]);

  const ready = !isComercial || !spLoading;

  return (
    <SalesPersonFilterContext.Provider value={{ salesPersonCode, isComercial, ready }}>
      {children}
    </SalesPersonFilterContext.Provider>
  );
}

export function useSalesPersonFilter() {
  return useContext(SalesPersonFilterContext);
}
