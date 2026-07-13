"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Package,
  ImageOff,
  EyeOff,
  Lock,
  FolderX,
  Search,
  ChevronRight,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchOverview } from "@/lib/admin/catalog";
import { cn } from "@/lib/utils";
import type { ProductFilterPreset } from "./types";

interface OverviewTabProps {
  onNavigate: (target: { tab: "products" | "categories"; preset?: ProductFilterPreset }) => void;
}

interface Kpi {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  value: number;
  accent: string;
  onClick: () => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-catalog-overview"],
    queryFn: fetchOverview,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-slate-800" />
        ))}
      </div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar a visão geral"
        description="Ocorreu um erro ao buscar os indicadores do catálogo."
        action={
          <Button onClick={() => refetch()} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const o = data.data;
  const kpis: Kpi[] = [
    {
      key: "total",
      label: "Produtos ativos",
      hint: "No catálogo",
      icon: Package,
      value: o.totalActive,
      accent: "text-emerald-400 bg-emerald-500/10",
      onClick: () => onNavigate({ tab: "products", preset: "all" }),
    },
    {
      key: "noImage",
      label: "Sem imagem",
      hint: "Precisam de foto",
      icon: ImageOff,
      value: o.noImage,
      accent: "text-sky-400 bg-sky-500/10",
      onClick: () => onNavigate({ tab: "products", preset: "noImage" }),
    },
    {
      key: "hidden",
      label: "Ocultos",
      hint: "Não aparecem ao cliente",
      icon: EyeOff,
      value: o.hidden,
      accent: "text-rose-400 bg-rose-500/10",
      onClick: () => onNavigate({ tab: "products", preset: "hidden" }),
    },
    {
      key: "locked",
      label: "Travados",
      hint: "Protegidos do sync",
      icon: Lock,
      value: o.locked,
      accent: "text-amber-400 bg-amber-500/10",
      onClick: () => onNavigate({ tab: "products", preset: "locked" }),
    },
    {
      key: "seo",
      label: "SEO incompleto",
      hint: "Faltam título/descrição",
      icon: Search,
      value: o.seoIncomplete,
      accent: "text-violet-400 bg-violet-500/10",
      onClick: () => onNavigate({ tab: "products", preset: "all" }),
    },
    {
      key: "catHidden",
      label: "Categorias ocultas",
      hint: "Gerenciar visibilidade",
      icon: FolderX,
      value: o.hiddenCategories,
      accent: "text-orange-400 bg-orange-500/10",
      onClick: () => onNavigate({ tab: "categories" }),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <button
            key={kpi.key}
            onClick={kpi.onClick}
            className="group flex flex-col rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left transition-all hover:border-emerald-500/40 hover:bg-slate-800"
          >
            <div className="flex items-center justify-between">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", kpi.accent)}>
                <Icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-slate-300" />
            </div>
            <p className="mt-3 text-3xl font-bold text-white">{kpi.value.toLocaleString("pt-BR")}</p>
            <p className="text-sm font-medium text-slate-200">{kpi.label}</p>
            <p className="text-xs text-slate-500">{kpi.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
