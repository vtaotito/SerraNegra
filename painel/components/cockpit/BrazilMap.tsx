"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { fmtBRL, fmtNum, STATE_TO_REGION } from "@/lib/format";
import { BRAZIL_VIEWBOX, BRAZIL_STATE_PATHS } from "@/lib/geo/brazil-states";

const UF_NAME: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export interface BrazilStateDatum {
  state: string;
  fat: number;
  count: number;
  pedidos?: number;
}

export type BrazilMapMetric = "fat" | "count";

interface BrazilMapProps {
  data: BrazilStateDatum[];
  metric: BrazilMapMetric;
  /** UF atualmente selecionado (controlled). */
  selectedState?: string | null;
  onStateClick?: (uf: string | null) => void;
  /** Mostrar marcador do estado (sigla) sobre cada path. */
  showLabels?: boolean;
  className?: string;
}

/**
 * Heatmap sequencial (branco → cor accent do cockpit).
 * Usa potência 0.45 para realçar valores intermediários.
 */
function heatColor(value: number, max: number): string {
  if (!max || value <= 0) return "#f3f4f6";
  const t = Math.pow(Math.min(value / max, 1), 0.45);
  const r = Math.round(243 + (168 - 243) * t);
  const g = Math.round(244 + (28 - 244) * t);
  const b = Math.round(246 + (44 - 246) * t);
  return `rgb(${r},${g},${b})`;
}

function isDarkFill(value: number, max: number): boolean {
  return max > 0 && value / max > 0.5;
}

