"use client";

import { useQuery } from "@tanstack/react-query";
import type { ExecutiveSummary } from "@/lib/bi/executive-aggregate";
import type { RdContactResponse, RdOverviewResponse } from "@/lib/rd-bi-types";

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

/** Marketing & CRM — funis RD + liga opcional ao período BI (SAP). */
export function useRdOverviewBi(params: {
  dateFrom: string;
  dateTo: string;
  salesPersonCode: number | null | undefined;
}) {
  const { dateFrom, dateTo, salesPersonCode } = params;
  const q = new URLSearchParams({ dateFrom, dateTo });
  if (salesPersonCode != null) q.set("salesPerson", String(salesPersonCode));

  return useQuery({
    queryKey: ["bi", "rd-overview", dateFrom, dateTo, salesPersonCode ?? null],
    queryFn: async (): Promise<RdOverviewResponse> => {
      const res = await fetch(`/api/bi/rd/overview?${q}`);
      const j = (await res.json()) as RdOverviewResponse & { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : `Erro ${res.status}`);
      return j as RdOverviewResponse;
    },
    staleTime: 90_000,
    retry: 1,
  });
}

/** Contato RD Marketing por e-mail (Cliente 360). */
export function useRdContactMarketing(email: string | null | undefined) {
  const normalized =
    typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;

  return useQuery({
    queryKey: ["bi", "rd-contact", normalized],
    queryFn: async (): Promise<RdContactResponse> => {
      const res = await fetch(`/api/bi/rd/contact?email=${encodeURIComponent(normalized!)}`);
      const j = (await res.json()) as RdContactResponse;
      if (!res.ok && typeof j.error === "string") throw new Error(j.error);
      return j;
    },
    enabled: normalized != null,
    staleTime: 120_000,
    retry: 1,
  });
}
