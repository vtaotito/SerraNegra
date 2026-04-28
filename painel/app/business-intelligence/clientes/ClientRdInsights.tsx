"use client";

import { Loader2, Radio } from "lucide-react";
import { fmtDateShort } from "@/lib/format";
import { useRdContactMarketing } from "@/hooks/useCockpitQueries";

/** Bloco opcional RD Marketing no detalhe do cliente (corrige SAP CardCode ↔ email). */
export function ClientRdInsights({ email }: { email: string | null }) {
  const hasEmail = typeof email === "string" && email.includes("@");

  const { data, isLoading, isError, error } = useRdContactMarketing(hasEmail ? email : null);

  if (!hasEmail) {
    return (
      <div className="rounded-xl border border-dashed border-cockpit-border bg-cockpit-bg/40 p-4 text-xs text-cockpit-muted leading-relaxed">
        <strong className="text-gray-800">RD Station (Marketing)</strong> —
        Sem e-mail no cadastro SAP para este cliente. Inclua o e-mail para correlacionar com a base RD (Cliente 360).
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-cockpit-border bg-white px-4 py-3 flex items-center gap-2 text-sm text-cockpit-muted">
        <Loader2 className="w-4 h-4 shrink-0 animate-spin motion-reduce:hidden" aria-hidden />
        Consultando dados do contato RD Station…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/90 px-4 py-3 text-xs text-amber-950">
        {error instanceof Error ? error.message : "Erro ao consultar RD"}
      </div>
    );
  }

  if (!data) return null;

  if (!data.configured) {
    return (
      <div className="rounded-xl border border-cockpit-border bg-cockpit-bg/50 px-4 py-3 text-xs text-gray-700">
        <strong className="text-gray-900">Cliente 360</strong> —
        RD Marketing não configurado no servidor. Defina a variável de ambiente{" "}
        <code className="text-[11px] font-mono bg-white px-1 rounded border border-cockpit-border/80">
          RD_STATION_MARKETING_ACCESS_TOKEN
        </code>
        .
      </div>
    );
  }

  if (!data.found || !data.contact) {
    return (
      <div className="rounded-xl border border-cockpit-border bg-white px-4 py-3 text-sm shadow-sm">
        <div className="flex gap-3">
          <Radio className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cockpit-muted">Cliente 360 — RD Station</p>
            <p className="text-gray-800 mt-1 text-xs">
              Nenhum contato encontrado para <span className="font-mono text-gray-900">{email}</span> na base de leads RD.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const c = data.contact;

  const lastConvShort = fmtDateShort(c.lastConversionDate);

  const cfs = c.cfCustomFields ? Object.entries(c.cfCustomFields).slice(0, 8) : [];

  return (
    <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/40 px-4 py-4 shadow-sm">
      <div className="flex gap-3 mb-3">
        <div className="p-2 rounded-lg bg-purple-600/15 shrink-0">
          <Radio className="w-4 h-4 text-purple-800" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-cockpit-muted">Cliente 360 — RD Station</p>
          <p className="text-base font-semibold text-gray-900 truncate">{c.name ?? "—"}</p>
          <p className="text-[11px] text-purple-900/85 font-mono truncate mt-0.5">{c.email ?? email}</p>
          {c.lifecycle ? (
            <span className="inline-block mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900">
              {c.lifecycle}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-700">
        {c.jobTitle ? (
          <>
            <dt className="text-cockpit-muted font-medium">Cargo</dt>
            <dd>{c.jobTitle}</dd>
          </>
        ) : null}
        {(c.city || c.state) ? (
          <>
            <dt className="text-cockpit-muted font-medium">Local</dt>
            <dd>{[c.city, c.state].filter(Boolean).join(" — ") || "—"}</dd>
          </>
        ) : null}
        <dt className="text-cockpit-muted font-medium">Última conversão</dt>
        <dd>{lastConvShort}</dd>
      </dl>

      {Array.isArray(c.tags) && c.tags.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-cockpit-muted uppercase mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1">
            {c.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-md bg-purple-600/12 text-purple-900 font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {cfs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-purple-100/80">
          <p className="text-[10px] font-semibold text-cockpit-muted uppercase mb-2">Campos personalizados (RD)</p>
          <ul className="space-y-1 text-[11px]">
            {cfs.map(([key, val]) => (
              <li key={key} className="flex justify-between gap-3">
                <span className="text-cockpit-muted shrink-0 font-mono">{key}</span>
                <span className="text-gray-900 text-right break-all">{String(val)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
