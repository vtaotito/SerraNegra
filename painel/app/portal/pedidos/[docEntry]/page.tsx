"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  Calendar,
  CreditCard,
  MapPin,
  Package,
  Loader2,
  CheckCircle,
  Circle,
  Truck,
  ClipboardCheck,
} from "lucide-react";
import { fetchOrderDetail, fmtBRL, fmtDate, type B2BOrder } from "@/lib/b2b-api";
import { StatusBadge } from "@/components/b2b/StatusBadge";
import { ErrorState } from "@/components/cockpit/DataState";
import { useCart } from "@/contexts/CartContext";

export default function PedidoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const docEntry = Number(params.docEntry);

  const [order, setOrder] = useState<B2BOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!docEntry) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchOrderDetail(docEntry);
        if (!cancelled) setOrder(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar pedido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [docEntry]);

  const handleRepeatOrder = () => {
    if (!order?.lines) return;
    for (const line of order.lines) {
      addItem(
        {
          sku: line.ItemCode,
          name: line.ItemDescription,
          imageUrl: null,
          price: line.UnitPrice ?? line.Price,
          unitOfMeasure: "",
        },
        line.Quantity,
      );
    }
    router.push("/portal/carrinho");
  };

  if (loading) return <DetailSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!order) return null;

  const isCancelled = order.cancelled === "Y" || order.cancelled === "tYES";
  const isOpen = order.doc_status === "O" && !isCancelled;

  return (
    <div className="space-y-6">
      {/* Voltar + Header */}
      <div className="space-y-4">
        <Link
          href="/portal/pedidos"
          className="inline-flex items-center gap-1.5 text-sm text-cockpit-muted hover:text-cockpit-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar aos Pedidos
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cockpit-accent/10">
              <ClipboardList className="w-5 h-5 text-cockpit-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Pedido #{order.doc_num}
              </h1>
              <p className="text-xs text-cockpit-muted">{fmtDate(order.doc_date)}</p>
            </div>
            <StatusBadge status={order.doc_status} cancelled={order.cancelled} />
          </div>
          <button
            type="button"
            onClick={handleRepeatOrder}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-cockpit-border bg-white text-sm font-medium text-gray-700 hover:bg-cockpit-bg hover:border-cockpit-accent/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Repetir Pedido
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<CreditCard className="w-4 h-4" />} label="Valor Total" value={fmtBRL(order.doc_total)} />
        <SummaryCard icon={<Package className="w-4 h-4" />} label="Itens" value={`${order.num_lines} ${order.num_lines === 1 ? "item" : "itens"}`} />
        <SummaryCard
          icon={<Calendar className="w-4 h-4" />}
          label="Previsão Entrega"
          value={order.doc_due_date ? fmtDate(order.doc_due_date) : "—"}
        />
        <SummaryCard
          icon={<MapPin className="w-4 h-4" />}
          label="Pagamento"
          value={order.payment_method || "—"}
        />
      </div>

      {/* Timeline do status (se aberto) */}
      {isOpen && (
        <div className="rounded-xl border border-cockpit-border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Acompanhamento</h2>
          <OrderTimeline status={order.doc_status} />
        </div>
      )}

      {/* Observações */}
      {order.comments && (
        <div className="rounded-xl border border-cockpit-border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Observações</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.comments}</p>
        </div>
      )}

      {/* Endereço */}
      {(order.address || order.address2) && (
        <div className="rounded-xl border border-cockpit-border bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Endereço de Entrega</h2>
          <p className="text-sm text-gray-700">{order.address}</p>
          {order.address2 && <p className="text-sm text-cockpit-muted">{order.address2}</p>}
        </div>
      )}

      {/* Tabela de itens */}
      <div className="rounded-xl border border-cockpit-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-cockpit-border">
          <h2 className="text-sm font-semibold text-gray-900">Itens do Pedido</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cockpit-bg/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-cockpit-muted">Produto</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-cockpit-muted">SKU</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-cockpit-muted">Qtd</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-cockpit-muted">Preço Unit.</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-cockpit-muted">Desconto</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-cockpit-muted">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cockpit-border">
              {order.lines?.map((line) => (
                <tr key={line.LineNum} className="hover:bg-cockpit-bg/30 transition-colors">
                  <td className="px-5 py-3 text-gray-900 font-medium">{line.ItemDescription}</td>
                  <td className="px-5 py-3 text-cockpit-muted">{line.ItemCode}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{line.Quantity}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{fmtBRL(line.UnitPrice ?? line.Price)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                    {line.DiscountPercent ? `${line.DiscountPercent}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-gray-900">
                    {fmtBRL(line.LineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-cockpit-bg/50 font-semibold">
                <td colSpan={5} className="px-5 py-3 text-right text-sm text-gray-900">
                  Total
                </td>
                <td className="px-5 py-3 text-right text-sm text-gray-900 tabular-nums">
                  {fmtBRL(order.doc_total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-cockpit-border bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-cockpit-muted">{icon}</span>
        <p className="text-xs font-medium text-cockpit-muted">{label}</p>
      </div>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

const TIMELINE_STEPS = [
  { key: "received", label: "Recebido", icon: CheckCircle },
  { key: "picking", label: "Separando", icon: Package },
  { key: "checked", label: "Conferido", icon: ClipboardCheck },
  { key: "dispatched", label: "Despachado", icon: Truck },
];

function OrderTimeline({ status }: { status: string }) {
  const currentStep = status === "O" ? 0 : TIMELINE_STEPS.length - 1;

  return (
    <div className="flex items-center justify-between">
      {TIMELINE_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx <= currentStep;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  done
                    ? "bg-cockpit-accent text-white"
                    : "bg-cockpit-bg text-cockpit-muted border-2 border-cockpit-border"
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span
                className={`text-[10px] mt-1.5 font-medium ${
                  done ? "text-cockpit-accent" : "text-cockpit-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < TIMELINE_STEPS.length - 1 && (
              <div className="flex-1 mx-2">
                <div
                  className={`h-0.5 rounded ${
                    idx < currentStep ? "bg-cockpit-accent" : "bg-cockpit-border"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse motion-reduce:animate-none">
      <div className="h-4 w-32 bg-cockpit-border rounded" />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-cockpit-border rounded-lg" />
        <div>
          <div className="h-6 w-40 bg-cockpit-border rounded mb-1" />
          <div className="h-3 w-24 bg-cockpit-border rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-cockpit-border bg-white p-4 h-20" />
        ))}
      </div>
      <div className="rounded-xl border border-cockpit-border bg-white p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <div className="h-3 flex-1 bg-cockpit-border rounded" />
            <div className="h-3 w-16 bg-cockpit-border rounded" />
            <div className="h-3 w-16 bg-cockpit-border rounded" />
            <div className="h-3 w-20 bg-cockpit-border rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