export function BrazilMap({
  data,
  metric,
  selectedState = null,
  onStateClick,
  showLabels = true,
  className = "",
}: BrazilMapProps) {
  const [hoverUF, setHoverUF] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const dataMap = useMemo(
    () => new Map(data.map((d) => [d.state, d])),
    [data],
  );

  const maxValue = useMemo(() => {
    let m = 0;
    for (const d of data) {
      const v = metric === "fat" ? d.fat : d.count;
      if (v > m) m = v;
    }
    return m;
  }, [data, metric]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, uf: string) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (hoverUF !== uf) setHoverUF(uf);
    },
    [hoverUF],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverUF(null);
    setTooltipPos(null);
  }, []);

  const handleClick = useCallback(
    (uf: string) => {
      if (!onStateClick) return;
      const datum = dataMap.get(uf);
      if (!datum || datum.count === 0) return;
      onStateClick(uf === selectedState ? null : uf);
    },
    [onStateClick, selectedState, dataMap],
  );

  const hoverDatum = hoverUF ? dataMap.get(hoverUF) : null;

  const ufs = Object.keys(BRAZIL_STATE_PATHS);

  // Bounding box para posicionar o label de UF (sigla) — derivado do path do estado.
  // Como os paths são complexos, usamos um Map estático de centróides aproximados.
  const STATE_CENTROIDS: Record<string, { x: number; y: number }> = {
    AC: { x: 35, y: 130 },
    AL: { x: 337, y: 132 },
    AP: { x: 197, y: 36 },
    AM: { x: 90, y: 80 },
    BA: { x: 287, y: 165 },
    CE: { x: 312, y: 91 },
    DF: { x: 239, y: 188 },
    ES: { x: 302, y: 222 },
    GO: { x: 222, y: 192 },
    MA: { x: 245, y: 105 },
    MT: { x: 175, y: 175 },
    MS: { x: 198, y: 235 },
    MG: { x: 263, y: 218 },
    PA: { x: 180, y: 90 },
    PB: { x: 332, y: 116 },
    PR: { x: 222, y: 282 },
    PE: { x: 320, y: 122 },
    PI: { x: 280, y: 115 },
    RJ: { x: 287, y: 247 },
    RN: { x: 333, y: 105 },
    RS: { x: 197, y: 322 },
    RO: { x: 110, y: 150 },
    RR: { x: 113, y: 35 },
    SC: { x: 222, y: 305 },
    SP: { x: 245, y: 250 },
    SE: { x: 326, y: 144 },
    TO: { x: 230, y: 145 },
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        viewBox={BRAZIL_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Mapa do Brasil — distribuição por estado"
        className="w-full h-auto select-none"
      >
        <defs>
          <filter id="brazil-state-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.2"
              floodColor="#A81C2C"
              floodOpacity="0.45"
            />
          </filter>
        </defs>

        <g>
          {ufs.map((uf) => {
            const d = BRAZIL_STATE_PATHS[uf];
            const datum = dataMap.get(uf);
            const value = datum ? (metric === "fat" ? datum.fat : datum.count) : 0;
            const hasData = !!datum && datum.count > 0;
            const isHover = hoverUF === uf;
            const isSelected = selectedState === uf;
            const fill = hasData ? heatColor(value, maxValue) : "#f3f4f6";
            const stroke = isSelected
              ? "#A81C2C"
              : isHover
              ? "#A81C2C"
              : "#ffffff";
            const strokeWidth = isSelected ? 1.6 : isHover ? 1.4 : 0.6;

            return (
              <path
                key={uf}
                d={d}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  filter: isSelected ? "url(#brazil-state-shadow)" : undefined,
                  cursor: hasData && onStateClick ? "pointer" : "default",
                  transition: "fill 150ms ease, stroke 150ms ease, stroke-width 150ms ease",
                  outline: "none",
                }}
                tabIndex={hasData ? 0 : -1}
                role={hasData ? "button" : undefined}
                aria-label={
                  hasData
                    ? `${UF_NAME[uf]}: ${datum.count} cliente${datum.count !== 1 ? "s" : ""}, ${fmtBRL(datum.fat)}`
                    : `${UF_NAME[uf]}: sem clientes`
                }
                aria-pressed={isSelected ? true : undefined}
                onMouseEnter={(e) => handleMouseMove(e, uf)}
                onMouseMove={(e) => handleMouseMove(e, uf)}
                onClick={() => handleClick(uf)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(uf);
                  }
                }}
              />
            );
          })}
        </g>

        {showLabels && (
          <g pointerEvents="none">
            {ufs.map((uf) => {
              const datum = dataMap.get(uf);
              const value = datum ? (metric === "fat" ? datum.fat : datum.count) : 0;
              const hasData = !!datum && datum.count > 0;
              const c = STATE_CENTROIDS[uf];
              if (!c) return null;
              const dark = hasData && isDarkFill(value, maxValue);
              return (
                <text
                  key={`lbl-${uf}`}
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  fontSize={hasData ? 6.5 : 5.5}
                  fontWeight={hasData ? 700 : 500}
                  fill={dark ? "#ffffff" : hasData ? "#374151" : "#9ca3af"}
                  style={{
                    paintOrder: "stroke",
                    stroke: dark ? "rgba(168,28,44,0.5)" : "rgba(255,255,255,0.7)",
                    strokeWidth: 0.6,
                  }}
                >
                  {uf}
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {/* Tooltip flutuante */}
      {hoverUF && tooltipPos && (
        <div
          role="tooltip"
          aria-live="polite"
          className="pointer-events-none absolute z-20 rounded-lg bg-white shadow-xl shadow-black/15 ring-1 ring-cockpit-border px-3 py-2 text-xs min-w-[180px]"
          style={{
            left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth ?? 0) - 200),
            top: Math.max(tooltipPos.y - 60, 8),
          }}
        >
          <div className="flex items-baseline justify-between gap-2 border-b border-cockpit-border/50 pb-1.5 mb-1.5">
            <span className="font-bold text-gray-900">{UF_NAME[hoverUF]}</span>
            <span className="text-[10px] font-mono text-cockpit-muted">{hoverUF}</span>
          </div>
          {hoverDatum && hoverDatum.count > 0 ? (
            <div className="space-y-1 tabular-nums">
              <div className="flex items-center justify-between gap-3">
                <span className="text-cockpit-muted">Clientes</span>
                <span className="font-semibold text-cockpit-accent">
                  {fmtNum(hoverDatum.count)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-cockpit-muted">Faturamento</span>
                <span className="font-semibold text-emerald-600">
                  {fmtBRL(hoverDatum.fat)}
                </span>
              </div>
              {typeof hoverDatum.pedidos === "number" && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-cockpit-muted">Pedidos</span>
                  <span className="font-semibold text-sky-600">
                    {fmtNum(hoverDatum.pedidos)}
                  </span>
                </div>
              )}
              <div className="text-[10px] text-cockpit-muted pt-1 border-t border-cockpit-border/40 mt-1">
                Região: {STATE_TO_REGION[hoverUF] ?? "—"}
              </div>
            </div>
          ) : (
            <div className="text-cockpit-muted italic">Sem clientes no período</div>
          )}
        </div>
      )}
    </div>
  );
}
