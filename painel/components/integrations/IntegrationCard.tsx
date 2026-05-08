"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, AlertCircle, XCircle, MinusCircle } from "lucide-react";

export type IntegrationStatus =
  | "ok"
  | "partial"
  | "error"
  | "not_configured"
  | "unknown";

const STATUS_BADGE: Record<
  IntegrationStatus,
  {
    label: string;
    icon: LucideIcon;
    cls: string;
  }
> = {
  ok: {
    label: "Conectado",
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  partial: {
    label: "Atenção",
    icon: AlertCircle,
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  error: {
    label: "Erro",
    icon: XCircle,
    cls: "bg-red-50 text-red-700 border-red-200",
  },
  not_configured: {
    label: "Não configurado",
    icon: MinusCircle,
    cls: "bg-gray-50 text-gray-600 border-gray-200",
  },
  unknown: {
    label: "Verificando…",
    icon: MinusCircle,
    cls: "bg-gray-50 text-gray-500 border-gray-200",
  },
};

interface IntegrationCardProps {
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle: string;
  status: IntegrationStatus;
  /** Lista de chave/valor mostrada como meta-info (ex.: host, port, from). */
  details?: Array<{ label: string; value: string | null; mono?: boolean }>;
  /** Mensagem informativa contextual (verde se ok, vermelho se error, etc.). */
  message?: { kind: "info" | "ok" | "error" | "warn"; text: string } | null;
  /** Slot para ações (botões). */
  actions?: React.ReactNode;
  /** Slot para conteúdo extra abaixo dos detalhes (resultados de testes, etc.). */
  children?: React.ReactNode;
  /** Quando não configurado, mostra essa lista de variáveis de ambiente. */
  envHints?: Array<{ key: string; required?: boolean; note?: string }>;
  /** Span no grid (1 ou 2 colunas em telas grandes). */
  span?: 1 | 2;
}

export function IntegrationCard({
  icon: Icon,
  iconColor = "text-cockpit-accent",
  iconBg = "bg-cockpit-accent/10",
  title,
  subtitle,
  status,
  details,
  message,
  actions,
  children,
  envHints,
  span = 1,
}: IntegrationCardProps) {
  const badge = STATUS_BADGE[status];
  const BadgeIcon = badge.icon;

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${
        span === 2 ? "lg:col-span-2" : ""
      }`}
    >
      <div className="flex items-start gap-3 p-5 border-b border-gray-100 bg-gray-50/40">
        <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">
                {title}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${badge.cls}`}
            >
              <BadgeIcon className="w-3 h-3" aria-hidden />
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {details && details.length > 0 && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {details.map((d) => (
              <div
                key={d.label}
                className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1.5"
              >
                <dt className="text-gray-500">{d.label}</dt>
                <dd
                  className={`text-gray-800 font-medium truncate text-right ${
                    d.mono ? "font-mono text-[11px]" : ""
                  }`}
                  title={d.value ?? "—"}
                >
                  {d.value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
              message.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : message.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : message.kind === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            <span className="leading-relaxed">{message.text}</span>
          </div>
        )}

        {children}

        {status === "not_configured" && envHints && envHints.length > 0 && (
          <details className="rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-3 py-2 text-xs text-gray-600">
            <summary className="cursor-pointer font-medium text-gray-700">
              Como configurar
            </summary>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              {envHints.map((h) => (
                <li key={h.key}>
                  <code className="font-mono text-[11px] bg-white border border-gray-200 px-1 py-0.5 rounded">
                    {h.key}
                  </code>
                  {h.required && (
                    <span className="ml-1.5 text-[10px] font-semibold text-red-600">
                      obrigatório
                    </span>
                  )}
                  {h.note && (
                    <span className="ml-1.5 text-gray-500">— {h.note}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        {actions && (
          <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
        )}
      </div>
    </div>
  );
}
