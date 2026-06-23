"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import {
  Search,
  ShoppingCart,
  DollarSign,
  Loader2,
  Phone,
  Mail,
  MessageCircle,
  X,
  Clock,
  Package,
  Store,
  CalendarDays,
  Send,
  StickyNote,
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

const STATUS_TAGS = ["Em contato", "Aguardando cliente", "Resolvido"] as const;

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
  const [originFilter, setOriginFilter] = useState<OriginFilter>("todos");
  const [selected, setSelected] = useState<SalesOrderRow | null>(null);
  const [followCounts, setFollowCounts] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => !isFreightOrder(o))
      .filter((o) => {
        if (statusFilter !== "todos" && deriveStatus(o) !== statusFilter) return false;
        if (originFilter === "portal" && !isPortalOrder(o)) return false;
        if (originFilter === "outros" && isPortalOrder(o)) return false;
        if (q) {
          const hay = `${o.card_name} ${o.card_code} ${o.doc_num}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.doc_date < b.doc_date ? 1 : -1));
  }, [orders, search, statusFilter, originFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const abertos = filtered.filter((o) => deriveStatus(o) === "aberto");
    const total = filtered.reduce((s, o) => s + (Number(o.doc_total) || 0), 0);
    const portal = filtered.filter(isPortalOrder).length;
    const lastDate = filtered.reduce<string>((acc, o) => (o.doc_date > acc ? o.doc_date : acc), "");
    return { abertos: abertos.length, total, portal, lastDate };
  }, [filtered]);

  // Contagem de anotações por pedido (badges)
  const docEntriesKey = useMemo(
    () => filtered.map((o) => o.doc_entry).join(","),
    [filtered],
  );
  useEffect(() => {
    if (!docEntriesKey) {
      setFollowCounts({});
      return;
    }
    const ids = docEntriesKey.split(",").slice(0, 500).join(",");
    fetch(`/api/b2b-admin/orders/followups/counts?docEntries=${ids}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setFollowCounts(j.data.counts ?? {});
      })
      .catch(() => undefined);
  }, [docEntriesKey]);

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
        <DateRangePicker />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Package} label="Pedidos abertos" value={fmtNum(kpis.abertos)} tone="emerald" />
        <KpiCard icon={DollarSign} label="Valor total" value={fmtBRL(kpis.total)} tone="gsn" />
        <KpiCard icon={Store} label="Via Portal B2B" value={fmtNum(kpis.portal)} tone="amber" />
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
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value as OriginFilter)}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gsn-700/40 outline-none"
        >
          <option value="todos">Todas as origens</option>
          <option value="portal">Portal B2B</option>
          <option value="outros">Outros</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-gsn-700" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-500">
            Nenhum pedido no período/filtros selecionados
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
                  <Th>Status</Th>
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
                        <StatusBadge status={deriveStatus(o)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {notes > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gsn-50 text-gsn-700">
                            <StickyNote className="w-3 h-3" /> {notes}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
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
          onClose={() => setSelected(null)}
          onFollowupChange={(docEntry, count) =>
            setFollowCounts((prev) => ({ ...prev, [String(docEntry)]: count }))
          }
        />
      )}
    </div>
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

function OrderDrawer({
  order,
  sellerName,
  customer,
  onClose,
  onFollowupChange,
}: {
  order: SalesOrderRow;
  sellerName: string | null;
  customer: CustomerRow | null;
  onClose: () => void;
  onFollowupChange: (docEntry: number, count: number) => void;
}) {
  const [lines, setLines] = useState<SalesOrderLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [note, setNote] = useState("");
  const [statusTag, setStatusTag] = useState<string>("");
  const [saving, setSaving] = useState(false);

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

  const phone = customer?.phone?.replace(/\D/g, "") ?? "";
  const waLink = phone ? `https://wa.me/55${phone}` : null;

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

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-500">#{order.doc_num}</span>
              <StatusBadge status={deriveStatus(order)} />
              {isPortalOrder(order) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                  <Store className="w-3 h-3" /> Portal
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 mt-1">{order.card_name}</h2>
            <p className="text-xs text-gray-400">{order.card_code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Data do pedido" value={fmtDateShort(order.doc_date)} />
            <Info label="Entrega" value={order.doc_due_date ? fmtDateShort(order.doc_due_date) : "—"} />
            <Info label="Vendedor" value={sellerName ?? "—"} />
            <Info label="Valor total" value={fmtBRL(Number(order.doc_total) || 0)} strong />
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
                  <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 py-1.5">
                    <div className="min-w-0">
                      <p className="text-gray-800 truncate">{l.ItemDescription ?? l.ItemCode}</p>
                      <p className="text-xs text-gray-400">
                        {fmtNum(l.Quantity ?? 0)} un × {fmtBRL(l.UnitPrice ?? l.Price ?? 0)}
                      </p>
                    </div>
                    <span className="font-medium text-gray-900 whitespace-nowrap ml-3">
                      {fmtBRL(l.LineTotal ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-ups */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Acompanhamento
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
