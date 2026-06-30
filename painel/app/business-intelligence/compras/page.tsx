"use client";

/* ═══════════════════════════════════════════════════════════════
 * Gestão de Compras — Curva ABCD (faturamento) + Curva 123 (volume)
 *
 * Regras: curvas calculadas em dois níveis (dentro do grupo e geral);
 * em divergência vale a Classe Grupo. Cobertura, estoque mínimo/máximo
 * e semáforo seguem as faixas por Classe Grupo (GI tem regra própria).
 * Período de análise: últimos 12 meses (consumo médio: últimos 3 meses).
 * ═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { format, subMonths, startOfMonth } from "date-fns";
import {
  ShoppingCart,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PackageX,
  Archive,
} from "lucide-react";
import { useFetch } from "@/hooks/useFetch";
import {
  fetchProductAnalytics,
  fetchInventory,
  type ProductAnalyticsRow,
  type InventoryRow,
} from "@/lib/cockpit-api";
import {
  getEmbalaQty,
  getBaseProductName,
  getUnifiedProductKey,
} from "@/lib/item-parser";
import {
  getComprasGroup,
  classifyCompras,
  getCoberturaFaixa,
  getSemaforo,
  getEstoqueAlvo,
  COMPRAS_GROUP_NAMES,
  COMPRAS_GROUP_ORDER,
  SEMAFORO_META,
  type ComprasClassification,
  type CoberturaFaixa,
  type Semaforo,
  type CurvaABCD,
} from "@/lib/compras-engine";
import { fmtBRL, fmtNum, exportCSV } from "@/lib/format";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";

/* ═══════════════════ Tipos ═══════════════════ */

interface CompraRow {
  key: string;
  nome: string;
  group: string;
  groupName: string;
  skus: number;
  fat12m: number;
  vol12mUnd: number;
  vol3mUnd: number;
  /** Consumo mensal em unidades (média 3m; fallback média 12m) */
  consumoMensal: number | null;
  consumoBase: "3m" | "12m" | null;
  /** Estoque disponível (livre) em unidades */
  estoqueUnd: number;
  /** Em pedido de compra (unidades) */
  emPedidoUnd: number;
  cobertura: number | null;
  cls: ComprasClassification;
  faixa: CoberturaFaixa;
  semaforo: Semaforo;
  estMin: number;
  estMax: number;
}

type SortField =
  | "nome" | "classe" | "fat12m" | "share" | "vol12mUnd"
  | "consumoMensal" | "estoqueUnd" | "cobertura" | "estMin";
type Nivel = "grupo" | "geral";

/* ═══════════════════ Config visual ═══════════════════ */

const SEMAFORO_UI: Record<Semaforo, {
  dot: string; border: string; chipActive: string; icon: typeof AlertTriangle;
}> = {
  critico: { dot: "bg-red-500", border: "border-l-red-500", chipActive: "border-red-300 bg-red-50", icon: AlertTriangle },
  alerta: { dot: "bg-amber-400", border: "border-l-amber-400", chipActive: "border-amber-300 bg-amber-50", icon: Clock },
  ok: { dot: "bg-emerald-500", border: "border-l-emerald-500", chipActive: "border-emerald-300 bg-emerald-50", icon: CheckCircle2 },
  excesso: { dot: "bg-blue-500", border: "border-l-blue-500", chipActive: "border-blue-300 bg-blue-50", icon: Archive },
  sem_venda: { dot: "bg-gray-400", border: "border-l-gray-300", chipActive: "border-gray-300 bg-gray-100", icon: PackageX },
};

const SEMAFORO_ORDER: Semaforo[] = ["critico", "alerta", "ok", "excesso", "sem_venda"];

const ABCD_COLORS: Record<CurvaABCD, string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-rose-100 text-rose-700",
};

