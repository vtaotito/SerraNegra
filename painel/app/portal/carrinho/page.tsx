"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Package,
  ArrowRight,
  CheckCircle2,
  Loader2,
  BookOpen,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { createOrder, fmtBRL } from "@/lib/b2b-api";
import { EmptyState } from "@/components/b2b/EmptyState";

type OrderStatus = "idle" | "loading" | "success" | "error";

export default function CarrinhoPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clear, totalItems, totalValue } = useCart();

  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<OrderStatus>("idle");
  const [orderNum, setOrderNum] = useState<number | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setStatus("loading");
    setError("");
    try {
      const res = await createOrder({
        items: items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      });
      setOrderNum(res.docNum);
      setStatus("success");
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar pedido");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-5">
        <div className="p-4 rounded-full bg-emerald-50">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedido Realizado!</h1>
          <p className="text-sm text-cockpit-muted mt-1">
            Seu pedido <strong>#{orderNum}</strong> foi enviado com sucesso.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/portal/pedidos`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover transition-colors"
          >
            Ver Meus Pedidos
          </Link>
          <Link
            href="/portal/catalogo"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-cockpit-border text-sm font-medium text-gray-700 hover:bg-cockpit-bg transition-colors"
          >
            Continuar Comprando
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="w-8 h-8 text-cockpit-accent" />}
        title="Seu carrinho está vazio"
        description="Adicione produtos do catálogo para montar seu pedido."
        action={
          <Link
            href="/portal/catalogo"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover transition-colors"
          >
            <BookOpen className="w-4 h-4" /> Ir ao Catálogo
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-cockpit-accent/10">
          <ShoppingCart className="w-5 h-5 text-cockpit-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Carrinho</h1>
          <p className="text-xs text-cockpit-muted">
            {totalItems} {totalItems === 1 ? "item" : "itens"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de itens */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <CartItemRow
              key={item.sku}
              item={item}
              onUpdateQty={(qty) => updateQuantity(item.sku, qty)}
              onRemove={() => removeItem(item.sku)}
            />
          ))}
        </div>

        {/* Resumo */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-cockpit-border bg-white p-5 sticky top-20 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">Resumo do Pedido</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-cockpit-muted">Itens ({totalItems})</span>
                <span className="font-medium text-gray-900 tabular-nums">{fmtBRL(totalValue)}</span>
              </div>
              <div className="border-t border-cockpit-border pt-3 flex justify-between text-base">
                <span className="font-semibold text-gray-900">Total Estimado</span>
                <span className="font-bold text-gray-900 tabular-nums">{fmtBRL(totalValue)}</span>
              </div>
            </div>

            {/* Data de entrega */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-cockpit-muted mb-1.5">
                <Calendar className="w-3.5 h-3.5" /> Data desejada de entrega
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-cockpit-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent"
              />
            </div>

            {/* Observações */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-cockpit-muted mb-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Alguma observação sobre o pedido..."
                className="w-full rounded-lg border border-cockpit-border bg-white px-3 py-2 text-sm placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent resize-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={status === "loading"}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Finalizar Pedido
              </button>
              <Link
                href="/portal/catalogo"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-cockpit-border text-sm font-medium text-gray-700 hover:bg-cockpit-bg transition-colors"
              >
                Continuar Comprando
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-cockpit-border bg-white">
      <div className="w-20 h-20 rounded-lg bg-cockpit-bg flex items-center justify-center shrink-0 overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1" />
        ) : (
          <Package className="w-8 h-8 text-cockpit-muted/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
            <p className="text-xs text-cockpit-muted">{item.sku}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg text-cockpit-muted hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            aria-label="Remover item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center border border-cockpit-border rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateQty(Math.max(1, item.quantity - 1))}
              className="p-1.5 hover:bg-cockpit-bg transition-colors rounded-l-lg"
              aria-label="Diminuir"
            >
              <Minus className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => onUpdateQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 text-center text-sm font-medium text-gray-900 border-x border-cockpit-border py-1.5 focus:outline-none tabular-nums"
            />
            <button
              type="button"
              onClick={() => onUpdateQty(item.quantity + 1)}
              className="p-1.5 hover:bg-cockpit-bg transition-colors rounded-r-lg"
              aria-label="Aumentar"
            >
              <Plus className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              {fmtBRL(item.price * item.quantity)}
            </p>
            {item.quantity > 1 && (
              <p className="text-[10px] text-cockpit-muted tabular-nums">
                {fmtBRL(item.price)} / un.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
