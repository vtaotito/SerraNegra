/** Paleta e utilitários compartilhados para gráficos do BI (tema claro do painel). */

export const CHART_SERIES_PRIMARY = "#AA1A1B";
export const CHART_MUTED = "#78696c";
export const CHART_GRID = "#f0f0f0";

/** Grade / eixos em gráficos que usavam `#e5dfe1` */
export const CHART_AXIS_LINE = "#e5dfe1";

/** Props de `label` em eixos Recharts (nome do eixo) */
export const CHART_AXIS_LABEL_PROPS = { fill: CHART_MUTED, fontSize: 11 } as const;

export const CHART_SERIES_PALETTE = [
  "#AA1A1B",
  "#c42538",
  "#d42b2c",
  "#e94848",
  "#f47474",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#6366f1",
] as const;

/** Ticks responsivos: `sm` ~ mobile, `md` ~ desktop em gráficos largos */
export function chartAxisTick(size: "sm" | "md" = "sm"): { fill: string; fontSize: number } {
  return { fill: CHART_MUTED, fontSize: size === "sm" ? 9 : 11 };
}

export function formatYAxisCompact(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}
