"use client";

/* ═══════════════════════════════════════════════════════════════
 * Produção — previsão semanal de embalagens a produzir
 *
 * Janela: últimos 28 dias (média semanal = total / 4).
 * Regra A: produzir = ceil(max(0, média − estoque) / undPorEmbalagem).
 * Embalagem: FARDO → CAIXA → maior multiunidade.
 * ═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Factory,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  PackageX,
} from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import {
  fetchProductAnalytics,
  fetchInventory,
  type InventoryRow,
} from "@/lib/cockpit-api";
import {
  buildProducaoRows,
  PRODUCAO_STATUS_META,
  type ProducaoRow,
  type ProducaoStatus,
} from "@/lib/producao-engine";
import { COMPRAS_GROUP_ORDER } from "@/lib/compras-engine";
import { fmtNum, exportCSV, getWarehouseRegion } from "@/lib/format";
import { usePracaFilter } from "@/contexts/PracaFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";

type SortField =
  | "nome"
  | "estoqueUnd"
  | "mediaSemanalUnd"
  | "gapUnd"
  | "qtdProduzir"
  | "coberturaSemanas";

const STATUS_ORDER: ProducaoStatus[] = ["produzir", "ok", "sem_venda"];

const STATUS_UI: Record<
  ProducaoStatus,
  {
    dot: string;
    border: string;
    chipActive: string;
    icon: typeof AlertTriangle;
  }
> = {
  produzir: {
    dot: "bg-amber-500",
    border: "border-l-amber-500",
    chipActive: "border-amber-300 bg-amber-50",
    icon: AlertTriangle,
  },
  ok: {
    dot: "bg-emerald-500",
    border: "border-l-emerald-500",
    chipActive: "border-emerald-300 bg-emerald-50",
    icon: CheckCircle2,
  },
  sem_venda: {
    dot: "bg-gray-400",
    border: "border-l-gray-300",
    chipActive: "border-gray-300 bg-gray-100",
    icon: PackageX,
  },
};

function fmtUnd(v: number): string {
  return fmtNum(Math.round(v));
}

function fmtSemanas(v: number | null): string {
  if (v === null) return "—";
  if (v >= 99) return "99+";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function ProducaoPage() {
  const today = useMemo(() => new Date(), []);
  const dateFrom = useMemo(
    () => format(subDays(today, 28), "yyyy-MM-dd"),
    [today],
  );
  const dateTo = useMemo(() => format(today, "yyyy-MM-dd"), [today]);

  const { data: analyticsData, loading: l1, error: e1, refetch: r1 } = useFetch(
    () =>
      fetchProductAnalytics({
        dateFrom,
        dateTo,
        date3mCutoff: dateFrom,
      }),
    [dateFrom, dateTo],
  );
  const { data: invData, loading: l2, error: e2, refetch: r2 } = useFetch(
    () => fetchInventory({ limit: 5000 }),
    [],
  );

  const { praca } = usePracaFilter();
  const invRows = useMemo(
    () =>
      (invData?.data ?? []).filter(
        (inv) =>
          praca === "todas" || getWarehouseRegion(inv.warehouse_id) === praca,
      ),
    [invData, praca],
  );

  const loading = l1 || l2;
  const error = e1 || e2;

  const [search, setSearch] = useState("");
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const toggleGroup = (g: string) =>
    setGroupFilters((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  /** Padrão: só produtos a produzir */
  const [statusFilter, setStatusFilter] = useState<ProducaoStatus | null>(
    "produzir",
  );
  const [sortField, setSortField] = useState<SortField>("qtdProduzir");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo<ProducaoRow[]>(() => {
    if (!analyticsData?.products || !invData?.data) return [];
    return buildProducaoRows(
      analyticsData.products,
      invRows as InventoryRow[],
    );
  }, [analyticsData, invData, invRows]);

  const statusCounts = useMemo(() => {
    const counts: Record<ProducaoStatus, number> = {
      produzir: 0,
      ok: 0,
      sem_venda: 0,
    };
    for (const r of rows) counts[r.status]++;
    return counts;
  }, [rows]);

  const totalEmbalagens = useMemo(
    () => rows.reduce((s, r) => s + r.qtdProduzir, 0),
    [rows],
  );

  const gruposPresentes = useMemo(() => {
    const present = new Set(rows.map((r) => r.group));
    return COMPRAS_GROUP_ORDER.filter((g) => present.has(g));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    let list = rows;
    if (groupFilters.length)
      list = list.filter((r) => groupFilters.includes(r.group));
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    if (q)
      list = list.filter(
        (r) => r.nome.includes(q) || r.group.includes(q) || r.groupName.toUpperCase().includes(q),
      );

    const dir = sortDir === "asc" ? 1 : -1;
    const num = (v: number | null) => (v === null ? -Infinity : v);
    return [...list].sort((a, b) => {
      switch (sortField) {
        case "nome":
          return a.nome.localeCompare(b.nome) * dir;
        case "estoqueUnd":
          return (a.estoqueUnd - b.estoqueUnd) * dir;
        case "mediaSemanalUnd":
          return (a.mediaSemanalUnd - b.mediaSemanalUnd) * dir;
        case "gapUnd":
          return (a.gapUnd - b.gapUnd) * dir;
        case "qtdProduzir":
          return (a.qtdProduzir - b.qtdProduzir) * dir;
        case "coberturaSemanas":
          return (num(a.coberturaSemanas) - num(b.coberturaSemanas)) * dir;
        default:
          return 0;
      }
    });
  }, [rows, search, groupFilters, statusFilter, sortField, sortDir]);

  const visible = showAll ? filtered : filtered.slice(0, 100);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(f);
      setSortDir(f === "nome" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 inline" />
    ) : (
      <ChevronDown className="w-3 h-3 inline" />
    );
  };

  const handleExport = () => {
    exportCSV(
      filtered.map((r) => ({
        Produto: r.nome,
        Grupo: r.groupName,
        SKUs: r.skus,
        "Estoque (UND)": Math.round(r.estoqueUnd),
        "Media semanal (UND)": Math.round(r.mediaSemanalUnd),
        "Gap (UND)": Math.round(r.gapUnd),
        Embalagem: r.embalagemLabel,
        "Und por embalagem": r.undPorEmbalagem,
        "Qtd a produzir": r.qtdProduzir,
        "Cobertura (semanas)":
          r.coberturaSemanas !== null ? r.coberturaSemanas.toFixed(2) : "",
        Status: PRODUCAO_STATUS_META[r.status].label,
        Acao: PRODUCAO_STATUS_META[r.status].acao,
      })),
      `producao-${format(today, "yyyy-MM-dd")}.csv`,
    );
  };

  if (loading && !analyticsData) return <LoadingSkeleton rows={10} />;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          r1();
          r2();
        }}
      />
    );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-5 h-5 text-cockpit-accent" />
            Produção
          </h1>
          <p className="text-sm text-cockpit-muted mt-1">
            Média semanal das últimas 4 semanas · produzir o gap entre demanda e
            estoque em FARDO/CAIXA · sem buffer de segurança
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-cockpit-accent hover:bg-cockpit-accentHover transition"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_ORDER.map((s) => {
          const ui = STATUS_UI[s];
          const Icon = ui.icon;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? null : s)}
              className={`bg-white rounded-xl border px-4 py-3 text-left transition hover:shadow-sm ${
                active ? ui.chipActive : "border-cockpit-border"
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <span className={`w-2 h-2 rounded-full ${ui.dot}`} />
                <Icon className="w-3.5 h-3.5" />
                {PRODUCAO_STATUS_META[s].label}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {fmtNum(statusCounts[s])}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {PRODUCAO_STATUS_META[s].acao}
              </div>
            </button>
          );
        })}
        <div className="bg-white rounded-xl border border-cockpit-border px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Embalagens a produzir</div>
          <div className="text-2xl font-bold text-cockpit-accent">
            {fmtNum(totalEmbalagens)}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            Soma de FARDOS/CAIXAS sugeridos
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto ou grupo…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-cockpit-border bg-white focus:outline-none focus:ring-2 focus:ring-cockpit-accent/30"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {gruposPresentes.map((g) => {
            const active = groupFilters.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  active
                    ? "bg-cockpit-accent/10 text-cockpit-accent border-cockpit-accent/30"
                    : "bg-white text-gray-600 border-cockpit-border hover:bg-gray-50"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
        {(statusFilter || groupFilters.length > 0 || search) && (
          <button
            onClick={() => {
              setStatusFilter(null);
              setGroupFilters([]);
              setSearch("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-cockpit-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 border-b border-cockpit-border">
                <th className="px-3 py-2.5 font-medium">
                  <button
                    onClick={() => toggleSort("nome")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Produto <SortIcon field="nome" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">Grupo</th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("estoqueUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Estoque UND <SortIcon field="estoqueUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("mediaSemanalUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Média sem. UND <SortIcon field="mediaSemanalUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("gapUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Gap UND <SortIcon field="gapUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">Embalagem</th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("qtdProduzir")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Produzir <SortIcon field="qtdProduzir" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("coberturaSemanas")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Cobertura sem. <SortIcon field="coberturaSemanas" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-10 text-center text-sm text-gray-400"
                  >
                    Nenhum produto encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                visible.map((r) => {
                  const ui = STATUS_UI[r.status];
                  return (
                    <tr
                      key={r.key}
                      className={`border-b border-gray-100 border-l-4 ${ui.border} hover:bg-gray-50/60`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900">{r.nome}</div>
                        <div className="text-[11px] text-gray-400">
                          {r.skus} SKU{r.skus !== 1 ? "s" : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        <span className="text-xs font-medium text-gray-500">
                          {r.group}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {fmtUnd(r.estoqueUnd)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {fmtUnd(r.mediaSemanalUnd)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {fmtUnd(r.gapUnd)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                          {r.embalagemLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`text-base font-bold tabular-nums ${
                            r.qtdProduzir > 0
                              ? "text-amber-600"
                              : "text-gray-400"
                          }`}
                        >
                          {fmtNum(r.qtdProduzir)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                        {fmtSemanas(r.coberturaSemanas)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${ui.dot}`}
                          />
                          {PRODUCAO_STATUS_META[r.status].label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-3 py-2.5 border-t border-cockpit-border flex items-center justify-between text-xs text-gray-500">
            <span>
              Exibindo {visible.length} de {filtered.length} produtos
            </span>
            <button
              onClick={() => setShowAll((s) => !s)}
              className="text-cockpit-accent hover:underline font-medium"
            >
              {showAll ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
