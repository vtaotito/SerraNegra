"use client";

/* ═══════════════════════════════════════════════════════════════
 * Produção — estoque, pedidos e produção por embalagem
 *
 * Janela de vendas: últimos 3 meses (média mensal = total / 3).
 * Por FARDO / CAIXA / PALETE:
 *   estoque (on-hand), pedidos, disponível (= estoque − pedidos),
 *   média mensal, faltam UND / emb. a produzir.
 * Produzir: faltamUnd = max(0, média − disponível); emb = ceil(faltam/und).
 * Grupos excluídos: TA, TM, TP, RO, OUTROS.
 * ═══════════════════════════════════════════════════════════════ */

import { Fragment, useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import {
  Factory,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronRight,
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
  sumProduzirByType,
  type PackDetail,
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
  | "pedidosUnd"
  | "disponivelUnd"
  | "mediaMensalUnd"
  | "faltamUnd"
  | "qtdProduzirTotal"
  | "coberturaMeses";

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
  { label: string; accent: string; bg: string }
> = {
  FARDO: {
    label: "Fardo",
    accent: "text-sky-700",
    bg: "bg-sky-50 text-sky-800 border-sky-200",
  },
  CAIXA: {
    label: "Caixa",
    accent: "text-violet-700",
    bg: "bg-violet-50 text-violet-800 border-violet-200",
  },
  PALETE: {
    label: "Palete",
    accent: "text-teal-700",
    bg: "bg-teal-50 text-teal-800 border-teal-200",
  },
};

function fmtUnd(v: number): string {
  return fmtNum(Math.round(v));
}

function fmtEmb(v: number): string {
  return fmtNum(Math.round(v));
}

function fmtMeses(v: number | null): string {
  if (v === null) return "—";
  if (v >= 99) return "99+";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function PackCell({
  value,
  accent,
  sub,
}: {
  value: number;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div className="text-right">
      <div
        className={`tabular-nums font-semibold ${
          accent && value > 0 ? "text-amber-600" : "text-gray-800"
        }`}
      >
        {fmtEmb(value)}
      </div>
      {sub && (
        <div className="text-[10px] text-gray-400 tabular-nums">{sub}</div>
      )}
    </div>
  );
}

export default function ProducaoPage() {
  const today = useMemo(() => new Date(), []);
  const dateFrom = useMemo(
    () => format(subMonths(today, 3), "yyyy-MM-dd"),
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
  const [statusFilter, setStatusFilter] = useState<ProducaoStatus | null>(
    "produzir",
  );
  const [sortField, setSortField] = useState<SortField>("faltamUnd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllVisible = (keys: string[]) => {
    setExpanded(new Set(keys));
  };

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

  const packTotals = useMemo(
    () => sumProduzirByType(rows.filter((r) => r.status === "produzir")),
    [rows],
  );

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
        case "pedidosUnd":
          return (a.pedidosUnd - b.pedidosUnd) * dir;
        case "disponivelUnd":
          return (a.disponivelUnd - b.disponivelUnd) * dir;
        case "mediaMensalUnd":
          return (a.mediaMensalUnd - b.mediaMensalUnd) * dir;
        case "faltamUnd":
          return (a.faltamUnd - b.faltamUnd) * dir;
        case "qtdProduzirTotal":
          return (a.qtdProduzirTotal - b.qtdProduzirTotal) * dir;
        case "coberturaMeses":
          return (num(a.coberturaMeses) - num(b.coberturaMeses)) * dir;
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
    const csvRows: Record<string, unknown>[] = [];
    for (const r of filtered) {
      for (const p of r.packs) {
        csvRows.push({
          Produto: r.nome,
          Grupo: r.groupName,
          Embalagem: p.label,
          "Estoque (emb)": Math.round(p.estoqueEmb),
          "Estoque (UND)": Math.round(p.estoqueUnd),
          "Pedidos (emb)": Math.round(p.pedidosEmb),
          "Pedidos (UND)": Math.round(p.pedidosUnd),
          "Disponivel (emb)": Math.round(p.disponivelEmb),
          "Disponivel (UND)": Math.round(p.disponivelUnd),
          "Media mensal 3m (emb)": Math.round(p.mediaMensalEmb),
          "Media mensal 3m (UND)": Math.round(p.mediaMensalUnd),
          "Faltam (UND)": Math.round(p.faltamUnd),
          "Produzir (emb)": p.produzir,
          "Status produto": PRODUCAO_STATUS_META[r.status].label,
        });
      }
    }
    exportCSV(csvRows, `producao-${format(today, "yyyy-MM-dd")}.csv`);
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
            Disponível = estoque − pedidos · média mensal (3m) · unidades que
            faltam para atingir a previsão de venda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => expandAllVisible(visible.map((r) => r.key))}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 bg-white border border-cockpit-border hover:bg-gray-50 transition"
          >
            Expandir visíveis
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-cockpit-accent hover:bg-cockpit-accentHover transition"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-2.5 text-xs text-sky-900">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          <strong>Estoque</strong> = on-hand físico. <strong>Pedidos</strong> =
          reservado ainda no estoque. <strong>Disponível</strong> = Estoque −
          Pedidos. <strong>Média 3m</strong> = vendas ÷ 3.{" "}
          <strong>Produzir</strong> mostra quantas <em>unidades</em> faltam para
          o disponível atingir a média e quantas embalagens isso representa.
          Expanda o produto para FARDO, CAIXA e PALETE.
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
            </button>
          );
        })}
      </div>

      {/* Totais a produzir */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PACK_TYPES.map((type) => {
          const ui = PACK_UI[type];
          return (
            <div
              key={type}
              className="bg-white rounded-xl border border-cockpit-border px-4 py-3"
            >
              <div className={`text-xs font-medium mb-1 ${ui.accent}`}>
                {ui.label}s a produzir
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
                <th className="px-3 py-2.5 font-medium w-8" />
                <th className="px-3 py-2.5 font-medium">
                  <button
                    onClick={() => toggleSort("nome")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Produto / Embalagem <SortIcon field="nome" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">Grupo</th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("estoqueUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Estoque <SortIcon field="estoqueUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("pedidosUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Pedidos <SortIcon field="pedidosUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("disponivelUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Disponível <SortIcon field="disponivelUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("mediaMensalUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Média 3m / mês <SortIcon field="mediaMensalUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right min-w-[120px]">
                  <button
                    onClick={() => toggleSort("faltamUnd")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Produzir <SortIcon field="faltamUnd" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    onClick={() => toggleSort("coberturaMeses")}
                    className="inline-flex items-center gap-1 hover:text-gray-800"
                  >
                    Cobertura <SortIcon field="coberturaMeses" />
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
                  const isOpen = expanded.has(r.key);
                  return (
                    <Fragment key={r.key}>
                      <tr
                        className={`border-b border-gray-100 border-l-4 ${ui.border} hover:bg-gray-50/60 cursor-pointer`}
                        onClick={() => toggleExpand(r.key)}
                      >
                        <td className="px-2 py-2.5 text-gray-400">
                          <ChevronRight
                            className={`w-4 h-4 transition-transform ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900">
                            {r.nome}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {r.skus} SKU{r.skus !== 1 ? "s" : ""} ·{" "}
                            {r.packs.map((p) => p.label).join(" · ")}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-medium text-gray-500">
                            {r.group}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="tabular-nums text-gray-800 font-medium">
                            {fmtUnd(r.estoqueUnd)}
                          </div>
                          <div className="text-[10px] text-gray-400">UND</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div
                            className={`tabular-nums font-medium ${
                              r.pedidosUnd > 0
                                ? "text-blue-600"
                                : "text-gray-400"
                            }`}
                          >
                            {r.pedidosUnd > 0
                              ? fmtUnd(r.pedidosUnd)
                              : "—"}
                          </div>
                          <div className="text-[10px] text-gray-400">UND</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="tabular-nums text-gray-900 font-semibold">
                            {fmtUnd(r.disponivelUnd)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            est. − ped.
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="tabular-nums text-gray-800 font-medium">
                            {fmtUnd(r.mediaMensalUnd)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            UND/mês
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {r.faltamUnd > 0 ? (
                            <>
                              <div className="text-base font-bold tabular-nums text-amber-600">
                                {fmtUnd(r.faltamUnd)}
                              </div>
                              <div className="text-[10px] text-amber-700/80">
                                UND faltam
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                ≈ {fmtNum(r.qtdProduzirTotal)} emb.
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-base font-bold tabular-nums text-gray-400">
                                0
                              </div>
                              <div className="text-[10px] text-gray-400">
                                UND faltam
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                          {fmtMeses(r.coberturaMeses)}
                          <div className="text-[10px] text-gray-400">meses</div>
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
                      {isOpen &&
                        r.packs.map((p) => (
                          <PackDetailRow key={`${r.key}-${p.type}`} pack={p} />
                        ))}
                    </Fragment>
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

function PackDetailRow({ pack }: { pack: PackDetail }) {
  const ui = PACK_UI[pack.type];
  return (
    <tr className="border-b border-gray-50 bg-gray-50/40 border-l-4 border-l-transparent">
      <td className="px-2 py-2" />
      <td className="px-3 py-2 pl-8" colSpan={2}>
        <span
          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${ui.bg}`}
        >
          {pack.label}
        </span>
        <span className="ml-2 text-[11px] text-gray-400">
          {pack.units} UND / emb.
        </span>
      </td>
      <td className="px-3 py-2">
        <PackCell
          value={pack.estoqueEmb}
          sub={`${fmtUnd(pack.estoqueUnd)} UND`}
        />
      </td>
      <td className="px-3 py-2">
        {pack.pedidosEmb > 0 ? (
          <PackCell
            value={pack.pedidosEmb}
            sub={`${fmtUnd(pack.pedidosUnd)} UND`}
          />
        ) : (
          <div className="text-right text-gray-300">—</div>
        )}
      </td>
      <td className="px-3 py-2">
        <PackCell
          value={pack.disponivelEmb}
          sub={`${fmtUnd(pack.disponivelUnd)} UND`}
        />
      </td>
      <td className="px-3 py-2">
        <PackCell
          value={pack.mediaMensalEmb}
          sub={`${fmtUnd(pack.mediaMensalUnd)} UND/mês`}
        />
      </td>
      <td className="px-3 py-2 text-right">
        {pack.faltamUnd > 0 ? (
          <>
            <div className="tabular-nums font-bold text-amber-600">
              {fmtUnd(pack.faltamUnd)}
            </div>
            <div className="text-[10px] text-amber-700/80">UND faltam</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              = {fmtEmb(pack.produzir)} {ui.label.toLowerCase()}
              {pack.produzir !== 1 ? "s" : ""}
            </div>
          </>
        ) : (
          <>
            <div className="tabular-nums font-semibold text-gray-400">0</div>
            <div className="text-[10px] text-gray-400">UND faltam</div>
          </>
        )}
      </td>
      <td className="px-3 py-2" colSpan={2}>
        <div className="text-[11px] text-gray-500 leading-snug">
          {pack.faltamUnd > 0
            ? `Faltam ${fmtUnd(pack.faltamUnd)} UND (média ${fmtUnd(pack.mediaMensalUnd)} − disponível ${fmtUnd(pack.disponivelUnd)}) → produzir ${fmtEmb(pack.produzir)} ${ui.label.toLowerCase()}${pack.produzir !== 1 ? "s" : ""}`
            : pack.mediaMensalUnd > 0
              ? "Disponível cobre a média mensal desta embalagem"
              : "Sem vendas desta embalagem nos 3 meses"}
        </div>
      </td>
    </tr>
  );
}
