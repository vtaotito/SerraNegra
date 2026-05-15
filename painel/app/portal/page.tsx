"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  ClipboardList,
  BookOpen,
  Package,
  ArrowRight,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useB2BAuth } from "@/contexts/B2BAuthContext";
import { fetchDashboard, fmtBRL, fmtDate, type DashboardData } from "@/lib/b2b-api";
import { StatusBadge } from "@/components/b2b/StatusBadge";
import { ErrorState } from "@/components/cockpit/DataState";

export default function PortalDashboard() {
  const { customer } = useB2BAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDashboard();
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return null;

  const openOrders = data.ordersByStatus?.["O"] ?? 0;
  const lastOrder = data.recentOrders?.[0];

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {customer?.cardName?.split(" ")[0]}!
        </h1>
        <p className="text-sm text-cockpit-muted mt-0.5">
          Bem-vindo ao seu portal B2B. Veja o resumo da sua conta.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          icon={<ClipboardList className="w-5 h-5" />}
          label="Total de Pedidos"
          value={String(data.totalOrders)}
        />
        <KPICard
          icon={<Package className="w-5 h-5" />}
          label="Pedidos em Aberto"
          value={String(openOrders)}
          accent
        />
        <KPICard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Último Pedido"
          value={lastOrder ? fmtDate(lastOrder.doc_date) : "—"}
          sub={lastOrder ? `#${lastOrder.doc_num} · ${fmtBRL(lastOrder.doc_total)}` : undefined}
        />
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          href="/portal/carrinho"
          icon={<ShoppingCart className="w-5 h-5" />}
          label="Novo Pedido"
          description="Monte um pedido pelo catálogo"
        />
        <QuickAction
          href="/portal/catalogo"
          icon={<BookOpen className="w-5 h-5" />}
          label="Ver Catálogo"
          description="Navegue por todos os produtos"
        />
        <QuickAction
          href="/portal/pedidos"
          icon={<ClipboardList className="w-5 h-5" />}
          label="Meus Pedidos"
          description="Acompanhe seus pedidos"
        />
      </div>

      {/* Pedidos recentes */}
      {data.recentOrders.length > 0 && (
        <div className="rounded-xl border border-cockpit-border bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-cockpit-border">
            <h2 className="text-sm font-semibold text-gray-900">Pedidos Recentes</h2>
            <Link
              href="/portal/pedidos"
              className="text-xs font-medium text-cockpit-accent hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-cockpit-border">
            {data.recentOrders.slice(0, 5).map((order) => (
              <Link
                key={order.doc_entry}
                href={`/portal/pedidos/${order.doc_entry}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-cockpit-bg/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Pedido #{order.doc_num}
                  </p>
                  <p className="text-xs text-cockpit-muted">
                    {fmtDate(order.doc_date)} · {order.num_lines} {order.num_lines === 1 ? "item" : "itens"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={order.doc_status} cancelled={order.cancelled} />
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">
                    {fmtBRL(order.doc_total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-cockpit-border bg-white p-5 hover:border-cockpit-accent/30 motion-safe:transition-colors">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-cockpit-muted">{label}</p>
        <div className={`p-1.5 rounded-lg ${accent ? "bg-cockpit-accent/10 text-cockpit-accent" : "bg-cockpit-bg text-cockpit-muted"}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-cockpit-muted">{sub}</p>}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border border-cockpit-border bg-white p-4 hover:border-cockpit-accent/30 hover:shadow-sm motion-safe:transition-all group"
    >
      <div className="p-2.5 rounded-lg bg-cockpit-accent/10 text-cockpit-accent group-hover:bg-cockpit-accent group-hover:text-white transition-colors">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-cockpit-muted">{description}</p>
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse motion-reduce:animate-none">
      <div>
        <div className="h-7 w-48 bg-cockpit-border rounded mb-2" />
        <div className="h-4 w-72 bg-cockpit-border rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-cockpit-border bg-white p-5 h-28">
            <div className="h-3 w-20 bg-cockpit-border rounded mb-4" />
            <div className="h-6 w-16 bg-cockpit-border rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-cockpit-border bg-white p-4 h-16" />
        ))}
      </div>
    </div>
  );
}
