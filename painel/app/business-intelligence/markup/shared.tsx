"use client";

// ---------------------------------------------------------------------------
// Componentes compartilhados da sessão MarkUp (lista + detalhe)
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

// ─── Badge de margem ────────────────────────────────────────────────────────

export function MargemBadge({ value, size = "md" }: { value: number | null; size?: "sm" | "md" }) {
  if (value === null || isNaN(value)) return <span className="text-gray-300">&mdash;</span>;
  const pct = (value * 100).toFixed(1);
  const cls =
    value >= 0.15 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
    value >= 0.05 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
    value >= 0 ? "bg-red-50 text-red-600 ring-1 ring-red-200" :
    "bg-red-100 text-red-800 ring-1 ring-red-300";
  const sz = size === "sm" ? "px-1.5 py-0.5 text-[10px] min-w-[44px]" : "px-2 py-0.5 text-[11px] min-w-[52px]";
  return <span className={`inline-flex items-center justify-center rounded-full font-bold ${cls} ${sz}`}>{pct}%</span>;
}

// ─── Input numérico tolerante a decimais em digitação ──────────────────────
//
// Mantém o texto digitado em estado local enquanto o campo está focado,
// permitindo estados intermediários como "1," ou "0". Aceita vírgula ou ponto.

function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === "." ) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatValue(value: number): string {
  if (value === 0) return "";
  // Evita notação científica e ruído de ponto flutuante
  return String(Math.round(value * 10000) / 10000).replace(".", ",");
}

export function NumberField({
  value, onChange, prefix, suffix, dirty, ariaLabel, className,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  /** Campo individual alterado e ainda não salvo */
  dirty?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [text, setText] = useState(() => formatValue(value));
  const [focused, setFocused] = useState(false);

  // Sincroniza com o valor externo quando o campo não está em edição
  useEffect(() => {
    if (!focused) setText(formatValue(value));
  }, [value, focused]);

  return (
    <div className={`flex items-center rounded-md ring-1 motion-safe:transition-all bg-white ${
      dirty ? "ring-amber-400 ring-2" : "ring-gray-200 focus-within:ring-cockpit-accent"
    } ${className ?? ""}`}>
      {prefix && <span className="pl-2 text-[10px] font-semibold text-gray-400">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="0"
        aria-label={ariaLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(formatValue(value));
        }}
        onChange={(e) => {
          const t = e.target.value;
          // Permite apenas dígitos, vírgula, ponto e sinal
          if (!/^-?[\d.,]*$/.test(t)) return;
          setText(t);
          const parsed = parseDecimal(t);
          if (parsed !== null) onChange(parsed);
          else if (t.trim() === "") onChange(0);
        }}
        className="w-full px-2 py-1.5 text-xs font-semibold text-right font-mono bg-transparent focus:outline-none"
      />
      {suffix && <span className="pr-2 text-[10px] text-gray-400">{suffix}</span>}
    </div>
  );
}

// ─── Auditoria ──────────────────────────────────────────────────────────────

export function fmtAudit(updatedAt: string | null, updatedBy: string | null): string | null {
  if (!updatedAt) return null;
  try {
    const d = new Date(updatedAt);
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${date} ${time}${updatedBy ? ` · ${updatedBy}` : ""}`;
  } catch {
    return null;
  }
}
