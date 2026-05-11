"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import {
  Search,
  Radio,
  Users,
  DollarSign,
  ShoppingCart,
  Tag,
  Clock,
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowUpRight,
  Phone,
  Mail,
  Building,
  X,
  ChevronRight,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fmtBRL, fmtNum, fmtDateShort, STATE_TO_REGION } from "@/lib/format";
import {
  fetchCustomers,
  fetchSalesOrders,
  type CustomerRow,
  type SalesOrderRow,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { useRdContactMarketing } from "@/hooks/useCockpitQueries";
import { useDateRange } from "@/contexts/DateRangeContext";
import { useSalesPersonFilter } from "@/contexts/SalesPersonFilterContext";
import { LoadingSkeleton } from "@/components/cockpit/DataState";
import { DateRangePicker } from "@/components/cockpit/DateRangePicker";

function daysSince(dateStr: string): number {
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
  return Math.max(0, differenceInDays(new Date(), d));
}

function recencyBadge(days: number) {
  if (days <= 7) return { label: "Recente", cls: "bg-emerald-100 text-emerald-700" };
  if (days <= 30) return { label: `${days}d`, cls: "bg-amber-100 text-amber-700" };
  if (days <= 90) return { label: `${days}d`, cls: "bg-orange-100 text-orange-700" };
  return { label: `${days}d`, cls: "bg-red-100 text-red-700" };
}

interface ClientProfile {
  cardCode: string;
  cardName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  fat: number;
  pedidos: number;
  ticket: number;
  lastOrderDate: string | null;
  daysInactive: number;
}

function buildProfiles(
  customers: CustomerRow[],
  orders: SalesOrderRow[],
): ClientProfile[] {
  const orderMap = new Map<string, { fat: number; pedidos: number; lastDate: string }>();
  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    const cur = orderMap.get(o.card_code) ?? { fat: 0, pedidos: 0, lastDate: "" };
    cur.fat += Number(o.doc_total) || 0;
    cur.pedidos += 1;
    if (o.doc_date > cur.lastDate) cur.lastDate = o.doc_date;
    orderMap.set(o.card_code, cur);
  }

  return customers
    .filter((c) => c.is_active)
    .map((c) => {
      const o = orderMap.get(c.card_code);
      const lastDate = o?.lastDate ?? null;
      return {
        cardCode: c.card_code,
        cardName: c.card_name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        state: c.state,
        isActive: c.is_active,
        fat: o?.fat ?? 0,
        pedidos: o?.pedidos ?? 0,
        ticket: o && o.pedidos > 0 ? o.fat / o.pedidos : 0,
        lastOrderDate: lastDate,
        daysInactive: lastDate ? daysSince(lastDate) : 999,
      };
    })
    .sort((a, b) => b.fat - a.fat);
}

export default function CrmPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <CrmContent />
    </Suspense>
  );
}

