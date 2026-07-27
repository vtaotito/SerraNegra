"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  DollarSign,
  Loader2,
  Phone,
  Mail,
  MessageCircle,
  MessageSquare,
  X,
  Clock,
  Package,
  Store,
  CalendarDays,
  Send,
  StickyNote,
  Layers,
  Plus,
  Hourglass,
  Check,
  Ban,
  Copy,
  Flag,
  AlertTriangle,
  Replace,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { fmtBRL, fmtNum, fmtDateShort } from "@/lib/format";
import {
  fetchSalesOrders,
  fetchOrderLines,
  fetchSalesPersons,
  fetchCustomers,
  type SalesOrderRow,
  type SalesOrderLine,
  type CustomerRow,
} from "@/lib/cockpit-api";
import { isFreightOrder } from "@/lib/orders";
import type {
  B2BOrderMessage,
  B2BOrderItemNote,
  B2BItemFlag,
  B2BOrderMessageSummary,
} from "@/lib/b2b-admin";
import { useFetch } from "@/hooks/useFetch";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton } from "@/components/cockpit/DataState";
import { DateRangePicker } from "@/components/cockpit/DateRangePicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StatusKey = "aberto" | "fechado" | "cancelado";
type StatusFilter = "todos" | StatusKey;
type OriginFilter = "todos" | "portal" | "outros";
type ConfirmFilter = "todos" | "a_confirmar" | "confirmados";

const STATUS_TAGS = ["Em contato", "Aguardando cliente", "Resolvido"] as const;

// Funil de atendimento do canal e-commerce (Portal B2B), gerido pela equipe de
// vendas — independente do status do SAP (Aberto/Fechado/Cancelado).
type PipelineStatus =
  | "novo"
  | "em_analise"
  | "separacao"
  | "faturado"
  | "enviado"
  | "entregue"
  | "cancelado";

