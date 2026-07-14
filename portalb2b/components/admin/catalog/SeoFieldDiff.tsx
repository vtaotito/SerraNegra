"use client";

import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SeoFieldDiffProps {
  label: string;
  current: string;
  suggested: string;
  applied: boolean;
  onApply: () => void;
}

/**
 * Linha de revisão de um campo de SEO: compara "Atual" vs "Sugerido" e permite
 * aplicar apenas aquele campo. "applied" marca visualmente quando o usuário já
 * aplicou a sugestão (o valor foi copiado para o input do formulário).
 */
export function SeoFieldDiff({ label, current, suggested, applied, onApply }: SeoFieldDiffProps) {
  const unchanged = current.trim() === suggested.trim();
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={applied || unchanged}
          onClick={onApply}
          className={cn(
            "h-7 gap-1 text-xs",
            applied
              ? "text-emerald-400"
              : "text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200",
          )}
        >
          {applied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Aplicado
            </>
          ) : (
            <>
              <ArrowRight className="h-3.5 w-3.5" /> Aplicar
            </>
          )}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-slate-700/60 bg-slate-900/60 p-2">
          <p className="mb-1 text-[10px] uppercase text-slate-500">Atual</p>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-400">
            {current.trim() || <span className="italic text-slate-600">vazio</span>}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
          <p className="mb-1 text-[10px] uppercase text-emerald-500/80">Sugerido</p>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-100">
            {suggested.trim() || <span className="italic text-slate-600">vazio</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
