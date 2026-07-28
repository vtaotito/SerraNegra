"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCart, type CartItem } from "@/lib/cart/context";
import { packStep, snapToPackStep } from "@/lib/catalog";
import { get, post } from "@/lib/api/client";
import { useSalesperson, whatsappHref } from "@/lib/salesperson";
import { SalespersonCard } from "@/components/salesperson/SalespersonCard";
import { useShoppingLists } from "@/lib/shopping-lists";
import {
  formatDeliveryAddress,
  formatDeliveryContact,
} from "@/lib/delivery";
import type { DeliveryForm } from "@/components/onboarding/types";
import { toast } from "sonner";
import Link from "next/link";
import { ClientEmptyState } from "@/components/ui/client-empty-state";
import {
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  ArrowLeft,
  Send,
  Package,
  AlertCircle,
  MessageCircle,
  Phone,
  CheckCircle2,
  ListOrdered,
  MapPin,
  Pencil,
} from "lucide-react";

export default function CarrinhoPage() {
  const { items, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [listName, setListName] = useState("");
  const router = useRouter();
  const { salesperson } = useSalesperson();
  const { saveFromCart } = useShoppingLists();

  const { data: deliveryData } = useQuery<{ delivery: DeliveryForm | null }>({
    queryKey: ["b2b-delivery"],
    queryFn: () => get("/b2b/delivery"),
    staleTime: 60_000,
  });
  const delivery = deliveryData?.delivery ?? null;
  const deliveryAddress = formatDeliveryAddress(delivery);
  const deliveryContact = formatDeliveryContact(delivery);

  // Itens pedidos acima do estoque disponível → orientar o cliente a falar com
  // o vendedor (a equipe também vê o alerta no painel ao revisar o pedido).
  const exceedingItems = items.filter(
    (i) => i.maxUnits > 0 && i.quantity > i.maxUnits,
  );
  const hasExceeding = exceedingItems.length > 0;
  const waMessage =
    "Olá! Fiz um pedido no portal com itens acima do estoque disponível e gostaria de confirmar prazo/disponibilidade.";
  const waHref = whatsappHref(salesperson?.whatsapp ?? null, waMessage);

  function normalizePackQuantities() {
    for (const item of items) {
      const step = packStep(item.unitsPerPack);
      const snapped = snapToPackStep(item.quantity, step);
      if (snapped !== item.quantity) {
        updateQuantity(item.sku, snapped);
      }
    }
  }

  async function handleSubmitOrder() {
    if (items.length === 0) return;

    const normalizedItems = items
      .map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: snapToPackStep(i.quantity, packStep(i.unitsPerPack)),
      }))
      .filter((i) => i.quantity > 0);

    if (normalizedItems.length === 0) return;

    setSubmitting(true);
    try {
      const result = await post<{
        ok: boolean;
        pending: boolean;
        pendingId: number;
        message?: string;
      }>("/b2b/orders", {
        items: normalizedItems,
        notes: notes || undefined,
      });

      clearCart();
      setConfirmOpen(false);
      setSuccessId(result.pendingId);
      toast.success(`Solicitação #${result.pendingId} enviada!`, {
        description: "Aguarde a confirmação da nossa equipe de vendas.",
      });
    } catch (error) {
      toast.error("Erro ao enviar pedido", {
        description: error instanceof Error ? error.message : "Tente novamente",
      });
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (successId != null) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="mx-auto max-w-lg px-4 pt-12 pb-24 sm:px-6 text-center md:pb-12">
          <div className="flex flex-col items-center gap-4 rounded-2xl border bg-white p-8 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gsn-text">Solicitação enviada</h2>
              <p className="text-sm text-muted-foreground">
                Sua solicitação{" "}
                <span className="font-semibold text-gsn-text">#{successId}</span> foi
                recebida e aguarda confirmação da equipe de vendas.
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1 bg-gsn-brand hover:bg-gsn-brand-dark text-white"
                onClick={() => router.push("/pedidos")}
              >
                Ver pedido
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-gsn-brand text-gsn-brand-dark hover:bg-gsn-brand/10"
                onClick={() => router.push("/catalogo")}
              >
                Continuar comprando
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6 md:pb-12">
          <ClientEmptyState
            icon={ShoppingCart}
            title="Seu carrinho está vazio"
            description="Adicione produtos do catálogo para montar seu pedido"
            action={
              <Link href="/catalogo">
                <Button className="bg-gsn-brand hover:bg-gsn-brand-dark text-white">
                  <Package className="h-4 w-4" />
                  Ir para o Catálogo
                </Button>
              </Link>
            }
          />
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
              {items.map((item) => (
                <CartLineItem
                  key={item.sku}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>

            {/* Resumo */}
            <div className="space-y-4">
              {/* Aviso: itens acima do estoque → contato com o vendedor */}
              {hasExceeding && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <div className="text-xs text-amber-900">
                        <p className="font-semibold mb-0.5">
                          {exceedingItems.length} item(ns) acima do estoque
                        </p>
                        <p>
                          Você pode enviar o pedido normalmente — seu vendedor vai confirmar
                          prazo e disponibilidade.
                          {salesperson?.name ? ` Fale com ${salesperson.name}:` : ""}
                        </p>
                        {(waHref || salesperson?.phone) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {waHref && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 font-medium text-white hover:bg-emerald-700 transition"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                WhatsApp
                              </a>
                            )}
                            {salesperson?.phone && (
                              <a
                                href={`tel:${salesperson.phone.replace(/\D/g, "")}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 font-medium text-amber-800 hover:bg-amber-100 transition"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {salesperson.phone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <SalespersonCard salesperson={salesperson} />

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
                    <label className="text-sm font-medium">Observações</label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Observações sobre o pedido..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Seu pedido passará por confirmação da equipe de vendas antes de ser registrado. Os preços serão aplicados conforme a tabela de preços do seu cadastro.
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    className="w-full bg-gsn-brand hover:bg-gsn-brand-dark text-white"
                    size="lg"
                    onClick={() => {
                      normalizePackQuantities();
                      setConfirmOpen(true);
                    }}
                    disabled={submitting}
                  >
                    <Send className="h-4 w-4" />
                    Enviar Pedido
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-gsn-brand/40 text-gsn-brand-dark"
                    onClick={() => {
                      setListName("");
                      setSaveListOpen(true);
                    }}
                  >
                    <ListOrdered className="h-4 w-4" />
                    Salvar como lista
                  </Button>
                  <Link href="/listas" className="w-full">
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                      Ver listas salvas
                    </Button>
                  </Link>
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

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !submitting && setConfirmOpen(false)}
          />
          <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <ShoppingCart className="h-5 w-5 text-gsn-brand" />
              <h2 className="text-base font-semibold text-gsn-text">Revisar e enviar pedido</h2>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2 text-sm">
                {items.map((item) => (
                  <div key={item.sku} className="flex justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {item.name}
                    </span>
                    <span className="whitespace-nowrap font-medium">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-medium">
                <span>{items.length} produto(s)</span>
                <span>{totalItems} unidades</span>
              </div>
              {notes && (
                <p className="rounded-lg bg-muted/60 p-2.5 text-xs italic text-muted-foreground">
                  Obs: {notes}
                </p>
              )}

              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-gsn-text">
                    <MapPin className="h-3.5 w-3.5 text-gsn-brand" />
                    Entrega
                  </p>
                  <Link
                    href="/entrega"
                    className="inline-flex items-center gap-1 font-medium text-gsn-brand hover:underline"
                    onClick={() => setConfirmOpen(false)}
                  >
                    <Pencil className="h-3 w-3" />
                    Alterar
                  </Link>
                </div>
                {deliveryAddress ? (
                  <div className="space-y-0.5 text-muted-foreground">
                    <p>{deliveryAddress}</p>
                    {deliveryContact && <p>{deliveryContact}</p>}
                    {delivery?.needsScheduling && (
                      <p className="text-amber-700">Requer agendamento prévio</p>
                    )}
                  </div>
                ) : (
                  <p className="text-amber-800">
                    Nenhum endereço cadastrado.{" "}
                    <Link href="/entrega" className="font-medium underline" onClick={() => setConfirmOpen(false)}>
                      Informar entrega
                    </Link>
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  Este pedido será enviado para <strong>confirmação e precificação</strong>{" "}
                  da equipe de vendas. Você será avisado assim que ele for aprovado e
                  registrado.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-4">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Voltar
              </Button>
              <Button
                className="bg-gsn-brand hover:bg-gsn-brand-dark text-white"
                onClick={handleSubmitOrder}
                disabled={submitting}
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Enviando..." : "Confirmar envio"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {saveListOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-list-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSaveListOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl">
            <h2 id="save-list-title" className="mb-1 text-base font-semibold text-gsn-text">
              Salvar lista de compra
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Guarde este carrinho como modelo para repor depois neste dispositivo.
            </p>
            <Input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Ex.: Pedido semanal bar"
              autoFocus
              aria-label="Nome da lista"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const saved = saveFromCart(listName, items);
                  if (saved) {
                    toast.success(`Lista "${saved.name}" salva`);
                    setSaveListOpen(false);
                  }
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSaveListOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-gsn-brand text-white hover:bg-gsn-brand-dark"
                disabled={!listName.trim()}
                onClick={() => {
                  const saved = saveFromCart(listName, items);
                  if (saved) {
                    toast.success(`Lista "${saved.name}" salva`, {
                      action: {
                        label: "Ver listas",
                        onClick: () => router.push("/listas"),
                      },
                    });
                    setSaveListOpen(false);
                  }
                }}
              >
                <ListOrdered className="h-4 w-4" />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CartLineItem({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (sku: string, quantity: number) => void;
  onRemove: (sku: string) => void;
}) {
  const step = packStep(item.unitsPerPack);
  const hasStock = item.maxUnits > 0;
  const exceedsStock = hasStock && item.quantity > item.maxUnits;
  const packs = step > 1 ? Math.round(item.quantity / step) : null;
  const [draft, setDraft] = useState(String(item.quantity));

  useEffect(() => {
    setDraft(String(item.quantity));
  }, [item.quantity]);

  function commitDraft() {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      onUpdateQuantity(item.sku, 0);
      return;
    }
    const snapped = snapToPackStep(parsed, step);
    onUpdateQuantity(item.sku, snapped);
    setDraft(String(snapped));
  }

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-snug line-clamp-2 sm:line-clamp-1">
              {item.name}
            </h3>
            <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
            {exceedsStock && (
              <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                Acima do estoque — o vendedor confirmará
              </p>
            )}
            {step > 1 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Pedido em múltiplos de {step} {item.unit}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 -mt-1 flex-shrink-0 text-destructive hover:text-destructive"
            aria-label={`Remover ${item.name}`}
            onClick={() => onRemove(item.sku)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-r-none"
              aria-label="Diminuir quantidade"
              onClick={() => onUpdateQuantity(item.sku, item.quantity - step)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              min={step}
              step={step}
              value={draft}
              aria-label="Quantidade"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="h-10 w-16 border-0 text-center text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-l-none"
              aria-label="Aumentar quantidade"
              onClick={() => onUpdateQuantity(item.sku, item.quantity + step)}
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
}