function fmtMeses(v: number | null): string {
  if (v === null) return "—";
  if (v >= 99) return "99+";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtUnd(v: number): string {
  return fmtNum(Math.round(v));
}

/* ═══════════════════ Página ═══════════════════ */

export default function ComprasPage() {
  const today = useMemo(() => new Date(), []);
  const dateFrom = useMemo(() => format(startOfMonth(subMonths(today, 11)), "yyyy-MM-dd"), [today]);
  const dateTo = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const date3mCutoff = useMemo(() => format(subMonths(today, 3), "yyyy-MM-dd"), [today]);

  const { data: analyticsData, loading: l1, error: e1, refetch: r1 } = useFetch(
    () => fetchProductAnalytics({ dateFrom, dateTo, date3mCutoff }),
    [dateFrom, dateTo, date3mCutoff],
  );
  const { data: invData, loading: l2, error: e2, refetch: r2 } = useFetch(
    () => fetchInventory({ limit: 5000 }),
    [],
  );

  const loading = l1 || l2;
  const error = e1 || e2;

  /* ── Filtros / estado de UI ── */
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [semFilter, setSemFilter] = useState<Semaforo | null>(null);
  const [classeFilter, setClasseFilter] = useState<string | null>(null);
  const [nivel, setNivel] = useState<Nivel>("grupo");
  const [sortField, setSortField] = useState<SortField>("fat12m");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);
  const [showRegras, setShowRegras] = useState(false);

  /* ── Construção das linhas ── */
  const rows = useMemo<CompraRow[]>(() => {
    if (!analyticsData?.products || !invData?.data) return [];

    type Agg = {
      nome: string; group: string; skuSet: Set<string>;
      fat12m: number; vol12mUnd: number; vol3mUnd: number;
      estoqueUnd: number; emPedidoUnd: number;
    };
    const map = new Map<string, Agg>();

    const ensure = (key: string, nome: string, group: string): Agg => {
      let a = map.get(key);
      if (!a) {
        a = { nome, group, skuSet: new Set(), fat12m: 0, vol12mUnd: 0, vol3mUnd: 0, estoqueUnd: 0, emPedidoUnd: 0 };
        map.set(key, a);
      }
      return a;
    };

    // Vendas 12m (analytics do catálogo)
    for (const r of analyticsData.products as ProductAnalyticsRow[]) {
      const group = getComprasGroup(r.item_code);
      if (!group) continue;
      const key = getUnifiedProductKey(r.item_code, r.item_description);
      const nome = getBaseProductName(r.item_description) || r.item_code;
      const emb = getEmbalaQty(r.item_description);
      const a = ensure(key, nome, group);
      a.skuSet.add(r.item_code);
      a.fat12m += r.total_revenue;
      a.vol12mUnd += r.total_qty * emb;
      a.vol3mUnd += (r.qty_3m ?? 0) * emb;
    }

    // Estoque (por SKU/depósito → unidades → produto unificado)
    for (const inv of invData.data as InventoryRow[]) {
      const group = getComprasGroup(inv.product_id);
      if (!group) continue;
      const desc = inv.item_name ?? "";
      const key = getUnifiedProductKey(inv.product_id, desc || inv.product_id);
      const nome = getBaseProductName(desc) || inv.product_id;
      const emb = getEmbalaQty(desc);
      const a = ensure(key, nome, group);
      a.skuSet.add(inv.product_id);
      const disponivelUnd = Math.max((inv.quantity_available ?? 0) - (inv.quantity_reserved ?? 0), 0);
      a.estoqueUnd += disponivelUnd * emb;
      a.emPedidoUnd += (inv.quantity_on_order ?? 0) * emb;
    }

    // Remove ruído: nada vendido e nada em estoque
    const entries = Array.from(map.entries()).filter(
      ([, a]) => a.fat12m > 0 || a.vol12mUnd > 0 || a.estoqueUnd > 0 || a.emPedidoUnd > 0,
    );

    // Curvas ABCD + 123 (grupo e geral)
    const classifications = classifyCompras(
      entries.map(([key, a]) => ({
        key, group: a.group, revenue12m: a.fat12m, volume12m: a.vol12mUnd,
      })),
    );

    return entries.map(([key, a]) => {
      const cls = classifications.get(key)!;
      const consumoMensal =
        a.vol3mUnd > 0 ? a.vol3mUnd / 3 : a.vol12mUnd > 0 ? a.vol12mUnd / 12 : null;
      const consumoBase: CompraRow["consumoBase"] =
        a.vol3mUnd > 0 ? "3m" : a.vol12mUnd > 0 ? "12m" : null;
      const cobertura = consumoMensal ? a.estoqueUnd / consumoMensal : null;
      // Regra de ouro: faixas e semáforo sempre pela Classe Grupo
      const faixa = getCoberturaFaixa(cls.classeGrupo, a.group);
      const semaforo = getSemaforo(cobertura, faixa);
      const { minimo, maximo } = getEstoqueAlvo(consumoMensal ?? 0, faixa);
      return {
        key,
        nome: a.nome,
        group: a.group,
        groupName: COMPRAS_GROUP_NAMES[a.group] ?? a.group,
        skus: a.skuSet.size,
        fat12m: a.fat12m,
        vol12mUnd: a.vol12mUnd,
        vol3mUnd: a.vol3mUnd,
        consumoMensal,
        consumoBase,
        estoqueUnd: a.estoqueUnd,
        emPedidoUnd: a.emPedidoUnd,
        cobertura,
        cls,
        faixa,
        semaforo,
        estMin: minimo,
        estMax: maximo,
      } satisfies CompraRow;
    });
  }, [analyticsData, invData]);

  /* ── KPIs por semáforo (sobre todas as linhas) ── */
  const semCounts = useMemo(() => {
    const counts: Record<Semaforo, number> = { critico: 0, alerta: 0, ok: 0, excesso: 0, sem_venda: 0 };
    for (const r of rows) counts[r.semaforo]++;
    return counts;
  }, [rows]);

  const gruposPresentes = useMemo(() => {
    const present = new Set(rows.map((r) => r.group));
    return COMPRAS_GROUP_ORDER.filter((g) => present.has(g));
  }, [rows]);

  const classesPresentes = useMemo(() => {
    const set = new Set(rows.map((r) => (nivel === "grupo" ? r.cls.classeGrupo : r.cls.classeGeral)));
    return Array.from(set).sort();
  }, [rows, nivel]);

  /* ── Filtro + ordenação ── */
  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    let list = rows;
    if (groupFilter) list = list.filter((r) => r.group === groupFilter);
    if (semFilter) list = list.filter((r) => r.semaforo === semFilter);
    if (classeFilter)
      list = list.filter((r) => (nivel === "grupo" ? r.cls.classeGrupo : r.cls.classeGeral) === classeFilter);
    if (q) list = list.filter((r) => r.nome.includes(q) || r.group.includes(q));

    const dir = sortDir === "asc" ? 1 : -1;
    const num = (v: number | null) => (v === null ? -Infinity : v);
    return [...list].sort((a, b) => {
      switch (sortField) {
        case "nome": return a.nome.localeCompare(b.nome) * dir;
        case "classe": {
          const ca = nivel === "grupo" ? a.cls.classeGrupo : a.cls.classeGeral;
          const cb = nivel === "grupo" ? b.cls.classeGrupo : b.cls.classeGeral;
          return ca.localeCompare(cb) * dir || b.fat12m - a.fat12m;
        }
        case "share": {
          const sa = nivel === "grupo" ? a.cls.shareGrupo : a.cls.shareGeral;
          const sb = nivel === "grupo" ? b.cls.shareGrupo : b.cls.shareGeral;
          return (sa - sb) * dir;
        }
        case "fat12m": return (a.fat12m - b.fat12m) * dir;
        case "vol12mUnd": return (a.vol12mUnd - b.vol12mUnd) * dir;
        case "consumoMensal": return (num(a.consumoMensal) - num(b.consumoMensal)) * dir;
        case "estoqueUnd": return (a.estoqueUnd - b.estoqueUnd) * dir;
        case "cobertura": return (num(a.cobertura) - num(b.cobertura)) * dir;
        case "estMin": return (a.estMin - b.estMin) * dir;
        default: return 0;
      }
    });
  }, [rows, search, groupFilter, semFilter, classeFilter, nivel, sortField, sortDir]);

  const visible = showAll ? filtered : filtered.slice(0, 100);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir(f === "nome" || f === "classe" ? "asc" : "desc"); }
  };

  const handleExport = () => {
    exportCSV(
      filtered.map((r) => ({
        Produto: r.nome,
        Grupo: r.groupName,
        SKUs: r.skus,
        "Classe Grupo": r.cls.classeGrupo,
        "Classe Geral": r.cls.classeGeral,
        "Fat 12m": r.fat12m.toFixed(2),
        "Vol 12m (UND)": Math.round(r.vol12mUnd),
        "Consumo mensal (UND)": r.consumoMensal !== null ? Math.round(r.consumoMensal) : "",
        "Estoque disp (UND)": Math.round(r.estoqueUnd),
        "Em pedido (UND)": Math.round(r.emPedidoUnd),
        "Cobertura (meses)": r.cobertura !== null ? r.cobertura.toFixed(2) : "",
        "Est minimo (UND)": Math.round(r.estMin),
        "Est maximo (UND)": Math.round(r.estMax),
        Status: SEMAFORO_META[r.semaforo].label,
        Acao: SEMAFORO_META[r.semaforo].acao,
      })),
      `gestao-compras-${format(today, "yyyy-MM-dd")}.csv`,
    );
  };

  if (loading && !analyticsData) return <LoadingSkeleton rows={10} />;
  if (error) return <ErrorState message={error} onRetry={() => { r1(); r2(); }} />;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cockpit-accent" />
            Gestão de Compras
          </h1>
          <p className="text-sm text-cockpit-muted mt-1">
            Curva ABCD (faturamento) + 123 (volume) dos últimos 12 meses · cobertura sobre o
            consumo médio dos últimos 3 meses · em divergência, vale a Classe Grupo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegras((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 bg-white border border-cockpit-border hover:bg-gray-50 transition"
          >
            <Info className="w-3.5 h-3.5" />
            Regras
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showRegras ? "rotate-90" : ""}`} />
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

      {/* ── Regras (colapsável) ── */}
      {showRegras && <RegrasPanel />}

      {/* ── KPIs semáforo (clicáveis) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SEMAFORO_ORDER.map((s) => {
          const ui = SEMAFORO_UI[s];
          const Icon = ui.icon;
          const active = semFilter === s;
          return (
            <button
              key={s}
              onClick={() => setSemFilter(active ? null : s)}
              className={`bg-white rounded-xl border px-4 py-3 text-left transition hover:shadow-sm ${
                active ? ui.chipActive : "border-cockpit-border"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs text-cockpit-muted">
                <span className={`w-2 h-2 rounded-full ${ui.dot}`} />
                {SEMAFORO_META[s].label}
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{semCounts[s]}</p>
              <p className="text-[11px] text-cockpit-muted mt-0.5 flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {SEMAFORO_META[s].acao}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-cockpit-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cockpit-accent/40"
          />
        </div>

        <select
          value={classeFilter ?? ""}
          onChange={(e) => setClasseFilter(e.target.value || null)}
          className="px-3 py-2 rounded-lg border border-cockpit-border bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/40"
        >
          <option value="">Todas as classes</option>
          {classesPresentes.map((c) => (
            <option key={c} value={c}>Classe {c}</option>
          ))}
        </select>

        {/* Nível da classe exibida */}
        <div className="flex rounded-lg border border-cockpit-border overflow-hidden text-xs font-medium">
          {(["grupo", "geral"] as Nivel[]).map((n) => (
            <button
              key={n}
              onClick={() => { setNivel(n); setClasseFilter(null); }}
              className={`px-3 py-2 transition ${
                nivel === n ? "bg-cockpit-accent text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n === "grupo" ? "Classe Grupo" : "Classe Geral"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chips de grupo ── */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setGroupFilter(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
            groupFilter === null
              ? "bg-cockpit-accent text-white border-cockpit-accent"
              : "bg-white text-gray-600 border-cockpit-border hover:bg-gray-50"
          }`}
        >
          Todos
        </button>
        {gruposPresentes.map((g) => (
          <button
            key={g}
            onClick={() => setGroupFilter(groupFilter === g ? null : g)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              groupFilter === g
                ? "bg-cockpit-accent text-white border-cockpit-accent"
                : "bg-white text-gray-600 border-cockpit-border hover:bg-gray-50"
            }`}
            title={COMPRAS_GROUP_NAMES[g]}
          >
            {g} · {COMPRAS_GROUP_NAMES[g]}
          </button>
        ))}
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white rounded-xl border border-cockpit-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-gray-50/60">
                <Th label="Produto" field="nome" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="left" />
                <Th label={nivel === "grupo" ? "Classe Grupo" : "Classe Geral"} field="classe" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Fat 12m" field="fat12m" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <Th label="% Part." field="share" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Vol 12m (UND)" field="vol12mUnd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Consumo/mês" field="consumoMensal" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Estoque (UND)" field="estoqueUnd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Cobertura" field="cobertura" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Mín / Máx" field="estMin" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-cockpit-muted">
                    Nenhum produto encontrado com os filtros atuais
                  </td>
                </tr>
              )}
              {visible.map((r) => {
                const ui = SEMAFORO_UI[r.semaforo];
                const classe = nivel === "grupo" ? r.cls.classeGrupo : r.cls.classeGeral;
                const outraClasse = nivel === "grupo" ? r.cls.classeGeral : r.cls.classeGrupo;
                const share = nivel === "grupo" ? r.cls.shareGrupo : r.cls.shareGeral;
                return (
                  <tr key={r.key} className={`border-b border-gray-50 border-l-4 ${ui.border} hover:bg-gray-50/60 transition`}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900 leading-snug">{r.nome}</p>
                      <p className="text-[11px] text-cockpit-muted">
                        {r.group} · {r.groupName}{r.skus > 1 ? ` · ${r.skus} SKUs` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <ClasseBadge classe={classe} />
                      {outraClasse !== classe && (
                        <p
                          className="text-[10px] text-cockpit-muted mt-0.5"
                          title={nivel === "grupo" ? "Classe geral (visão macro)" : "Classe grupo (decisão operacional)"}
                        >
                          {nivel === "grupo" ? "geral" : "grupo"}: {outraClasse}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900 whitespace-nowrap">{fmtBRL(r.fat12m, 0)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{(share * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{fmtUnd(r.vol12mUnd)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">
                      {r.consumoMensal !== null ? fmtUnd(r.consumoMensal) : "—"}
                      {r.consumoBase === "12m" && (
                        <span className="ml-1 text-[10px] text-cockpit-muted" title="Sem venda nos últimos 3 meses — média calculada sobre 12 meses">
                          (12m)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">
                      {fmtUnd(r.estoqueUnd)}
                      {r.emPedidoUnd > 0 && (
                        <span className="ml-1 text-[10px] text-blue-600" title="Em pedido de compra">
                          +{fmtUnd(r.emPedidoUnd)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                        <span className={`w-2 h-2 rounded-full ${ui.dot}`} />
                        {fmtMeses(r.cobertura)}
                        {r.cobertura !== null && <span className="text-[10px] font-normal text-cockpit-muted">meses</span>}
                      </span>
                      <p className="text-[10px] text-cockpit-muted">
                        ideal {r.faixa.idealMin}–{r.faixa.idealMax}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap text-xs">
                      {r.consumoMensal !== null ? `${fmtUnd(r.estMin)} / ${fmtUnd(r.estMax)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-700 border border-gray-200 whitespace-nowrap"
                        title={SEMAFORO_META[r.semaforo].acao}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${ui.dot}`} />
                        {SEMAFORO_META[r.semaforo].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-cockpit-border bg-gray-50/40 text-xs text-cockpit-muted">
          <span>
            {visible.length} de {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== rows.length ? ` (${rows.length} no total)` : ""}
          </span>
          {filtered.length > 100 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="font-medium text-cockpit-accent hover:underline"
            >
              {showAll ? "Mostrar top 100" : `Mostrar todos (${filtered.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Subcomponentes ═══════════════════ */

function Th({
  label, field, sortField, sortDir, onSort, align = "right",
}: {
  label: string; field: SortField; sortField: SortField;
  sortDir: "asc" | "desc"; onSort: (f: SortField) => void; align?: "left" | "right";
}) {
  const active = sortField === field;
  return (
    <th
      className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide select-none cursor-pointer ${
        align === "left" ? "text-left" : "text-right"
      } ${active ? "text-cockpit-accent" : "text-gray-500"}`}
      onClick={() => onSort(field)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}

function ClasseBadge({ classe }: { classe: string }) {
  const abcd = classe.charAt(0) as CurvaABCD;
  return (
    <span className={`inline-flex items-center justify-center min-w-[34px] px-1.5 py-0.5 rounded-md text-xs font-bold ${ABCD_COLORS[abcd] ?? "bg-gray-100 text-gray-600"}`}>
      {classe}
    </span>
  );
}

function RegrasPanel() {
  return (
    <div className="bg-white rounded-xl border border-cockpit-border p-4 text-xs text-gray-600 space-y-3">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="font-semibold text-gray-800 mb-1">Curva ABCD — Faturamento</p>
          <p>A: 0–70% acumulado · B: 70–85% · C: 85–95% · D: 95–100%</p>
        </div>
        <div>
          <p className="font-semibold text-gray-800 mb-1">Curva 123 — Volume</p>
          <p>1: 0–70% acumulado · 2: 70–90% · 3: 90–100%</p>
        </div>
        <div>
          <p className="font-semibold text-gray-800 mb-1">Dois níveis</p>
          <p>
            Classe Grupo: curva dentro de cada grupo (decisão operacional). Classe Geral: todos
            os produtos juntos (visão macro). Em divergência, <strong>vale a Classe Grupo</strong>.
          </p>
        </div>
        <div>
          <p className="font-semibold text-gray-800 mb-1">Estoque mínimo / máximo</p>
          <p>
            Mínimo = fator de segurança × consumo mensal (1,5 mês nas classes rápidas; 3,5 nas
            lentas; 3 fixo em GI). Máximo = mínimo × 2.
          </p>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3">
        <p className="font-semibold text-gray-800 mb-1.5">Faixas de cobertura (por Classe Grupo)</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <p><strong>A1 A2 A3 B1 B2 C1</strong> — ideal 1–2 meses · crítico &lt; 0,5 · alerta &lt; 1 · excesso &gt; 3</p>
          <p><strong>B3 C2 C3 D1 D2 D3</strong> — ideal 3–4 meses · crítico &lt; 1,5 · alerta &lt; 3 · excesso &gt; 6</p>
          <p><strong>GI (Garrafa Importada)</strong> — ideal 4–7 meses · crítico &lt; 3 · alerta &lt; 4 · excesso &gt; 9 (lead time 75 dias)</p>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {SEMAFORO_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${SEMAFORO_UI[s].dot}`} />
            <strong className="text-gray-800">{SEMAFORO_META[s].label}</strong> — {SEMAFORO_META[s].acao}
          </span>
        ))}
        <span className="text-cockpit-muted">
          Grupos fora da classificação: EM, DA, CH · EQ+IS+ME+MO+PA formam curva única (Outros)
        </span>
      </div>
    </div>
  );
}
