"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Clock, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { exportCSV, fmtDateShort, fmtNum } from "@/lib/format";
import {
  fetchCustomerInactivity,
  type CustomerInactivityBucketId,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import { BiChartTooltip } from "@/components/cockpit/ChartTooltip";
import { CHART_AXIS_LINE, chartAxisTick } from "@/lib/chart-theme";

const BUCKET_COLORS: Record<CustomerInactivityBucketId, string> = {
  "0-3": "#059669",
  "3-6": "#65a30d",
  "6-9": "#d97706",
  "9-12": "#ea580c",
  "12+": "#A81C2C",
  never: "#6b7280",
};

const BUCKET_CARD: Record<CustomerInactivityBucketId, { text: string; bg: string; ring: string }> = {
  "0-3": { text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-400" },
  "3-6": { text: "text-lime-700", bg: "bg-lime-50", ring: "ring-lime-400" },
  "6-9": { text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-400" },
  "9-12": { text: "text-orange-700", bg: "bg-orange-50", ring: "ring-orange-400" },
  "12+": { text: "text-cockpit-accent", bg: "bg-red-50", ring: "ring-cockpit-accent" },
  never: { text: "text-gray-600", bg: "bg-gray-100", ring: "ring-gray-400" },
};

function formatInactivityTooltip(_seriesName: string | undefined, value: number): string {
  return `${fmtNum(value)} cliente${value === 1 ? "" : "s"}`;
}

export function ClientInactivityPanel({ salesPerson }: { salesPerson?: number }) {
  const { data, loading, error, refetch } = useFetch(
    () => fetchCustomerInactivity({ salesPerson }),
    [salesPerson]
  );
  const [selected, setSelected] = useState<CustomerInactivityBucketId | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const buckets = data?.buckets ?? [];
  const total = data?.total ?? 0;
  const selectedBucket = buckets.find((b) => b.id === selected) ?? null;

  const chartData = useMemo(
    () =>
      buckets.map((b) => ({
        id: b.id,
        name: b.label,
        Clientes: b.count,
      })),
    [buckets]
  );

  async function handleExport() {
    if (!selectedBucket) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await fetchCustomerInactivity({
        salesPerson,
        bucket: selectedBucket.id,
      });
      const items = result.items ?? [];
      if (items.length === 0) {
        setExportError("Nenhum cliente nesta faixa para exportar.");
        return;
      }
      exportCSV(
        items.map((item) => ({
          Cliente: item.cardName,
          UF: item.state ?? "",
          Cidade: item.city ?? "",
          "Data último pedido": item.lastOrderDate ? fmtDateShort(item.lastOrderDate) : "",
          "E-mail": item.email ?? "",
          Telefone: item.phone ?? "",
        })),
        `clientes-inativos-${selectedBucket.id}-${format(new Date(), "yyyy-MM-dd")}`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Falha ao exportar CSV");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider">
            Volumetria por inatividade
          </h3>
          <p className="text-xs text-cockpit-muted mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Baseado no último pedido real (histórico completo), independente do período da página.
            {salesPerson != null && (
              <span className="text-cockpit-border">· carteira do vendedor selecionado</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={!selectedBucket || selectedBucket.count === 0 || exporting}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-cockpit-border text-gray-600 hover:bg-black/5 motion-safe:transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Download className="w-4 h-4" aria-hidden />
          )}
          {exporting ? "Exportando…" : "Exportar CSV"}
        </button>
      </div>

      {selectedBucket && (
        <p className="text-xs text-gray-600">
          Faixa selecionada: <strong className="text-gray-900">{selectedBucket.label}</strong>
          {" · "}
          {fmtNum(selectedBucket.count)} cliente{selectedBucket.count === 1 ? "" : "s"}
          {selectedBucket.count > 0 ? " — clique em Exportar CSV para baixar nome, UF, cidade, último pedido, e-mail e telefone." : "."}
        </p>
      )}
      {exportError && (
        <p className="text-xs text-cockpit-accent" role="alert">{exportError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {buckets.map((bucket) => {
          const style = BUCKET_CARD[bucket.id];
          const pct = total > 0 ? (bucket.count / total) * 100 : 0;
          const isSelected = selected === bucket.id;
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => {
                setSelected(bucket.id);
                setExportError(null);
              }}
              className={`text-left rounded-xl border p-4 motion-safe:transition-all ${style.bg} ${
                isSelected
                  ? `border-transparent ring-2 ${style.ring}`
                  : "border-cockpit-border hover:border-cockpit-accent/30"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cockpit-muted block">
                {bucket.label}
              </span>
              <span className={`text-2xl font-bold ${style.text} block mt-1`}>{fmtNum(bucket.count)}</span>
              <span className="text-[11px] text-cockpit-muted">{pct.toFixed(1)}% da carteira</span>
            </button>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-cockpit-muted uppercase tracking-wider mb-3">
          Distribuição — {fmtNum(total)} clientes
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS_LINE} vertical={false} />
              <XAxis dataKey="name" tick={chartAxisTick("sm")} axisLine={{ stroke: CHART_AXIS_LINE }} interval={0} />
              <YAxis
                allowDecimals={false}
                tick={chartAxisTick("md")}
                axisLine={{ stroke: CHART_AXIS_LINE }}
              />
              <Tooltip content={<BiChartTooltip variant="cockpit" formatValue={formatInactivityTooltip} />} />
              <Bar dataKey="Clientes" name="Clientes" radius={[4, 4, 0, 0]} barSize={36}>
                {chartData.map((row) => (
                  <Cell
                    key={row.id}
                    fill={BUCKET_COLORS[row.id as CustomerInactivityBucketId]}
                    opacity={!selected || selected === row.id ? 1 : 0.35}
                    cursor="pointer"
                    onClick={() => {
                      setSelected(row.id as CustomerInactivityBucketId);
                      setExportError(null);
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
