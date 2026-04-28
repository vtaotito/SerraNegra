"use client";

import { memo } from "react";
import { fmtBRL, fmtNum } from "@/lib/format";

export type BiTooltipPayloadEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

export interface BiChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: BiTooltipPayloadEntry[];
  formatValue?: (seriesName: string | undefined, value: number) => string;
  /** `cockpit` = borda/tema alinhados ao BI do painel */
  variant?: "default" | "cockpit";
}

function defaultFormat(seriesName: string | undefined, value: number): string {
  if (seriesName === "Pedidos" || seriesName === "Qtd") return fmtNum(value);
  return fmtBRL(value);
}

/** Caixa visual alinhada ao variant `cockpit` de `BiChartTooltip` (tooltips com conteúdo custom). */
export function CockpitTooltipFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white/95 backdrop-blur-sm border border-cockpit-border rounded-lg shadow-lg px-3 py-2.5 text-xs max-w-[min(100vw-2rem,320px)]"
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export const BiChartTooltip = memo(function BiChartTooltip({
  active,
  payload,
  label,
  formatValue = defaultFormat,
  variant = "default",
}: BiChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const box =
    variant === "cockpit"
      ? "bg-white/95 backdrop-blur-sm border border-cockpit-border rounded-lg shadow-lg px-3 py-2.5 text-xs max-w-[min(100vw-2rem,320px)]"
      : "bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs max-w-[min(100vw-2rem,280px)]";
  return (
    <div className={box} role="status" aria-live="polite">
      {label != null && label !== "" && (
        <p className="font-semibold text-gray-900 mb-1">{label}</p>
      )}
      {payload.map((p, i) => (
        <p key={`${String(p.dataKey ?? p.name)}-${i}`} className="text-gray-600">
          {p.name}:{" "}
          <span className="font-medium text-gray-900">
            {formatValue(p.name, Number(p.value))}
          </span>
        </p>
      ))}
    </div>
  );
});