const PIPELINE: { key: PipelineStatus; label: string; cls: string; dot: string }[] = [
  { key: "novo", label: "Novo", cls: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  { key: "em_analise", label: "Em análise", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  { key: "separacao", label: "Em separação", cls: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  { key: "faturado", label: "Faturado", cls: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  { key: "enviado", label: "Enviado", cls: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500" },
  { key: "entregue", label: "Entregue", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  { key: "cancelado", label: "Cancelado", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
];

// Etapas em que o pedido já foi faturado — base do KPI "Valor faturado".
const INVOICED_STAGES: PipelineStatus[] = ["faturado", "enviado", "entregue"];

const PIPELINE_LABEL = Object.fromEntries(
  PIPELINE.map((p) => [p.key, p.label]),
) as Record<PipelineStatus, string>;
const PIPELINE_CLS = Object.fromEntries(
  PIPELINE.map((p) => [p.key, p.cls]),
) as Record<PipelineStatus, string>;

function OrderStageBadge({ status }: { status: PipelineStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        PIPELINE_CLS[status],
      )}
    >
      {PIPELINE_LABEL[status]}
    </span>
  );
}

function isPortalOrder(o: SalesOrderRow): boolean {
  return (o.comments ?? "").toLowerCase().includes("pedido via portal b2b");
}

function deriveStatus(o: SalesOrderRow): StatusKey {
  if (o.cancelled === "Y") return "cancelado";
  const closed =
    o.doc_status === "C" ||
    (o.document_status ?? "").toLowerCase().includes("close");
  return closed ? "fechado" : "aberto";
}

function StatusBadge({ status }: { status: StatusKey }) {
  const map: Record<StatusKey, string> = {
    aberto: "bg-emerald-50 text-emerald-700",
    fechado: "bg-gray-100 text-gray-600",
    cancelado: "bg-red-50 text-red-600",
  };
  const label = { aberto: "Aberto", fechado: "Fechado", cancelado: "Cancelado" }[status];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", map[status])}>
      {label}
    </span>
  );
}

export default function PedidosPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <PedidosContent />
    </Suspense>
  );
}

function PedidosContent() {
  const router = useRouter();
  const { range } = useDateRange();
  const { salesPersonCode, isComercial } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: ordersData, loading } = useFetch(
    () => fetchSalesOrders({ limit: 50000, dateFrom, dateTo, salesPerson: salesPersonCode }),
    [dateFrom, dateTo, salesPersonCode],
  );
  const { data: spData } = useFetch(() => fetchSalesPersons(), []);
  const { data: custData } = useFetch(() => fetchCustomers({ limit: 5000, active: true }), []);

  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);

  const spMap = useMemo(() => {
    const m = new Map<number, string>();
    if (spData?.items) for (const sp of spData.items) m.set(sp.SalesEmployeeCode, sp.SalesEmployeeName);
    return m;
  }, [spData]);

  const custMap = useMemo(() => {
    const m = new Map<string, CustomerRow>();
    if (custData?.data) for (const c of custData.data) m.set(c.card_code, c);
    return m;
  }, [custData]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  // Workspace centrado no canal e-commerce: começa na origem Portal B2B.
  const [originFilter, setOriginFilter] = useState<OriginFilter>("portal");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineStatus | "todos">("todos");
  const [confirmFilter, setConfirmFilter] = useState<ConfirmFilter>("todos");
  const [selected, setSelected] = useState<SalesOrderRow | null>(null);
  const [followCounts, setFollowCounts] = useState<Record<string, number>>({});
  const [statusMap, setStatusMap] = useState<Record<string, PipelineStatus>>({});
  const [confirmedMap, setConfirmedMap] = useState<Record<string, boolean>>({});
  // Pedidos cancelados na sessão (override otimista até a próxima sincronização).
  const [cancelledMap, setCancelledMap] = useState<Record<string, boolean>>({});
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [msgSummary, setMsgSummary] = useState<Record<string, B2BOrderMessageSummary>>({});
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);

  const loadPendingOrders = useCallback(() => {
    fetch(`/api/b2b-admin/pending-orders?status=pendente`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setPendingOrders(j.data.items ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadPendingOrders();
  }, [loadPendingOrders]);

  // Etapa efetiva no funil: status salvo ou "novo" como padrão. O funil agora
  // vale para TODOS os pedidos (qualquer origem), permitindo confirmar e
  // acompanhar tudo pelo painel.
  const effStatus = useCallback(
    (o: SalesOrderRow): PipelineStatus => {
      return statusMap[String(o.doc_entry)] ?? "novo";
    },
    [statusMap],
  );

  // Pedido confirmado (estado operacional local). Não confirmado = "a confirmar".
  const isConfirmed = useCallback(
    (o: SalesOrderRow): boolean => confirmedMap[String(o.doc_entry)] === true,
    [confirmedMap],
  );

  // Status SAP considerando o cancelamento otimista feito nesta sessão.
  const sapStatusOf = useCallback(
    (o: SalesOrderRow): StatusKey =>
      cancelledMap[String(o.doc_entry)] ? "cancelado" : deriveStatus(o),
    [cancelledMap],
  );

  // Registra o cancelamento na UI sem recarregar tudo.
  const markCancelled = useCallback((docEntry: number) => {
    setCancelledMap((m) => ({ ...m, [String(docEntry)]: true }));
    setStatusMap((m) => ({ ...m, [String(docEntry)]: "cancelado" }));
  }, []);

  // Pedidos filtrados por busca + status SAP (sem origem) — base para as abas.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => !isFreightOrder(o))
      .filter((o) => {
        if (statusFilter !== "todos" && deriveStatus(o) !== statusFilter) return false;
        if (q) {
          const hay = `${o.card_name} ${o.card_code} ${o.doc_num}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.doc_date < b.doc_date ? 1 : -1));
  }, [orders, search, statusFilter]);

  // Contadores por origem (para os badges das abas).
  const originCounts = useMemo(() => {
    let portal = 0;
    for (const o of scoped) if (isPortalOrder(o)) portal++;
    return { todos: scoped.length, portal, outros: scoped.length - portal };
  }, [scoped]);

  // Aplica a separação por origem (aba ativa).
  const byOrigin = useMemo(() => {
    if (originFilter === "portal") return scoped.filter(isPortalOrder);
    if (originFilter === "outros") return scoped.filter((o) => !isPortalOrder(o));
    return scoped;
  }, [scoped, originFilter]);

  // Aplica o filtro de confirmação (a confirmar / confirmados) sobre a origem.
  const byConfirm = useMemo(() => {
    if (confirmFilter === "a_confirmar") return byOrigin.filter((o) => !isConfirmed(o));
    if (confirmFilter === "confirmados") return byOrigin.filter((o) => isConfirmed(o));
    return byOrigin;
  }, [byOrigin, confirmFilter, isConfirmed]);

  // Quantos pedidos da origem ativa ainda estão "a confirmar".
  const toConfirmCount = useMemo(
    () => byOrigin.reduce((n, o) => (isConfirmed(o) ? n : n + 1), 0),
    [byOrigin, isConfirmed],
  );

  // Contagem por etapa do funil (chips do pipeline), respeitando o filtro de
  // confirmação ativo.
  const pipelineCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of byConfirm) {
      const s = effStatus(o);
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [byConfirm, effStatus]);

  // Aplica o filtro de etapa selecionada.
  const filtered = useMemo(() => {
    if (pipelineFilter === "todos") return byConfirm;
    return byConfirm.filter((o) => effStatus(o) === pipelineFilter);
  }, [byConfirm, pipelineFilter, effStatus]);

  // KPIs
  const kpis = useMemo(() => {
    const abertos = filtered.filter((o) => deriveStatus(o) === "aberto");
    // "Valor faturado": soma apenas pedidos já faturados (Faturado/Enviado/
    // Entregue), ignorando cancelados.
    const faturado = filtered.reduce(
      (s, o) =>
        sapStatusOf(o) !== "cancelado" && INVOICED_STAGES.includes(effStatus(o))
          ? s + (Number(o.doc_total) || 0)
          : s,
      0,
    );
    const aConfirmar = filtered.reduce((n, o) => (isConfirmed(o) ? n : n + 1), 0);
    const lastDate = filtered.reduce<string>((acc, o) => (o.doc_date > acc ? o.doc_date : acc), "");
    return { abertos: abertos.length, faturado, aConfirmar, lastDate };
  }, [filtered, isConfirmed, effStatus, sapStatusOf]);

  // Carrega anotações + status do funil para os pedidos da origem ativa
  // (independe do filtro de etapa, para manter contadores estáveis).
  const docEntriesKey = useMemo(
    () => byOrigin.map((o) => o.doc_entry).join(","),
    [byOrigin],
  );
  useEffect(() => {
    if (!docEntriesKey) {
      setFollowCounts({});
      setStatusMap({});
      return;
    }
    const ids = docEntriesKey.split(",").slice(0, 500).join(",");
    fetch(`/api/b2b-admin/orders/followups/counts?docEntries=${ids}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setFollowCounts(j.data.counts ?? {});
      })
      .catch(() => undefined);
    fetch(`/api/b2b-admin/orders/status?docEntries=${ids}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        setStatusMap(j.data.map ?? {});
        const detail = (j.data.detail ?? {}) as Record<
          string,
          { status: PipelineStatus; confirmed: boolean }
        >;
        const cmap: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(detail)) cmap[k] = v.confirmed === true;
        setConfirmedMap(cmap);
      })
      .catch(() => undefined);
    fetch(`/api/b2b-admin/orders/messages/summary?docEntries=${ids}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setMsgSummary(j.data.map ?? {});
      })
      .catch(() => undefined);
  }, [docEntriesKey]);

  // Confirma um pedido (estado local) e atualiza a UI sem recarregar tudo.
  const confirmOrder = useCallback((o: SalesOrderRow) => {
    setConfirmingId(o.doc_entry);
    fetch(`/api/b2b-admin/orders/${o.doc_entry}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardCode: o.card_code }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setConfirmedMap((m) => ({ ...m, [String(o.doc_entry)]: true }));
          setStatusMap((m) => ({
            ...m,
            [String(o.doc_entry)]: m[String(o.doc_entry)] ?? "novo",
          }));
        }
      })
      .finally(() => setConfirmingId(null));
  }, []);

  // Deep-link dos e-mails (?docEntry=…) abre o pedido automaticamente.
  const searchParams = useSearchParams();
  const deepLinkDocEntry = searchParams.get("docEntry");
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || !deepLinkDocEntry || orders.length === 0) return;
    const target = orders.find((o) => String(o.doc_entry) === String(deepLinkDocEntry));
    if (target) {
      setSelected(target);
      deepLinkedRef.current = true;
    }
  }, [deepLinkDocEntry, orders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gsn-700" />
            Pedidos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Acompanhe e interaja com os pedidos dos seus clientes
            {isComercial && " (filtrado pelos seus clientes)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pedidos/nova"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Nova venda
          </Link>
          <DateRangePicker />
        </div>
      </div>

      {/* Separação por origem (abas) */}
      <div className="inline-flex p-1 rounded-xl bg-gray-100 gap-1">
        <OriginTab
          active={originFilter === "portal"}
          onClick={() => setOriginFilter("portal")}
          icon={Store}
          label="Portal B2B"
          count={originCounts.portal}
          badge={pendingOrders.length > 0 ? pendingOrders.length : undefined}
          accent
        />
        <OriginTab
          active={originFilter === "outros"}
          onClick={() => setOriginFilter("outros")}
          label="Outras origens"
          count={originCounts.outros}
        />
        <OriginTab
          active={originFilter === "todos"}
          onClick={() => setOriginFilter("todos")}
          label="Todos"
          count={originCounts.todos}
        />
      </div>

      {/* Pedidos aguardando confirmação (somente na aba Portal B2B) */}
      {originFilter === "portal" && (
        <PendingOrdersSection
          orders={pendingOrders}
          onChanged={loadPendingOrders}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Package} label="Pedidos abertos" value={fmtNum(kpis.abertos)} tone="emerald" />
        <KpiCard icon={DollarSign} label="Valor faturado" value={fmtBRL(kpis.faturado)} tone="gsn" />
        <KpiCard icon={Hourglass} label="A confirmar" value={fmtNum(kpis.aConfirmar)} tone="amber" />
        <KpiCard
          icon={CalendarDays}
          label="Último pedido"
          value={kpis.lastDate ? fmtDateShort(kpis.lastDate) : "—"}
          tone="slate"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, código ou nº do pedido"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gsn-700/40 outline-none"
        >
          <option value="todos">Todos os status</option>
          <option value="aberto">Abertos</option>
          <option value="fechado">Fechados</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <div className="inline-flex p-1 rounded-lg bg-gray-100 gap-1 shrink-0">
          <ConfirmChip
            active={confirmFilter === "todos"}
            onClick={() => setConfirmFilter("todos")}
            label="Todos"
          />
          <ConfirmChip
            active={confirmFilter === "a_confirmar"}
            onClick={() => setConfirmFilter("a_confirmar")}
            label="A confirmar"
            count={toConfirmCount > 0 ? toConfirmCount : undefined}
            accent
          />
          <ConfirmChip
            active={confirmFilter === "confirmados"}
            onClick={() => setConfirmFilter("confirmados")}
            label="Confirmados"
          />
        </div>
      </div>

      {/* Pipeline e-commerce (etapas) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">
          <Layers className="w-3.5 h-3.5" /> Etapa
        </span>
        <StageChip
          active={pipelineFilter === "todos"}
          onClick={() => setPipelineFilter("todos")}
          label="Todas"
          count={byConfirm.length}
        />
        {PIPELINE.map((p) => (
          <StageChip
            key={p.key}
            active={pipelineFilter === p.key}
            onClick={() => setPipelineFilter(p.key)}
            label={p.label}
            count={pipelineCounts[p.key] ?? 0}
            dot={p.dot}
          />
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-gsn-700" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-500">
            {originFilter === "portal"
              ? "Nenhum pedido via Portal B2B no período/filtros selecionados"
              : "Nenhum pedido no período/filtros selecionados"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <Th>Pedido</Th>
                  <Th>Cliente</Th>
                  <Th>Vendedor</Th>
                  <Th>Data</Th>
                  <Th right>Valor</Th>
                  <Th>Origem</Th>
                  <Th>Etapa</Th>
                  <Th>Confirmação</Th>
                  <Th>Status SAP</Th>
                  <Th right>Notas</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((o) => {
                  const notes = followCounts[String(o.doc_entry)] ?? 0;
                  return (
                    <tr
                      key={o.doc_entry}
                      onClick={() => setSelected(o)}
                      className="border-b border-gray-50 hover:bg-gsn-50/40 transition cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">#{o.doc_num}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]">{o.card_name}</p>
                        <p className="text-xs text-gray-400">{o.card_code}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[140px]">
                        {o.sales_person_code != null ? spMap.get(o.sales_person_code) ?? `#${o.sales_person_code}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDateShort(o.doc_date)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                        {fmtBRL(Number(o.doc_total) || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {isPortalOrder(o) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            <Store className="w-3 h-3" /> Portal
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">SAP / outros</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStageBadge status={effStatus(o)} />
                      </td>
                      <td className="px-4 py-3">
                        {isConfirmed(o) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <Check className="w-3 h-3" /> Confirmado
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmOrder(o);
                            }}
                            disabled={confirmingId === o.doc_entry}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gsn-700 text-white hover:bg-gsn-800 disabled:opacity-60 transition"
                          >
                            {confirmingId === o.doc_entry ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Confirmar
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={sapStatusOf(o)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const sum = msgSummary[String(o.doc_entry)];
                          const hasNotes = notes > 0;
                          const hasMsgs = sum && sum.messages > 0;
                          if (!hasNotes && !hasMsgs)
                            return <span className="text-xs text-gray-300">—</span>;
                          return (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {sum && sum.openRequests > 0 && (
                                <span
                                  title="Solicitação do cliente em aberto"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700"
                                >
                                  <AlertTriangle className="w-3 h-3" /> {sum.openRequests}
                                </span>
                              )}
                              {hasMsgs && (
                                <span
                                  title="Mensagens na conversa do pedido"
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                    sum!.lastAuthor === "customer"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-gray-100 text-gray-600",
                                  )}
                                >
                                  <MessageSquare className="w-3 h-3" /> {sum!.messages}
                                </span>
                              )}
                              {hasNotes && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gsn-50 text-gsn-700">
                                  <StickyNote className="w-3 h-3" /> {notes}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <OrderDrawer
          order={selected}
          sellerName={
            selected.sales_person_code != null
              ? spMap.get(selected.sales_person_code) ?? null
              : null
          }
          customer={custMap.get(selected.card_code) ?? null}
          stage={effStatus(selected)}
          confirmed={isConfirmed(selected)}
          confirming={confirmingId === selected.doc_entry}
          sapStatus={sapStatusOf(selected)}
          onConfirm={() => confirmOrder(selected)}
          onClose={() => setSelected(null)}
          onCancelled={markCancelled}
          onFollowupChange={(docEntry, count) =>
            setFollowCounts((prev) => ({ ...prev, [String(docEntry)]: count }))
          }
          onStageChange={(docEntry, status) =>
            setStatusMap((prev) => ({ ...prev, [String(docEntry)]: status }))
          }
        />
      )}
    </div>
  );
}

function OriginTab({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  badge,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon?: typeof Store;
  label: string;
  count: number;
  badge?: number;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition",
        active
          ? accent
            ? "bg-white text-amber-700 shadow-sm"
            : "bg-white text-gsn-700 shadow-sm"
          : "text-gray-500 hover:text-gray-700",
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {label}
      <span
        className={cn(
          "ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold",
          active
            ? accent
              ? "bg-amber-100 text-amber-700"
              : "bg-gsn-50 text-gsn-700"
            : "bg-gray-200 text-gray-500",
        )}
      >
        {count}
      </span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-red-500">
          {badge}
        </span>
      )}
    </button>
  );
}

