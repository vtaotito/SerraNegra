"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/features/dashboard/components/MetricCard";
import { RecentOrdersList } from "@/features/dashboard/components/RecentOrdersList";
import { useDashboardMetrics, useDashboardOrders } from "@/features/dashboard/hooks/useDashboard";
import {
  ShoppingCart,
  PackageSearch,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { OrderStatus } from "@/lib/constants/status";

export default function HomePage() {
  const { data: metrics, isLoading: isLoadingMetrics } = useDashboardMetrics();
  const { data: recentOrders, isLoading: isLoadingOrders } = useDashboardOrders({
    limit: 5,
  });

  const pedidosAbertos = metrics?.ordersByStatus[OrderStatus.A_SEPARAR] ?? 0;
  const emSeparacao = metrics?.ordersByStatus[OrderStatus.EM_SEPARACAO] ?? 0;
  const despachados = metrics?.ordersByStatus[OrderStatus.DESPACHADO] ?? 0;
  const errosIntegracao = 0; // TODO: Adicionar quando tiver endpoint de sync errors

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema WMS/OMS
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pedidos Abertos"
            value={pedidosAbertos}
            icon={ShoppingCart}
            description="Aguardando separação"
            isLoading={isLoadingMetrics}
            colorClass="text-blue-600"
          />
          <MetricCard
            title="Em Separação"
            value={emSeparacao}
            icon={PackageSearch}
            description="Sendo processados"
            isLoading={isLoadingMetrics}
            colorClass="text-amber-600"
          />
          <MetricCard
            title="Despachados"
            value={despachados}
            icon={CheckCircle2}
            description="Pedidos completos"
            isLoading={isLoadingMetrics}
            colorClass="text-green-600"
          />
          <MetricCard
            title="Erros de Integração"
            value={errosIntegracao}
            icon={AlertCircle}
            description="Requer atenção"
            isLoading={isLoadingMetrics}
            colorClass="text-red-600"
          />
        </div>

        {/* Pedidos Recentes */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentOrdersList
            orders={recentOrders?.data}
            isLoading={isLoadingOrders}
          />

          {/* Placeholder para gráfico */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">Pedidos por Status</h3>
            <p className="text-sm text-muted-foreground text-center py-8">
              🚧 Gráfico em desenvolvimento
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