function CrmContent() {
  const { label: periodoLabel, range } = useDateRange();
  const { salesPersonCode } = useSalesPersonFilter();
  const dateFrom = format(range.from, "yyyy-MM-dd");
  const dateTo = format(range.to, "yyyy-MM-dd");

  const { data: custData, loading: l1 } = useFetch(
    () => fetchCustomers({ limit: 500, active: true }),
    [],
  );
  const { data: ordersData, loading: l2 } = useFetch(
    () => fetchSalesOrders({ limit: 50000, dateFrom, dateTo, salesPerson: salesPersonCode }),
    [dateFrom, dateTo, salesPersonCode],
  );

  const customers = useMemo(() => custData?.data ?? [], [custData]);
  const orders = useMemo(() => ordersData?.items ?? [], [ordersData]);
  const profiles = useMemo(
    () => buildProfiles(customers, orders),
    [customers, orders],
  );

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientProfile | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles.slice(0, 50);
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.cardName.toLowerCase().includes(q) ||
        p.cardCode.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)),
    ).slice(0, 50);
  }, [profiles, search]);

  const loading = l1 || l2;

  const totalFat = useMemo(
    () => profiles.reduce((s, p) => s + p.fat, 0),
    [profiles],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-violet-100"><Radio className="w-5 h-5 text-violet-700" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Central do Cliente</h1>
            <p className="text-sm text-gray-500">Carregando dados SAP + RD Station…</p>
          </div>
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-100">
              <Radio className="w-5 h-5 text-violet-700" />
            </div>
            Central do Cliente
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>{periodoLabel}</span>
            <span className="text-gray-300">·</span>
            <span>{profiles.length} clientes ativos</span>
            <span className="text-gray-300">·</span>
            <span>SAP + RD Station</span>
          </p>
        </div>
        <DateRangePicker variant="compact" idPrefix="crm-date" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Clientes", value: fmtNum(profiles.length), icon: Users, color: "text-violet-600" },
          { label: "Faturamento", value: fmtBRL(totalFat), icon: DollarSign, color: "text-emerald-600" },
          { label: "Pedidos", value: fmtNum(orders.filter((o) => o.cancelled !== "Y").length), icon: ShoppingCart, color: "text-sky-600" },
          { label: "Com e-mail", value: fmtNum(profiles.filter((p) => p.email && p.email.includes("@")).length), icon: Mail, color: "text-pink-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{k.label}</span>
            </div>
            <span className={`text-xl font-bold ${k.color} block tabular-nums`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Main layout: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: search + list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, código ou e-mail…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400/60 shadow-sm"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="max-h-[calc(100vh-380px)] overflow-y-auto divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  Nenhum cliente encontrado
                </div>
              ) : (
                filtered.map((p) => {
                  const isActive = selected?.cardCode === p.cardCode;
                  const rec = p.lastOrderDate ? recencyBadge(p.daysInactive) : null;
                  const hasEmail = Boolean(p.email && p.email.includes("@"));

                  return (
                    <button
                      key={p.cardCode}
                      onClick={() => setSelected(p)}
                      className={`w-full text-left px-4 py-3 motion-safe:transition-all group ${
                        isActive
                          ? "bg-violet-50 border-l-2 border-l-violet-500"
                          : "hover:bg-gray-50 border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isActive ? "text-violet-900" : "text-gray-900"}`}>
                            {p.cardName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                            <span className="font-mono">{p.cardCode}</span>
                            {p.state && <span>· {p.city ?? ""} {p.state}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-emerald-600 tabular-nums">{fmtBRL(p.fat, 0)}</p>
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            {hasEmail && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-400" title="Tem e-mail (RD)" />
                            )}
                            {rec && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${rec.cls}`}>
                                {rec.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-500">
              {filtered.length} de {profiles.length} clientes
            </div>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-3">
          {selected ? (
            <ClientDetailPanel
              profile={selected}
              orders={orders}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 text-center">
              <Radio className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">
                Selecione um cliente na lista
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Dados SAP + RD Station serão exibidos aqui
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Client Detail Panel — SAP data + RD enrichment
   ════════════════════════════════════════════════════ */

function ClientDetailPanel({
  profile,
  orders,
  onClose,
}: {
  profile: ClientProfile;
  orders: SalesOrderRow[];
  onClose: () => void;
}) {
  const clientOrders = useMemo(
    () =>
      orders
        .filter((o) => o.card_code === profile.cardCode && o.cancelled !== "Y")
        .sort((a, b) => b.doc_date.localeCompare(a.doc_date)),
    [orders, profile.cardCode],
  );

  const {
    data: rdData,
    isLoading: rdLoading,
    isError: rdError,
  } = useRdContactMarketing(profile.email);

  const rdContact = rdData?.configured && rdData.found ? rdData.contact : null;
  const rdConfigured = rdData?.configured ?? false;

  const [sendingConversion, setSendingConversion] = useState(false);
  const [convFeedback, setConvFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const handleSendConversion = useCallback(async () => {
    if (!profile.email) return;
    setSendingConversion(true);
    setConvFeedback(null);
    try {
      const res = await fetch("/api/integrations/rd-marketing/conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: profile.email,
          conversion_identifier: "crm-interacao-manual",
          name: profile.cardName,
          city: profile.city ?? undefined,
          state: profile.state ?? undefined,
          company_name: profile.cardName,
          tags: [
            "sap-cliente",
            "crm-interacao",
            profile.state ? `uf-${profile.state}` : null,
          ].filter(Boolean),
          cf_custom_fields: { cf_sap_card_code: profile.cardCode },
        }),
      });
      const body = await res.json();
      setConvFeedback(body.success
        ? { kind: "ok", text: `Conversão enviada ao RD (${body.data?.responseTimeMs ?? 0}ms)` }
        : { kind: "error", text: body.error ?? "Falha" });
    } catch (e) {
      setConvFeedback({ kind: "error", text: e instanceof Error ? e.message : "Falha" });
    } finally {
      setSendingConversion(false);
    }
  }, [profile]);

  const rec = profile.lastOrderDate ? recencyBadge(profile.daysInactive) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 via-pink-50/30 to-white px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{profile.cardName}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{profile.cardCode}</span>
              {profile.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {profile.city}{profile.state ? ` — ${profile.state}` : ""}
                </span>
              )}
              {profile.state && STATE_TO_REGION[profile.state] && (
                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  {STATE_TO_REGION[profile.state]}
                </span>
              )}
              {rec && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${rec.cls}`}>
                  {rec.label}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contact info */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="flex items-center gap-1.5 text-violet-700 hover:underline">
              <Mail className="w-3.5 h-3.5" />
              {profile.email}
            </a>
          )}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 text-gray-600 hover:underline">
              <Phone className="w-3.5 h-3.5" />
              {profile.phone}
            </a>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* SAP KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Faturamento", value: fmtBRL(profile.fat), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pedidos", value: String(profile.pedidos), icon: ShoppingCart, color: "text-sky-600", bg: "bg-sky-50" },
            { label: "Ticket Médio", value: fmtBRL(profile.ticket, 2), icon: ArrowUpRight, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Último Pedido", value: profile.lastOrderDate ? fmtDateShort(profile.lastOrderDate) : "—", icon: Clock, color: "text-gray-600", bg: "bg-gray-50" },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`p-1 rounded-md ${k.bg}`}><k.icon className={`w-3.5 h-3.5 ${k.color}`} /></div>
                <span className="text-[9px] font-semibold text-gray-500 uppercase">{k.label}</span>
              </div>
              <span className={`text-base font-bold ${k.color} block tabular-nums`}>{k.value}</span>
            </div>
          ))}
        </div>

        {/* RD Station section */}
        <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-white to-purple-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-purple-700" />
              RD Station — Cliente 360
            </h3>
            {rdLoading && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
          </div>

          {!profile.email || !profile.email.includes("@") ? (
            <p className="text-xs text-gray-500 italic">
              Cliente sem e-mail no SAP — não é possível correlacionar com o RD Station.
            </p>
          ) : rdLoading ? (
            <p className="text-xs text-gray-500">Consultando RD Marketing…</p>
          ) : !rdConfigured ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              RD Marketing não configurado. Configure em <strong>Integrações</strong>.
            </p>
          ) : rdContact ? (
            <div className="space-y-3">
              {/* RD Contact card */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {(rdContact.name ?? profile.cardName).substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{rdContact.name ?? "—"}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    {rdContact.lifecycle && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-bold">
                        {rdContact.lifecycle}
                      </span>
                    )}
                    {rdContact.jobTitle && <span>{rdContact.jobTitle}</span>}
                    {rdContact.city && <span>· {rdContact.city}</span>}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {rdContact.tags && rdContact.tags.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Tags RD</p>
                  <div className="flex flex-wrap gap-1">
                    {rdContact.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Last conversion */}
              {rdContact.lastConversionDate && (
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Última conversão: {fmtDateShort(rdContact.lastConversionDate)}
                </div>
              )}

              {/* Custom fields */}
              {rdContact.cfCustomFields && Object.keys(rdContact.cfCustomFields).length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-purple-700 font-medium hover:underline">
                    Campos personalizados ({Object.keys(rdContact.cfCustomFields).length})
                  </summary>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    {Object.entries(rdContact.cfCustomFields).slice(0, 10).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-gray-400 font-mono truncate">{k}</dt>
                        <dd className="text-gray-700 text-right truncate">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 space-y-2">
              <p>Contato <span className="font-mono text-gray-700">{profile.email}</span> não encontrado na base RD.</p>
              <p className="text-[11px] text-gray-400">
                Use o botão abaixo para enviar uma conversão e criar o lead automaticamente.
              </p>
            </div>
          )}

          {/* Action: send conversion */}
          {profile.email && profile.email.includes("@") && (
            <div className="pt-2 border-t border-purple-100 flex flex-wrap items-center gap-2">
              <button
                onClick={handleSendConversion}
                disabled={sendingConversion}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 motion-safe:transition-colors disabled:opacity-50"
              >
                {sendingConversion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Enviar conversão ao RD
              </button>
              {convFeedback && (
                <span className={`text-[11px] flex items-center gap-1 ${
                  convFeedback.kind === "ok" ? "text-emerald-600" : "text-red-600"
                }`}>
                  {convFeedback.kind === "ok" ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {convFeedback.text}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Recent orders table */}
        <div>
          <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5 text-sky-600" />
            Últimos pedidos ({clientOrders.length})
          </h3>
          {clientOrders.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhum pedido no período selecionado.</p>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase sticky top-0">
                      <th className="py-2 px-3 text-left bg-gray-50">Doc</th>
                      <th className="py-2 px-3 text-left bg-gray-50">Data</th>
                      <th className="py-2 px-3 text-right bg-gray-50">Valor</th>
                      <th className="py-2 px-3 text-right bg-gray-50">Itens</th>
                      <th className="py-2 px-3 text-center bg-gray-50">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientOrders.slice(0, 25).map((o) => (
                      <tr key={o.doc_entry} className="hover:bg-gray-50 motion-safe:transition-colors">
                        <td className="py-2 px-3 font-mono text-gray-700 font-medium">{o.doc_num}</td>
                        <td className="py-2 px-3 text-gray-600">{fmtDateShort(o.doc_date)}</td>
                        <td className="py-2 px-3 text-right text-emerald-600 font-semibold tabular-nums">{fmtBRL(Number(o.doc_total))}</td>
                        <td className="py-2 px-3 text-right text-gray-500 tabular-nums">{o.num_lines}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            o.document_status === "bost_Close"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {o.document_status === "bost_Close" ? "Fechado" : "Aberto"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
