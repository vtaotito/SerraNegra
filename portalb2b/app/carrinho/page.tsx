"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart/context";
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
      const res = await post<{ ok: boolean; docEntry: number; docNum: number }>("/b2b/orders", {
        items: items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        notes: notes || undefined,
      });

      toast.success("Pedido criado com sucesso!", {
        description: `Pedido #${res.docNum} registrado no SAP`,
      });
      clearCart();
      router.push("/pedidos");
    } catch (error) {
      toast.error("Erro ao criar pedido", {
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
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-gsn-text">Seu carrinho esta vazio</h2>
            <p className="text-muted-foreground">
              Adicione produtos do catalogo para montar seu pedido
            </p>
            <Link href="/catalogo">
              <Button className="mt-2 bg-gsn-green hover:bg-gsn-green-dark text-white">
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
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
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
              {items.map((item) => (
                <Card key={item.sku}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-1">{item.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                    </div>

                    <div className="flex items-center gap-1 rounded-md border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.sku, Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="h-8 w-14 border-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <span className="text-xs text-muted-foreground w-8 text-center">
                      {item.unit}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeItem(item.sku)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Observacoes sobre o pedido..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      O pedido sera criado diretamente no SAP. Os precos serao aplicados conforme a tabela de precos do seu cadastro.
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    className="w-full bg-gsn-green hover:bg-gsn-green-dark text-white"
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
                    className="w-full text-gsn-red hover:text-gsn-red"
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