function ConfirmChip({
  active,
  onClick,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap",
        active
          ? accent
            ? "bg-white text-amber-700 shadow-sm"
            : "bg-white text-gsn-700 shadow-sm"
          : "text-gray-500 hover:text-gray-700",
      )}
    >
      {label}
      {count != null && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded-full text-xs font-semibold",
            active ? "bg-amber-100 text-amber-700" : "bg-amber-500 text-white",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface PendingOrderItem {
  sku: string;
  name: string | null;
  quantity: number;
  stockAvailable?: number | null;
  exceedsStock?: boolean;
}

interface PendingOrder {
  id: number;
  card_code: string;
  card_name: string | null;
  items: PendingOrderItem[];
  notes: string | null;
  total_quantity: number;
  has_stock_alert?: boolean;
  created_by: string | null;
  created_at: string;
}

function PendingOrdersSection({
  orders,
  onChanged,
}: {
  orders: PendingOrder[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [review, setReview] = useState<PendingOrder | null>(null);
  const [reject, setReject] = useState<PendingOrder | null>(null);

  const confirmOrder = async (id: number) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/b2b-admin/pending-orders/${id}/confirm`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao confirmar");
      toast.success(
        `Pedido confirmado e enviado ao SAP (#${j.data.docNum ?? j.data.docEntry}). Aparecerá na lista após a sincronização.`,
      );
      setReview(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao confirmar pedido");
    } finally {
      setBusy(null);
    }
  };

  const rejectOrder = async (id: number, reason: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/b2b-admin/pending-orders/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao recusar");
      toast.success("Pedido recusado. O cliente foi notificado.");
      setReject(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao recusar pedido");
    } finally {
      setBusy(null);
    }
  };

  if (orders.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Hourglass className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-amber-800">
            Aguardando confirmação ({orders.length})
          </h2>
          <span className="hidden sm:inline text-xs text-amber-700/80">
            Pedidos feitos no Portal B2B só vão ao SAP após sua confirmação.
          </span>
        </div>
        <div className="space-y-2">
          {orders.map((o) => (
            <div
              key={o.id}
              onClick={() => setReview(o)}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-white border border-amber-100 p-3 cursor-pointer hover:border-amber-300 hover:shadow-sm transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono text-gray-500">#{o.id}</span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {o.card_name ?? o.card_code}
                  </span>
                  <span className="text-xs text-gray-400">{o.card_code}</span>
                  {o.has_stock_alert && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700"
                      title="Um ou mais itens foram pedidos acima do estoque disponível"
                    >
                      <AlertTriangle className="w-3 h-3" /> Acima do estoque
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fmtDateShort(o.created_at)} · {o.items?.length ?? 0} item(ns) ·{" "}
                  {fmtNum(o.total_quantity)} un
                </p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {(o.items ?? [])
                    .map((it) => `${it.quantity}× ${it.name ?? it.sku}`)
                    .join(", ")}
                </p>
                {o.notes && (
                  <p className="text-xs text-gray-500 mt-1 italic">Obs: {o.notes}</p>
                )}
              </div>
              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setReject(o)}
                  disabled={busy === o.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" /> Recusar
                </button>
                <button
                  onClick={() => setReview(o)}
                  disabled={busy === o.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {busy === o.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Revisar e enviar ao SAP
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {review && (
        <PendingReviewModal
          order={review}
          busy={busy === review.id}
          onConfirm={() => confirmOrder(review.id)}
          onClose={() => {
            if (busy == null) setReview(null);
          }}
        />
      )}
      {reject && (
        <RejectReasonModal
          order={reject}
          busy={busy === reject.id}
          onReject={(reason) => rejectOrder(reject.id, reason)}
          onClose={() => {
            if (busy == null) setReject(null);
          }}
        />
      )}
    </>
  );
}

// Modal de revisão do pedido pendente antes de oficializar no SAP B1. Dá ao
// comercial a chance de conferir itens/quantidades/observação do cliente e
// deixa explícito que a confirmação cria o documento no ERP (com os preços da
// tabela do cliente).
function PendingReviewModal({
  order,
  busy,
  onConfirm,
  onClose,
}: {
  order: PendingOrder;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const totalUnits =
    order.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) ?? 0;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                <Store className="w-3 h-3" /> Portal B2B
              </span>
              <span className="text-sm font-mono text-gray-500">#{order.id}</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mt-1 truncate">
              {order.card_name ?? order.card_code}
            </h3>
            <p className="text-xs text-gray-400">{order.card_code}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-50 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Data da solicitação</p>
              <p className="text-gray-800">{fmtDateShort(order.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Itens / unidades</p>
              <p className="text-gray-800">
                {order.items?.length ?? 0} item(ns) · {fmtNum(totalUnits)} un
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Itens do pedido
            </p>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-50">
              {(order.items ?? []).map((it, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between px-3 py-2",
                    it.exceedsStock && "bg-red-50/70",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{it.name ?? it.sku}</p>
                    <p className="text-xs text-gray-400 font-mono">{it.sku}</p>
                    {it.exceedsStock && (
                      <p className="text-[11px] text-red-600 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Acima do estoque
                        {typeof it.stockAvailable === "number"
                          ? ` · disponível: ${fmtNum(it.stockAvailable)} un`
                          : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium whitespace-nowrap ml-3",
                      it.exceedsStock ? "text-red-700" : "text-gray-900",
                    )}
                  >
                    {fmtNum(it.quantity)} un
                  </span>
                </div>
              ))}
            </div>
          </div>

          {order.has_stock_alert && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Este pedido contém itens <strong>acima do estoque disponível</strong>. Alinhe
                com o cliente (prazo/parcial) antes de confirmar no SAP.
              </span>
            </div>
          )}

          {order.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Observação do cliente
              </p>
              <p className="text-sm text-gray-600 italic rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                {order.notes}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-800">
            <DollarSign className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Ao confirmar, o pedido é criado no <strong>SAP B1</strong> com os preços
              da tabela do cliente e entra no funil de atendimento. Esta ação é
              registrada no ERP e notifica o cliente.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Confirmar e criar no SAP
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de recusa com motivo (substitui o window.prompt). O motivo é enviado
// ao cliente por e-mail.
function RejectReasonModal({
  order,
  busy,
  onReject,
  onClose,
}: {
  order: PendingOrder;
  busy: boolean;
  onReject: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-600" /> Recusar solicitação #{order.id}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {order.card_name ?? order.card_code}
          </p>
        </div>
        <div className="p-5 space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Motivo da recusa (opcional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Ex.: item sem estoque, quantidade indisponível, cliente com pendência…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
          />
          <p className="text-xs text-gray-400">
            O cliente será notificado por e-mail com o motivo informado.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onReject(reason)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Ban className="w-4 h-4" />
            )}
            Recusar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

function StageChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition shrink-0",
        active
          ? "border-gsn-700 bg-gsn-50 text-gsn-800"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
      )}
    >
      {dot && <span className={cn("w-2 h-2 rounded-full", dot)} />}
      {label}
      <span className="text-gray-400 font-semibold">{count}</span>
    </button>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  tone: "emerald" | "gsn" | "amber" | "slate";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    gsn: "bg-gsn-50 text-gsn-700",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tones[tone])}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

interface Followup {
  id: number;
  doc_entry: number;
  status_tag: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
}

// Etapas do funil em que o pedido já foi (ou está sendo) faturado — não pode
// mais ser cancelado.
const NON_CANCELLABLE_STAGES: PipelineStatus[] = [
  "faturado",
  "enviado",
  "entregue",
  "cancelado",
];

function OrderDrawer({
  order,
  sellerName,
  customer,
  stage,
  confirmed,
  confirming,
  sapStatus,
  onConfirm,
  onClose,
  onCancelled,
  onFollowupChange,
  onStageChange,
}: {
  order: SalesOrderRow;
  sellerName: string | null;
  customer: CustomerRow | null;
  stage: PipelineStatus | null;
  confirmed: boolean;
  confirming: boolean;
  sapStatus: StatusKey;
  onConfirm: () => void;
  onClose: () => void;
  onCancelled: (docEntry: number) => void;
  onFollowupChange: (docEntry: number, count: number) => void;
  onStageChange: (docEntry: number, status: PipelineStatus) => void;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<SalesOrderLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [note, setNote] = useState("");
  const [statusTag, setStatusTag] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStatus | null>(stage);
  const [stageSaving, setStageSaving] = useState<PipelineStatus | null>(null);
  const [itemNotes, setItemNotes] = useState<B2BOrderItemNote[]>([]);
  const [messages, setMessages] = useState<B2BOrderMessage[]>([]);
  const [reply, setReply] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Só é possível cancelar enquanto não faturado: SAP aberto (não fechado/
  // cancelado) e etapa do funil fora de faturado/enviado/entregue.
  const cancellable =
    sapStatus === "aberto" &&
    !(currentStage != null && NON_CANCELLABLE_STAGES.includes(currentStage));

  useEffect(() => {
    setCurrentStage(stage);
  }, [stage, order.doc_entry]);

  useEffect(() => {
    setLinesLoading(true);
    fetchOrderLines(order.doc_entry)
      .then((r) => setLines(r.lines ?? []))
      .catch(() => setLines([]))
      .finally(() => setLinesLoading(false));
  }, [order.doc_entry]);

  const loadFollowups = useCallback(() => {
    fetch(`/api/b2b-admin/orders/${order.doc_entry}/followups`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setFollowups(j.data.items ?? []);
      })
      .catch(() => undefined);
  }, [order.doc_entry]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  const loadItemNotes = useCallback(() => {
    fetch(`/api/b2b-admin/orders/${order.doc_entry}/item-notes`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setItemNotes(j.data.items ?? []);
      })
      .catch(() => undefined);
  }, [order.doc_entry]);

  const loadMessages = useCallback(() => {
    fetch(`/api/b2b-admin/orders/${order.doc_entry}/messages`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setMessages(j.data.messages ?? []);
      })
      .catch(() => undefined);
  }, [order.doc_entry]);

  useEffect(() => {
    loadItemNotes();
    loadMessages();
  }, [loadItemNotes, loadMessages]);

  const phone = customer?.phone?.replace(/\D/g, "") ?? "";
  const waLink = phone ? `https://wa.me/55${phone}` : null;

  // Notas por SKU (para exibir junto de cada linha).
  const notesBySku = useMemo(() => {
    const m = new Map<string, B2BOrderItemNote[]>();
    for (const n of itemNotes) {
      const arr = m.get(n.sku) ?? [];
      arr.push(n);
      m.set(n.sku, arr);
    }
    return m;
  }, [itemNotes]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) return;
    setReplySaving(true);
    try {
      const res = await fetch(`/api/b2b-admin/orders/${order.doc_entry}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao enviar");
      setReply("");
      setMessages((prev) => [...prev, j.data.message]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar resposta");
    } finally {
      setReplySaving(false);
    }
  };

  const resolveRequest = async (id: number, status: "resolvido" | "recusado") => {
    setResolvingId(id);
    try {
      const res = await fetch(
        `/api/b2b-admin/orders/${order.doc_entry}/requests/${id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro");
      setMessages((prev) => prev.map((m) => (m.id === id ? j.data.message : m)));
      toast.success(status === "resolvido" ? "Solicitação atendida" : "Solicitação recusada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao resolver");
    } finally {
      setResolvingId(null);
    }
  };

  const addItemFlag = async (sku: string, flag: B2BItemFlag, noteText: string) => {
    try {
      const res = await fetch(`/api/b2b-admin/orders/${order.doc_entry}/item-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, flag, note: noteText || null }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro");
      setItemNotes((prev) => [j.data.item, ...prev]);
      toast.success("Sinalização adicionada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao sinalizar item");
    }
  };

  const removeItemFlag = async (id: number) => {
    try {
      await fetch(`/api/b2b-admin/orders/${order.doc_entry}/item-notes/${id}`, {
        method: "DELETE",
      });
      setItemNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error("Erro ao remover sinalização");
    }
  };

  // Duplicar pedido: leva cliente + itens para a venda assistida.
  const duplicateOrder = () => {
    const payload = {
      customer,
      cardCode: order.card_code,
      cardName: order.card_name,
      items: lines.map((l) => ({
        sku: l.ItemCode,
        name: l.ItemDescription ?? l.ItemCode,
        quantity: Number(l.Quantity) || 1,
      })),
    };
    try {
      sessionStorage.setItem("wms_duplicate_order", JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    router.push("/pedidos/nova?duplicate=1");
  };

  const addFollowup = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/b2b-admin/orders/${order.doc_entry}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim(),
          statusTag: statusTag || null,
          cardCode: order.card_code,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao salvar anotação");
      setNote("");
      setStatusTag("");
      const next = [j.data.followup, ...followups];
      setFollowups(next);
      onFollowupChange(order.doc_entry, next.length);
      toast.success("Anotação registrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar anotação");
    } finally {
      setSaving(false);
    }
  };

  const changeStage = async (next: PipelineStatus) => {
    if (next === currentStage || stageSaving) return;
    setStageSaving(next);
    try {
      const res = await fetch(`/api/b2b-admin/orders/${order.doc_entry}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, cardCode: order.card_code }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao atualizar etapa");
      setCurrentStage(next);
      onStageChange(order.doc_entry, next);
      loadFollowups();
      toast.success(`Etapa alterada para “${PIPELINE_LABEL[next]}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar etapa");
    } finally {
      setStageSaving(null);
    }
  };

  // Cancela o pedido no SAP (Service Layer). O gateway aplica a regra de
  // "faturado não cancela" e devolve 409 quando não permitido.
  const cancelOrder = async (reason: string) => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/b2b-admin/orders/${order.doc_entry}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao cancelar pedido");
      setCurrentStage("cancelado");
      onCancelled(order.doc_entry);
      loadFollowups();
      toast.success("Pedido cancelado no SAP. O cliente foi notificado.");
      setCancelOpen(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar pedido");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-500">#{order.doc_num}</span>
              <StatusBadge status={sapStatus} />
              {isPortalOrder(order) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                  <Store className="w-3 h-3" /> Portal
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 mt-1">{order.card_name}</h2>
            <p className="text-xs text-gray-400">{order.card_code}</p>
          </div>
          <div className="flex items-center gap-1">
            {cancellable && (
              <button
                onClick={() => setCancelOpen(true)}
                title="Cancelar pedido no SAP"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200"
              >
                <Ban className="w-3.5 h-3.5" /> Cancelar
              </button>
            )}
            <button
              onClick={duplicateOrder}
              title="Duplicar pedido (venda assistida)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gsn-700 hover:bg-gsn-50 border border-gsn-200"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicar
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Data do pedido" value={fmtDateShort(order.doc_date)} />
            <Info label="Entrega" value={order.doc_due_date ? fmtDateShort(order.doc_due_date) : "—"} />
            <Info label="Vendedor" value={sellerName ?? "—"} />
            <Info label="Valor total" value={fmtBRL(Number(order.doc_total) || 0)} strong />
          </div>

          {/* Confirmação operacional (estado local, não altera o SAP) */}
          <div
            className={cn(
              "rounded-lg border p-3 flex items-center justify-between gap-3",
              confirmed ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40",
            )}
          >
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Confirmação
              </p>
              <p className="text-sm text-gray-700 mt-0.5">
                {confirmed
                  ? "Pedido confirmado pela equipe de vendas."
                  : "Pedido ainda não confirmado."}
              </p>
            </div>
            {confirmed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 shrink-0">
                <Check className="w-3.5 h-3.5" /> Confirmado
              </span>
            ) : (
              <button
                onClick={onConfirm}
                disabled={confirming}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gsn-700 text-white hover:bg-gsn-800 disabled:opacity-60 transition shrink-0"
              >
                {confirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Confirmar
              </button>
            )}
          </div>

          {/* Etapa do funil e-commerce */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Etapa do pedido
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE.map((p) => {
                const active = currentStage === p.key;
                const loading = stageSaving === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => changeStage(p.key)}
                    disabled={stageSaving != null}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition disabled:opacity-60",
                      active
                        ? `${p.cls} border-transparent ring-1 ring-inset ring-current`
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300",
                    )}
                  >
                    {loading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className={cn("w-2 h-2 rounded-full", p.dot)} />
                    )}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contato */}
          {customer && (
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contato</p>
              <div className="flex flex-wrap gap-2">
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                  >
                    <Phone className="w-3.5 h-3.5" /> {customer.phone}
                  </a>
                )}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                  >
                    <Mail className="w-3.5 h-3.5" /> {customer.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Itens */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Itens do pedido
            </p>
            {linesLoading ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="w-4 h-4 animate-spin text-gsn-700" />
              </div>
            ) : lines.length === 0 ? (
              <p className="text-sm text-gray-400">Linhas não disponíveis.</p>
            ) : (
              <div className="space-y-1.5">
                {lines.map((l, i) => (
                  <ItemLine
                    key={i}
                    line={l}
                    flags={notesBySku.get(l.ItemCode ?? "") ?? []}
                    onAddFlag={(flag, noteText) => addItemFlag(l.ItemCode ?? "", flag, noteText)}
                    onRemoveFlag={removeItemFlag}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Conversa com o cliente (thread compartilhada) */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Conversa com o cliente
            </p>
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 mb-3">Nenhuma mensagem ainda.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {messages.map((m) => {
                  const fromCustomer = m.authorType === "customer";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg p-2.5 text-sm border",
                        fromCustomer
                          ? "bg-amber-50/60 border-amber-100"
                          : "bg-gsn-50/60 border-gsn-100",
                      )}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700">
                          {fromCustomer ? m.authorName ?? "Cliente" : `${m.authorName ?? "Vendedor"} (você)`}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(m.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {m.kind !== "message" && (
                        <span
                          className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium mb-1",
                            m.kind === "cancel_request"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800",
                          )}
                        >
                          {m.kind === "cancel_request" ? "Cancelamento" : "Alteração"}
                        </span>
                      )}
                      <p className="text-gray-700 whitespace-pre-wrap">{m.body}</p>
                      {m.status && (
                        <div className="mt-1.5 flex items-center gap-2">
                          {m.status === "aberto" ? (
                            <>
                              <button
                                onClick={() => resolveRequest(m.id, "resolvido")}
                                disabled={resolvingId === m.id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {resolvingId === m.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                Atender
                              </button>
                              <button
                                onClick={() => resolveRequest(m.id, "recusado")}
                                disabled={resolvingId === m.id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                              >
                                <Ban className="w-3 h-3" /> Recusar
                              </button>
                            </>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium",
                                m.status === "resolvido"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-200 text-gray-600",
                              )}
                            >
                              {m.status === "resolvido" ? "Atendida" : "Recusada"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="rounded-lg border border-gray-200 p-2.5">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder="Responder ao cliente…"
                className="w-full text-sm border-0 focus:ring-0 outline-none resize-none p-0 mb-2"
              />
              <div className="flex justify-end">
                <button
                  onClick={sendReply}
                  disabled={replySaving || !reply.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50"
                >
                  {replySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Responder
                </button>
              </div>
            </div>
          </div>

          {/* Follow-ups */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Acompanhamento interno
            </p>

            <div className="rounded-lg border border-gray-200 p-3 mb-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Adicionar anotação ou registro de contato…"
                className="w-full text-sm border-0 focus:ring-0 outline-none resize-none p-0 mb-2"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={statusTag}
                  onChange={(e) => setStatusTag(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
                >
                  <option value="">Sem status</option>
                  {STATUS_TAGS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={addFollowup}
                  disabled={saving || !note.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Registrar
                </button>
              </div>
            </div>

            {followups.length === 0 ? (
              <p className="text-sm text-gray-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Nenhuma anotação ainda.
              </p>
            ) : (
              <div className="space-y-2.5">
                {followups.map((f) => (
                  <div key={f.id} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {f.created_by ?? "—"}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(f.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {f.status_tag && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gsn-50 text-gsn-700 mb-1">
                        {f.status_tag}
                      </span>
                    )}
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{f.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {cancelOpen && (
        <CancelOrderModal
          docNum={order.doc_num}
          cardName={order.card_name}
          busy={cancelling}
          onCancelOrder={cancelOrder}
          onClose={() => {
            if (!cancelling) setCancelOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Modal de confirmação do cancelamento de um pedido no SAP (com motivo opcional
// enviado ao cliente por e-mail).
function CancelOrderModal({
  docNum,
  cardName,
  busy,
  onCancelOrder,
  onClose,
}: {
  docNum: number;
  cardName: string | null;
  busy: boolean;
  onCancelOrder: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-600" /> Cancelar pedido #{docNum}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{cardName ?? ""}</p>
        </div>
        <div className="p-5 space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              O pedido será <strong>cancelado no SAP B1</strong>. Esta ação não pode
              ser desfeita. Pedidos já faturados não podem ser cancelados.
            </span>
          </div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Motivo do cancelamento (opcional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Ex.: solicitação do cliente, pedido duplicado, erro de digitação…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
          />
          <p className="text-xs text-gray-400">
            O cliente será notificado por e-mail sobre o cancelamento.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            onClick={() => onCancelOrder(reason)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Ban className="w-4 h-4" />
            )}
            Cancelar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={cn("text-gray-800", strong ? "font-semibold text-gsn-700" : "")}>{value}</p>
    </div>
  );
}

const ITEM_FLAG_META: Record<
  B2BItemFlag,
  { label: string; cls: string; icon: typeof Flag }
> = {
  falta: { label: "Em falta", cls: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  substituicao: { label: "Substituir", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Replace },
  observacao: { label: "Observação", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Flag },
};

function ItemLine({
  line,
  flags,
  onAddFlag,
  onRemoveFlag,
}: {
  line: SalesOrderLine;
  flags: B2BOrderItemNote[];
  onAddFlag: (flag: B2BItemFlag, note: string) => void;
  onRemoveFlag: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [flag, setFlag] = useState<B2BItemFlag>("falta");
  const [note, setNote] = useState("");

  const submit = () => {
    onAddFlag(flag, note.trim());
    setNote("");
    setOpen(false);
  };

  return (
    <div className="border-b border-gray-50 py-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="min-w-0">
          <p className="text-gray-800 truncate">{line.ItemDescription ?? line.ItemCode}</p>
          <p className="text-xs text-gray-400">
            {fmtNum(line.Quantity ?? 0)} un × {fmtBRL(line.UnitPrice ?? line.Price ?? 0)}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <span className="font-medium text-gray-900 whitespace-nowrap">
            {fmtBRL(line.LineTotal ?? 0)}
          </span>
          <button
            onClick={() => setOpen((v) => !v)}
            title="Sinalizar item"
            className="p-1 rounded text-gray-400 hover:text-gsn-700 hover:bg-gsn-50"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {flags.map((f) => {
            const meta = ITEM_FLAG_META[f.flag];
            const Icon = meta.icon;
            return (
              <span
                key={f.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
                  meta.cls,
                )}
              >
                <Icon className="w-3 h-3" />
                {meta.label}
                {f.note ? `: ${f.note}` : ""}
                <button
                  onClick={() => onRemoveFlag(f.id)}
                  className="ml-0.5 hover:opacity-70"
                  title="Remover"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 p-2 space-y-2">
          <div className="flex gap-1.5">
            {(Object.keys(ITEM_FLAG_META) as B2BItemFlag[]).map((k) => (
              <button
                key={k}
                onClick={() => setFlag(k)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium border transition",
                  flag === k
                    ? "bg-gsn-700 text-white border-transparent"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300",
                )}
              >
                {ITEM_FLAG_META[k].label}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação (opcional)…"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-gsn-700/30"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-gsn-700 hover:bg-gsn-800"
            >
              <Plus className="w-3 h-3" /> Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
