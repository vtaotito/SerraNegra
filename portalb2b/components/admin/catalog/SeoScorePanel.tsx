"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, AlertCircle, Info } from "lucide-react";
import {
  computeSeoScoreLocal,
  scoreColor,
  gradeColor,
  type SeoScoreInput,
  type SeoCheck,
} from "@/lib/admin/seo";
import { cn } from "@/lib/utils";

interface SeoScorePanelProps {
  input: SeoScoreInput;
  /** Quando false, começa recolhido (só o resumo). */
  defaultOpen?: boolean;
}

function SeverityIcon({ check }: { check: SeoCheck }) {
  if (check.ok) return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />;
  if (check.severity === "critical") return <XCircle className="h-4 w-4 flex-shrink-0 text-rose-400" />;
  if (check.severity === "warning")
    return <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />;
  return <Info className="h-4 w-4 flex-shrink-0 text-slate-400" />;
}

/** Painel de qualidade de SEO: gauge do score + checklist acionável. */
export function SeoScorePanel({ input, defaultOpen = false }: SeoScorePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const result = useMemo(() => computeSeoScoreLocal(input), [input]);
  const passed = result.checks.filter((c) => c.ok).length;

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 flex-col items-center justify-center rounded-lg border text-center",
              gradeColor(result.grade),
            )}
          >
            <span className="text-base font-bold leading-none">{result.grade}</span>
            <span className="text-[9px] leading-none opacity-80">nota</span>
          </div>
          <div className="text-left">
            <p className={cn("text-2xl font-bold leading-none", scoreColor(result.score))}>
              {result.score}
              <span className="text-sm text-slate-500">/100</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Qualidade de SEO · {passed}/{result.checks.length} itens OK
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Barra de progresso */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            result.score >= 75
              ? "bg-emerald-500"
              : result.score >= 55
                ? "bg-amber-500"
                : result.score >= 35
                  ? "bg-orange-500"
                  : "bg-rose-500",
          )}
          style={{ width: `${result.score}%` }}
        />
      </div>

      {open && (
        <ul className="mt-3 space-y-1.5">
          {result.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              <SeverityIcon check={c} />
              <div className="min-w-0">
                <span className={cn("font-medium", c.ok ? "text-slate-300" : "text-slate-200")}>
                  {c.label}
                </span>
                <span className="text-slate-500"> — {c.hint}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
