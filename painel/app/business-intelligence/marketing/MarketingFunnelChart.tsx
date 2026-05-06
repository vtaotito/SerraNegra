"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fmtNum } from "@/lib/format";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import { CHART_AXIS_LINE, CHART_MUTED, chartAxisTick } from "@/lib/chart-theme";

export type MarketingFunnelChartRow = {
  name: string;
  abertos: number;
  etapas: number;
};

export function MarketingFunnelChart({ rows }: { rows: MarketingFunnelChartRow[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 24, top: 8, bottom: 8 }}>
          <title>Negociações em aberto por funil RD</title>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} horizontal={false} />
          <XAxis
            type="number"
            tick={{ ...chartAxisTick("sm"), fontSize: 10 }}
            stroke={CHART_MUTED}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ ...chartAxisTick("sm"), fontSize: 9 }}
            stroke={CHART_MUTED}
          />
          <Tooltip
            content={<BiChartTooltip variant="cockpit" formatValue={(_, v) => fmtNum(Number(v))} />}
          />
          <Bar dataKey="abertos" name="Em aberto" fill="#7c3aed" radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
