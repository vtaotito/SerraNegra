"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import {
  Package,
  BarChart3,
  ShoppingCart,
  Users,
  Activity,
  Clock,
  Shield,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/types";
import type { PanelModule } from "@/lib/types";
import { WMS_BASE_URL } from "@/lib/config";

const modules: {
  key: PanelModule;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  gradient: string;
  features: string[];
  internal?: boolean;
}[] = [
  {
    key: "wms",
    label: "WMS / OMS",
    description: "Sistema de gestão de pedidos e logística com integração SAP B1",
    href: WMS_BASE_URL,
    icon: Package,
    gradient: "from-gsn-800 to-gsn-950",
    features: ["Pedidos", "Estoque", "Produtos", "Integração SAP"],
  },
  {
    key: "cockpit",
    label: "Business Intelligence",
    description: "Dashboards de vendas, faturamento, margens e análise de clientes",
    href: "/bussiness-inteligence",
    icon: BarChart3,
    gradient: "from-gsn-700 to-gsn-900",
    features: ["Faturamento", "Vendedores", "Margens", "Carteira"],
    internal: true,
  },
  {
    key: "b2b",
    label: "Portal B2B",
    description: "Portal de autoatendimento para clientes com catálogo e pedidos",
    href: `${WMS_BASE_URL}/b2b`,
    icon: ShoppingCart,
    gradient: "from-emerald-600 to-emerald-800",
    features: ["Catálogo", "Carrinho", "Pedidos", "Admin"],
  },
];

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const userModules = modules.filter((m) => user.allowedModules.includes(m.key));

  return (
    <ProtectedLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Bem-vindo, {user.displayName.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Painel administrativo — Garrafaria Serra Negra
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gsn-200 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gsn-50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-gsn-700" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Perfil
              </span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {ROLE_LABELS[user.role]}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gsn-200 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gsn-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-gsn-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Módulos
              </span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {user.allowedModules.length} ativos
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gsn-200 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Usuário
              </span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{user.username}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gsn-200 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Último acesso
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Primeiro acesso"}
            </p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">Seus módulos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userModules.map((mod) => {
            const cardContent = (
              <>
                <div className={`bg-gradient-to-r ${mod.gradient} p-6 relative`}>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition" />
                  <div className="relative flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <mod.icon className="w-6 h-6 text-white" />
                    </div>
                    {mod.internal ? (
                      <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-white/90 transition" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-white/60 group-hover:text-white/90 transition" />
                    )}
                  </div>
                  <h3 className="relative text-xl font-bold text-white mt-4">{mod.label}</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm text-gray-500 mb-4">{mod.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mod.features.map((f) => (
                      <span key={f} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gsn-50 text-gsn-800">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            );

            if (mod.internal) {
              return (
                <Link key={mod.key} href={mod.href}
                  className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gsn-200 transition-all duration-200">
                  {cardContent}
                </Link>
              );
            }

            return (
              <a key={mod.key} href={mod.href} target="_blank" rel="noopener"
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gsn-200 transition-all duration-200">
                {cardContent}
              </a>
            );
          })}
        </div>

      </div>
    </ProtectedLayout>
  );
}
