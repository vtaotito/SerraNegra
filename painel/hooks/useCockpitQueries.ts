"use client";

import { useQuery } from "@tanstack/react-query";
import type { ExecutiveSummary } from "@/lib/bi/executive-aggregate";

export function useExecutiveSummary(params: {
  dateFrom: string;
  dateTo: string;
  prevFrom: string;
  prevTo: string;
  salesPersonCode: number | null | undefined;
}) {
  const { dateFrom, dateTo, prevFrom, prevTo, salesPersonCode } = params;
  const q = new URLSearchParams({ dateFrom, dateTo, prevFrom, prevTo });
  if (salesPersonCode != null) q.set("salesPerson", String(salesPersonCode));

  return useQuery({
    queryKey: ["bi", "executive", dateFrom, dateTo, prevFrom, prevTo, salesPersonCode ?? null],
    queryFn: async (): Promise<ExecutiveSummary> => {
      const res = await fetch(`/api/bi/executive-summary?${q}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : `Erro ${res.status}`);
      }
      return res.json();
    },
    staleTime: 60_000,
    retry: 2,
  });
}
