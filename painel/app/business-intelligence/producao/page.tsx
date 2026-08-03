"use client";

/* ═══════════════════════════════════════════════════════════════
 * Produção — previsão semanal de embalagens a produzir
 *
 * Janela: últimos 28 dias (média semanal = total / 4).
 * Regra A: gap = max(0, média − estoque); qtd = ceil(gap / undTipo).
 * Embalagens: FARDO, CAIXA e PALETE (alternativas para o mesmo gap).
 * Grupos excluídos: TA, TM, TP, RO, OUTROS.
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
  Info,
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
  PRODUCAO_GROUP_ORDER,
  PACK_TYPES,
  packQtyOf,
  sumPackQtyByType,
  type PackType,
  type ProducaoRow,
  type ProducaoStatus,
} from "@/lib/producao-engine";
import { fmtNum, exportCSV, getWarehouseRegion } from "@/lib/format";
import { usePracaFilter } from "@/contexts/PracaFilterContext";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";

type SortField =
  | "nome"
  | "estoqueUnd"
  | "mediaSemanalUnd"
  | "gapUnd"
  | "fardo"
  | "caixa"
  | "palete"
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

const PACK_UI: Record<
  PackType,
  { label: string; short: string; accent: string; bg: string }
> = {
  FARDO: {
    label: "Fardos",
    short: "FD",
    accent: "text-sky-700",
    bg: "bg-sky-50 text-sky-800 border-sky-200",
  },
  CAIXA: {
    label: "Caixas",
    short: "CX",
    accent: "text-violet-700",
    bg: "bg-violet-50 text-violet-800 border-violet-200",
  },
  PALETE: {
    label: "Paletes",
    short: "PL",
    accent: "text-teal-700",
    bg: "bg-teal-50 text-teal-800 border-teal-200",
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

function packSortValue(row: ProducaoRow, type: PackType): number {
  return packQtyOf(row, type)?.qtd ?? -1;
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
  const [sortField, setSortField] = useState<SortField>("gapUnd");
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

  const packTotals = useMemo(() => sumPackQtyByType(rows.filter((r) => r.status === "produzir")), [rows]);

  const gruposPresentes = useMemo(() => {
    const present = new Set(rows.map((r) => r.group));
    return PRODUCAO_GROUP_ORDER.filter((g) => present.has(g));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    let list = rows;
    if (groupFilters.length)
      list = list.filter((r) => groupFilters.includes(r.group));
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    if (q)
      list = list.filter(
        (r) =>
          r.nome.includes(q) ||
          r.group.includes(q) ||
          r.groupName.toUpperCase().includes(q),
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
        case "fardo":
          return (packSortValue(a, "FARDO") - packSortValue(b, "FARDO")) * dir;
        case "caixa":
          return (packSortValue(a, "CAIXA") - packSortValue(b, "CAIXA")) * dir;
        case "palete":
          return (packSortValue(a, "PALETE") - packSortValue(b, "PALETE")) * dir;
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
      filtered.map((r) => {
        const fardo = packQtyOf(r, "FARDO");
        const caixa = packQtyOf(r, "CAIXA");
        const palete = packQtyOf(r, "PALETE");
        return {
          Produto: r.nome,
          Grupo: r.groupName,
          SKUs: r.skus,
          "Estoque (UND)": Math.round(r.estoqueUnd),
          "Media semanal (UND)": Math.round(r.mediaSemanalUnd),
          "Gap (UND)": Math.round(r.gapUnd),
          "Fardo label": fardo?.label ?? "",
          "Fardos a produzir": fardo?.qtd ?? "",
          "Caixa label": caixa?.label ?? "",
          "Caixas a produzir": caixa?.qtd ?? "",
          "Palete label": palete?.label ?? "",
          "Paletes a produzir": palete?.qtd ?? "",
          "Cobertura (semanas)":
            r.coberturaSemanas !== null ? r.coberturaSemanas.toFixed(2) : "",
          Status: PRODUCAO_STATUS_META[r.status].label,
        };
      }),
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
            Média semanal das últimas 4 semanas · gap = demanda − estoque ·
            quantidades em FARDO, CAIXA e PALETE para cobrir a volumetria
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

      {/* Nota UX */}
      <div className="flex gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-2.5 text-xs text-sky-900">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          As colunas <strong>Fardos</strong>, <strong>Caixas</strong> e{" "}
          <strong>Paletes</strong> são alternativas para cobrir o mesmo gap em
          unidades — escolha a embalagem de produção desejada. Produtos sem
          essas embalagens e grupos TA/TM/TP/RO/OUTROS ficam fora da lista.
        </p>
      </div>

      {/* KPIs status */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
      </div>

      {/* KPIs por embalagem (soma dos produtos a produzir) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PACK_TYPES.map((type) => {
          const ui = PACK_UI[type];
          return (
            <div
              key={type}
              className="bg-white rounded-xl border border-cockpit-border px-4 py-3"
            >
              <div className={`text-xs font-medium mb-1 ${ui.accent}`}>
                {ui.label} a produzir
              </div>
              <div className={`text-2xl font-bold tabular-nums ${ui.accent}`}>
                {fmtNum(packTotals[type])}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Soma nos produtos com status Produzir
              </div>
            </div>
          );
        })}
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
                <th className="px-3 py-2.5 font-medium sticky left-0 bg-gray-50 z-10">
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
                    Média sem. <SortIcon field="mediaSemanalUnd" />
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
                <th className="px-3 py-2.5 font-medium text-right min-w-[88px]">
                  <button
                    onClick={() => toggleSort("fardo")}
                    className={`inline-flex items-center gap-1 hover:text-gray-800 ${PACK_UI.FARDO.accent}`}
                  >
                    Fardos <SortIcon field="fardo" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right min-w-[88px]">
                  <button
                    onClick={() => toggleSort("caixa")}
                    className={`inline-flex items-center gap-1 hover:text-gray-800 ${PACK_UI.CAIXA.accent}`}
                  >
                    Caixas <SortIcon field="caixa" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right min-w-[88px]">
                  <button
                    onClick={() => toggleSort("palete")}
                    className={`inline-flex items-center gap-1 hover:text-gray-800 ${PACK_UI.PALETE.accent}`}
                  >
                    Paletes <SortIcon field="palete" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("coberturaSemanas")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Cobertura <SortIcon field="coberturaSemanas" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
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
                      <td className="px-3 py-2.5 sticky left-0 bg-white">
                        <div className="font-medium text-gray-900">{r.nome}</div>
                        <div className="text-[11px] text-gray-400">
                          {r.skus} SKU{r.skus !== 1 ? "s" : ""}
                          {r.packs.length > 0 && (
                            <>
                              {" · "}
                              {r.packs.map((p) => p.label).join(" · ")}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
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
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-800">
                        {fmtUnd(r.gapUnd)}
                      </td>
                      {PACK_TYPES.map((type) => {
                        const pack = packQtyOf(r, type);
                        const pui = PACK_UI[type];
                        if (!pack) {
                          return (
                            <td
                              key={type}
                              className="px-3 py-2.5 text-right text-gray-300 tabular-nums"
                            >
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={type} className="px-3 py-2.5 text-right">
                            <div
                              className={`text-base font-bold tabular-nums ${
                                pack.qtd > 0 ? pui.accent : "text-gray-400"
                              }`}
                            >
                              {fmtNum(pack.qtd)}
                            </div>
                            <div
                              className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium ${pui.bg}`}
                            >
                              {pack.label}
                            </div>
                          </td>
                        );
                      })}
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
