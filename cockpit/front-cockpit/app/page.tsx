"use client";

import { KPICard } from "@/components/KPICard";
import {
  DollarSign,
  Package,
  Percent,
  ShoppingCart,
  Wallet,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const kpis = [
  {
    title: "Faturamento",
    value: "R$ 2,45 M",
    variation: 12.4,
    variationLabel: "vs mês anterior",
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    title: "Volume",
    value: "184,2k",
    variation: 8.1,
    variationLabel: "unidades",
    icon: <Package className="w-4 h-4" />,
  },
  {
    title: "Margem %",
    value: "22,3%",
    variation: -1.2,
    variationLabel: "vs mês anterior",
    icon: <Percent className="w-4 h-4" />,
  },
  {
    title: "Ticket médio",
    value: "R$ 13,3k",
    variation: 5.0,
    icon: <ShoppingCart className="w-4 h-4" />,
  },
  {
    title: "Carteira",
    value: "R$ 4,1 M",
    variation: 3.2,
    icon: <Wallet className="w-4 h-4" />,
  },
  {
    title: "Valor estoque",
    value: "R$ 1,82 M",
    variation: -0.5,
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    title: "Rupturas",
    value: "3",
    variationLabel: "itens críticos",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
];

const trendData = [
  { month: "Jul", faturamento: 2100, margem: 21 },
  { month: "Ago", faturamento: 2250, margem: 22 },
  { month: "Set", faturamento: 2180, margem: 20 },
  { month: "Out", faturamento: 2380, margem: 23 },
  { month: "Nov", faturamento: 2450, margem: 22.3 },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Visão executiva</h1>
        <p className="text-cockpit-muted mt-1">
          Panorama comercial e operacional — Serra Negra
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Faturamento e margem — tendência
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient
                    id="colorFaturamento"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#238636"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#238636"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#30363d"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#8b949e"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#8b949e"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [
                    `R$ ${(value / 1000).toFixed(1)}k`,
                    "Faturamento",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="#238636"
                  strokeWidth={2}
                  fill="url(#colorFaturamento)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Top 5 — clientes (faturamento)
          </h2>
          <ul className="space-y-3">
            {[
              "Cliente A — R$ 412k",
              "Cliente B — R$ 388k",
              "Cliente C — R$ 295k",
              "Cliente D — R$ 267k",
              "Cliente E — R$ 241k",
            ].map((item, i) => (
              <li
                key={item}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-cockpit-bg border border-cockpit-border"
              >
                <span className="text-gray-300">{item.split(" — ")[0]}</span>
                <span className="font-medium text-cockpit-accent">
                  {item.split(" — ")[1]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Insights para hoje
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-cockpit-bg border border-cockpit-border">
            <p className="text-sm text-cockpit-muted">Queda de margem</p>
            <p className="mt-1 text-gray-200">
              Concentrada em categoria Garrafas — ver análise
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-cockpit-accent hover:underline"
            >
              Abrir análise
            </button>
          </div>
          <div className="p-4 rounded-lg bg-cockpit-bg border border-cockpit-border">
            <p className="text-sm text-cockpit-muted">Estoque crítico</p>
            <p className="mt-1 text-gray-200">
              3 itens com cobertura &lt; 7 dias
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-cockpit-accent hover:underline"
            >
              Abrir estoque
            </button>
          </div>
          <div className="p-4 rounded-lg bg-cockpit-bg border border-cockpit-border">
            <p className="text-sm text-cockpit-muted">Carteira atípica</p>
            <p className="mt-1 text-gray-200">
              Vendedor X com +18% vs média
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-cockpit-accent hover:underline"
            >
              Abrir carteira
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
