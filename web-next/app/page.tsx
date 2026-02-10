"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { MetricCard } from "@/features/dashboard/components/MetricCard";
import { RecentOrdersList } from "@/features/dashboard/components/RecentOrdersList";
import {
  useDashboardMetrics,
  useDashboardOrders,
} from "@/features/dashboard/hooks/useDashboard";
import {
  ShoppingCart,
  PackageSearch,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
} from "lucide-react";
import { OrderStatus, ORDER_STATUS_CONFIG } from "@/lib/constants/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  [OrderStatus.A_SEPARAR]: "#3b82f6",
  [OrderStatus.EM_SEPARACAO]: "#f59e0b",
  [OrderStatus.CONFERIDO]: "#8b5cf6",
  [OrderStatus.AGUARDANDO_COTACAO]: "#ec4899",
  [OrderStatus.AGUARDANDO_COLETA]: "#22c55e",
  [OrderStatus.DESPACHADO]: "#06b6d4",
};

export default function HomePage() {
  const { data: metrics, isLoading: isLoadingMetrics } = useDashboardMetrics();
  const { data: recentOrders, isLoading: isLoadingOrders } =
    useDashboardOrders({ limit: 5 });

  const pedidosAbertos = metrics?.ordersByStatus[OrderStatus.A_SEPARAR] ?? 0;
  const emSeparacao = metrics?.ordersByStatus[OrderStatus.EM_SEPARACAO] ?? 0;
  const despachados = metrics?.ordersByStatus[OrderStatus.DESPACHADO] ?? 0;
  const totalPedidos = metrics?.totalOrders ?? 0;

  // Dados para o gráfico de barras
  const chartData = metrics
    ? Object.entries(metrics.ordersByStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          name: ORDER_STATUS_CONFIG[status as OrderStatus]?.label || status,
          value: count,
          status,
        }))
    : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Visao geral do sistema WMS/OMS
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/integracao">
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Integracao SAP
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total de Pedidos"
            value={totalPedidos}
            icon={Zap}
            description="Pedidos no sistema"
            isLoading={isLoadingMetrics}
            colorClass="text-primary"
          />
          <MetricCard
            title="A Separar"
            value={pedidosAbertos}
            icon={ShoppingCart}
            description="Aguardando separacao"
            isLoading={isLoadingMetrics}
            colorClass="text-blue-600"
          />
          <MetricCard
            title="Em Separacao"
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
        </div>

        {/* Gráfico + Pedidos Recentes */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentOrdersList
            orders={recentOrders?.data}
            isLoading={isLoadingOrders}
          />

          {/* Gráfico de Pedidos por Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Pedidos por Status</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetrics ? (
                <div className="flex items-center justify-center h-[250px]">
                  <div className="text-sm text-muted-foreground animate-pulse">
                    Carregando...
                  </div>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[250px] text-center">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum pedido para exibir.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sincronize dados do SAP para popular o dashboard.
                  </p>
                  <Link href="/integracao" className="mt-3">
                    <Button variant="outline" size="sm">
                      Ir para Integracao
                    </Button>
                  </Link>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      fontSize={11}
                      tick={{ fill: "#6b7280" }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} pedido(s)`, "Quantidade"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status] || "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
