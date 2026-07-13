"use client";

import { cn } from "@/lib/utils";

export interface AttributeOption {
  value: string;
  label: string;
  /** A opção existe (há alguma variante) para a seleção atual. */
  available: boolean;
  /** Há estoque nessa opção (bolinha verde/vermelha). */
  inStock: boolean;
}

interface AttributeSelectorProps {
  label: string;
  options: AttributeOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  className?: string;
}

/**
 * Grupo de pílulas reutilizável para escolher um atributo (cor, fechamento ou
 * embalagem). Segue o estilo do seletor de embalagem do catálogo: borda em
 * `--gsn-brand` quando selecionada, bolinha de estoque e `opacity-60`/desabilita
 * quando a opção não existe para a combinação atual.
 */
export function AttributeSelector({
  label,
  options,
  selected,
  onSelect,
  className,
}: AttributeSelectorProps) {
  if (options.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => opt.available && onSelect(opt.value)}
              disabled={!opt.available}
              aria-pressed={isSelected}
              title={`${opt.label}${opt.available ? (opt.inStock ? "" : " · sem estoque") : " · indisponível"}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                isSelected
                  ? "border-[var(--gsn-brand)] bg-[var(--gsn-brand)]/10 text-[var(--gsn-brand)]"
                  : "border-border bg-white text-muted-foreground hover:border-foreground/30",
                !opt.available && "opacity-40 cursor-not-allowed",
                opt.available && !opt.inStock && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  opt.inStock ? "bg-emerald-500" : "bg-red-400",
                )}
              />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
