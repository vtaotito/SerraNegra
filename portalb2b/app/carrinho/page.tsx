"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart/context";
import { packStep, formatStockUnits } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { post } from "@/lib/api/client";
import { toast } from "sonner";
import Link from "next/link";
import {
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  ArrowLeft,
  Send,
  Package,
  AlertCircle,
} from "lucide-react";

export default function CarrinhoPage() {
  const { items, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmitOrder() {
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      await post<{ ok: boolean; pending: boolean; pendingId: number }>("/b2b/orders", {
        items: items.map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity })),
        notes: notes || undefined,
      });

      toast.success("Pedido enviado!", {
        description: "Aguarde a confirmação da nossa equipe de vendas.",
      });
      clearCart();
      router.push("/pedidos");
    } catch (error) {
      toast.error("Erro ao enviar pedido", {
        description: error instanceof Error ? error.message : "Tente novamente",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6 text-center md:pb-12">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-gsn-text">Seu carrinho esta vazio</h2>
            <p className="text-muted-foreground">
              Adicione produtos do catalogo para montar seu pedido
            </p>
            <Link href="/catalogo">
              <Button className="mt-2 bg-gsn-brand hover:bg-gsn-brand-dark text-white">
                <Package className="h-4 w-4" />
                Ir para o Catalogo
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 md:pb-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/catalogo">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Carrinho</h1>
              <p className="text-muted-foreground">
                {totalItems} item(ns) no carrinho
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Lista de Itens */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => {
                const step = packStep(item.unitsPerPack);
                const hasLimit = item.maxUnits > 0;
                const atMax = hasLimit && item.quantity >= item.maxUnits;
                const packs = step > 1 ? Math.round(item.quantity / step) : null;
                return (
                  <Card key={item.sku}>
                    <CardContent className="p-3 sm:p-4">
                      {/* Linha 1: identificacao do item */}
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium leading-snug line-clamp-2 sm:line-clamp-1">
                            {item.name}
                          </h3>
                          <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                          {hasLimit && (
                            <p
                              className={cn(
                                "mt-0.5 text-[11px]",
                                atMax ? "font-medium text-amber-600" : "text-muted-foreground",
                              )}
                            >
                              {atMax ? "Máximo em estoque · " : "Estoque: "}
                              {formatStockUnits(item.maxUnits)} {item.unit}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-mr-1 -mt-1 flex-shrink-0 text-destructive hover:text-destructive"
                          aria-label={`Remover ${item.name}`}
                          onClick={() => removeItem(item.sku)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Linha 2: quantidade / unidade */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center rounded-lg border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-r-none"
                            aria-label="Diminuir quantidade"
                            onClick={() => updateQuantity(item.sku, item.quantity - step)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={step}
                            max={hasLimit ? item.maxUnits : undefined}
                            value={item.quantity}
                            aria-label="Quantidade"
                            onChange={(e) => {
                              const parsed = Math.max(1, parseInt(e.target.value) || 1);
                              const capped = hasLimit ? Math.min(parsed, item.maxUnits) : parsed;
                              updateQuantity(item.sku, capped);
                            }}
                            className="h-10 w-16 border-0 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-l-none"
                            aria-label="Aumentar quantidade"
                            disabled={atMax}
                            onClick={() =>
                              updateQuantity(
                                item.sku,
                                hasLimit
                                  ? Math.min(item.maxUnits, item.quantity + step)
                                  : item.quantity + step,
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gsn-text">{item.unit}</span>
                          {packs !== null && (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {packs} × {step} {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Resumo */}
            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-base">Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {items.map((item) => (
                      <div key={item.sku} className="flex justify-between">
                        <span className="text-muted-foreground truncate max-w-[60%]">
                          {item.name}
                        </span>
                        <span className="font-medium">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total de Itens</span>
                    <span>{items.length} produto(s)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Qtde Total</span>
                    <span className="font-medium">{totalItems} unidades</span>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Observacoes</label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Observacoes sobre o pedido..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Seu pedido passara por confirmacao da equipe de vendas antes de ser registrado. Os precos serao aplicados conforme a tabela de precos do seu cadastro.
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    className="w-full bg-gsn-brand hover:bg-gsn-brand-dark text-white"
                    size="lg"
                    onClick={handleSubmitOrder}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {submitting ? "Enviando..." : "Enviar Pedido"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={clearCart}
                  >
                    Limpar Carrinho
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
