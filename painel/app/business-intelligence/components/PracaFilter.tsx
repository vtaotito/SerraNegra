"use client";

import { MapPin } from "lucide-react";
import { usePracaFilter } from "@/contexts/PracaFilterContext";
import { PRACA_LABELS, type Praca } from "@/lib/format";

const OPTIONS: Praca[] = ["todas", "sp", "bh"];

export function PracaFilter() {
  const { praca, setPraca } = usePracaFilter();

  return (
    <div
      role="radiogroup"
      aria-label="Filtrar por praça"
      className="inline-flex items-center gap-1 rounded-xl border border-cockpit-border bg-cockpit-bg p-1"
    >
      <span className="pl-1.5 pr-0.5 text-cockpit-muted" aria-hidden>
        <MapPin className="w-3.5 h-3.5" />
      </span>
      {OPTIONS.map((opt) => {
        const active = praca === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPraca(opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cockpit-accent ${
              active
                ? "bg-white text-cockpit-accent shadow-sm"
                : "text-cockpit-muted hover:text-gray-700"
            }`}
          >
            {PRACA_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}
