"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Plus,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { DateRangePicker } from "@/components/cockpit/DateRangePicker";
import { LoadingSkeleton } from "@/components/cockpit/DataState";
import { PedidosAnaliseView } from "@/components/pedidos/PedidosAnaliseView";
import { PedidosFretesView } from "@/components/pedidos/PedidosFretesView";
import { PedidosNotasView } from "@/components/pedidos/PedidosNotasView";
import { PedidosOperacaoView } from "@/components/pedidos/PedidosOperacaoView";
import { cn } from "@/lib/utils";

type PedidosView = "operacao" | "analise" | "notas" | "fretes";

function resolveView(searchParams: URLSearchParams): PedidosView {
  const explicit = searchParams.get("view");
  if (
    explicit === "analise" ||
    explicit === "operacao" ||
    explicit === "notas" ||
    explicit === "fretes"
  ) {
    return explicit;
  }
  if (searchParams.get("pedido")) return "notas";
  // Deep-links legados do BI → Análise; docEntry / fluxo B2B → Operação
  if (
    searchParams.get("cardCode") ||
    searchParams.get("search") ||
    searchParams.get("panel")
  ) {
    return "analise";
  }
  return "operacao";
}

const VIEW_COPY: Record<PedidosView, string> = {
  operacao: "Funil B2B, confirmação e atendimento — período compartilhado",
  analise: "KPIs, gráficos e lista SAP — sync e CSV na análise",
  notas: "Notas fiscais de venda vinculadas aos pedidos SAP",
  fretes: "Pedidos de frete (0 itens) e custo por cliente — fora do faturamento",
};

export default function PedidosPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <PedidosShell />
    </Suspense>
  );
}

function PedidosShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = resolveView(searchParams);

  const setView = useCallback(
    (next: PedidosView) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", next);
      if (next === "operacao") {
        params.delete("cardCode");
        params.delete("clientName");
        params.delete("search");
        params.delete("panel");
        params.delete("pedido");
      } else if (next === "analise") {
        params.delete("docEntry");
        params.delete("pedido");
      } else if (next === "notas") {
        params.delete("docEntry");
        params.delete("cardCode");
        params.delete("clientName");
        params.delete("panel");
      } else {
        // fretes
        params.delete("docEntry");
        params.delete("pedido");
        params.delete("panel");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 pb-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gsn-50 ring-1 ring-gsn-100 shrink-0">
                <ShoppingCart className="w-5 h-5 text-gsn-700" aria-hidden />
              </span>
              Pedidos
            </h1>
            <p className="text-sm text-gray-500 mt-1.5 max-w-xl">{VIEW_COPY[view]}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {view === "operacao" && (
              <Link
                href="/pedidos/nova"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 motion-safe:transition-colors whitespace-nowrap min-h-[40px]"
              >
                <Plus className="w-4 h-4" aria-hidden /> Nova venda
              </Link>
            )}
            <DateRangePicker />
          </div>
        </div>

        <div
          className="inline-flex p-1 rounded-xl bg-gray-100 gap-1 w-full sm:w-auto overflow-x-auto"
          role="tablist"
          aria-label="Modo da sessão Pedidos"
        >
          <ViewTab
            active={view === "operacao"}
            onClick={() => setView("operacao")}
            icon={ClipboardList}
            label="Operação"
            description="B2B e funil"
          />
          <ViewTab
            active={view === "analise"}
            onClick={() => setView("analise")}
            icon={BarChart3}
            label="Análise"
            description="Gráficos e lista"
          />
          <ViewTab
            active={view === "notas"}
            onClick={() => setView("notas")}
            icon={Receipt}
            label="Notas fiscais"
            description="NF-e e vínculo"
          />
          <ViewTab
            active={view === "fretes"}
            onClick={() => setView("fretes")}
            icon={Truck}
            label="Fretes"
            description="Custo por cliente"
          />
        </div>
      </header>

      {view === "operacao" && <PedidosOperacaoView embedded />}
      {view === "analise" && <PedidosAnaliseView embedded />}
      {view === "notas" && <PedidosNotasView embedded />}
      {view === "fretes" && <PedidosFretesView embedded />}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ClipboardList;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 sm:flex-none inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium motion-safe:transition-colors min-h-[44px] sm:min-h-0 shrink-0",
        active
          ? "bg-white text-gsn-700 shadow-sm ring-1 ring-black/[0.04]"
          : "text-gray-500 hover:text-gray-700",
      )}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span
          className={cn(
            "text-[10px] font-normal",
            active ? "text-gsn-600/80" : "text-gray-400",
          )}
        >
          {description}
        </span>
      </span>
    </button>
  );
}
