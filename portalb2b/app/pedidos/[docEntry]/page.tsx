"use client";

import { use, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { useCart } from "@/lib/cart/context";
import { getProductImageUrl, getProductImageBySku } from "@/lib/product-images";
import { toast } from "sonner";
import {
  ORDER_FLOW,
  getOrderStatusConfig,
  type OrderStatus,
} from "@/lib/orders";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  User,
  FileText,
  CheckCircle2,
  MessageSquare,
  XCircle,
  ShoppingCart,
  Printer,
  RotateCcw,
  Send,
  Plus,
  ExternalLink,
  AlertTriangle,
  Replace,
  Info,
  Clock,
} from "lucide-react";

interface ItemFlag {
  id: number;
  flag: "falta" | "substituicao" | "observacao";
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface OrderItem {
  sku: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  warehouse?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  slug?: string | null;
  inCatalog?: boolean;
  isInStock?: boolean;
  flags?: ItemFlag[];
}

interface OrderDetail {
  docEntry: number;
  docNum: number;
  status: OrderStatus;
  cancelled: boolean;
  customerId: string;
  cardName?: string | null;
  shipToAddress?: string | null;
  dueDate?: string | null;
  docTotal?: number | null;
  currency?: string | null;
  comments?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

type MessageKind = "message" | "change_request" | "cancel_request";

interface OrderMessage {
  id: number;
  authorType: "customer" | "seller";
  authorName: string | null;
  kind: MessageKind;
  body: string;
  status: "aberto" | "resolvido" | "recusado" | null;
  resolutionNote: string | null;
  createdAt: string;
}

const FLAG_META: Record<
  ItemFlag["flag"],
  { label: string; cls: string; icon: typeof AlertTriangle }
> = {
  falta: { label: "Item em falta", cls: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  substituicao: { label: "Sugestão de substituição", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Replace },
  observacao: { label: "Observação", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Info },
};

const KIND_META: Record<MessageKind, { label: string; cls: string }> = {
  message: { label: "Mensagem", cls: "bg-muted text-muted-foreground" },
  change_request: { label: "Solicitação de alteração", cls: "bg-amber-100 text-amber-800" },
  cancel_request: { label: "Solicitação de cancelamento", cls: "bg-red-100 text-red-800" },
};

const REQUEST_STATUS_META: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Em análise", cls: "bg-amber-100 text-amber-800" },
  resolvido: { label: "Atendida", cls: "bg-emerald-100 text-emerald-800" },
  recusado: { label: "Recusada", cls: "bg-gray-200 text-gray-700" },
};

function itemImage(item: OrderItem): string | null {
  return item.thumbUrl || item.imageUrl || getProductImageBySku(item.sku) || getProductImageUrl(item.description ?? item.sku);
}

export default function PedidoDetalhePage({ params }: { params: Promise<{ docEntry: string }> }) {
  const { docEntry } = use(params);
  const router = useRouter();
  const { addItem } = useCart();

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ["b2b-order", docEntry],
    queryFn: () => get(`/b2b/orders/${docEntry}`),
  });

  const cfg = order ? getOrderStatusConfig(order.status) : null;
  const isCancelled = order?.status === "cancelado";
  const currentStepIdx = order ? ORDER_FLOW.indexOf(order.status) : -1;
  const canInteract = !!order && !isCancelled;

  function addAllToCart() {
    if (!order) return;
    for (const it of order.items) {
      addItem(
        {
          sku: it.sku,
          name: it.description ?? it.sku,
          unit: it.unit ?? "UN",
          unitsPerPack: 1,
          maxUnits: 0,
        },
        it.quantity,
      );
    }
    toast.success("Itens adicionados ao carrinho", {
      description: "Revise as quantidades e finalize a recompra.",
    });
    router.push("/carrinho");
  }

  function addOneToCart(it: OrderItem) {
    addItem(
      {
        sku: it.sku,
        name: it.description ?? it.sku,
        unit: it.unit ?? "UN",
        unitsPerPack: 1,
        maxUnits: 0,
      },
      it.quantity,
    );
    toast.success(`${it.description ?? it.sku} adicionado ao carrinho`);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="print:hidden">
        <Header />
      </div>
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8 print:max-w-none print:py-2">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/pedidos">
                <Button variant="ghost" size="icon" aria-label="Voltar para pedidos">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {isLoading ? <Skeleton className="h-8 w-48" /> : `Pedido #${order?.docNum}`}
                </h1>
                {order && (
                  <p className="text-sm text-muted-foreground">Pedido nº {order.docEntry}</p>
                )}
              </div>
            </div>
            {order && (
              <div className="flex flex-1 items-center gap-2 sm:flex-none">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1.5" /> Imprimir
                </Button>
                <Button size="sm" className="flex-1 sm:flex-none" onClick={addAllToCart}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> <span className="sm:inline">Comprar novamente</span>
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : !order ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg">Pedido nao encontrado</h3>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Status + Timeline */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {cfg && <cfg.icon className="h-6 w-6 text-gsn-brand" />}
                      <Badge variant={cfg?.variant ?? "secondary"} className="text-sm px-3 py-1">
                        {cfg?.label ?? order.status}
                      </Badge>
                    </div>
                    {order.docTotal != null && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {formatCurrency(order.docTotal, order.currency ?? "BRL")}
                        </p>
                        <p className="text-xs text-muted-foreground">Valor total</p>
                      </div>
                    )}
                  </div>

                  {cfg?.hint && <p className="text-sm text-muted-foreground mb-6">{cfg.hint}</p>}

                  {isCancelled ? (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                      Este pedido foi cancelado.
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      {ORDER_FLOW.map((step, idx) => {
                        const stepConf = getOrderStatusConfig(step);
                        const isComplete = idx <= currentStepIdx;
                        const isCurrent = idx === currentStepIdx;
                        return (
                          <div key={step} className="flex flex-col items-center flex-1 relative">
                            {idx > 0 && (
                              <div
                                className={`absolute top-4 right-1/2 h-0.5 w-full -z-0 ${
                                  idx <= currentStepIdx ? "bg-gsn-brand" : "bg-muted"
                                }`}
                              />
                            )}
                            <div
                              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                isCurrent
                                  ? "bg-gsn-brand text-white ring-4 ring-gsn-brand/20"
                                  : isComplete
                                    ? "bg-gsn-brand/80 text-white"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                            </div>
                            <span className="mt-1.5 text-[10px] text-center text-muted-foreground leading-tight hidden sm:block">
                              {stepConf.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Informações */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Datas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Criado em</span>
                      <span>{formatDateTime(order.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Atualizado em</span>
                      <span>{formatDateTime(order.updatedAt)}</span>
                    </div>
                    {order.dueDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Previsao</span>
                        <span>{formatDate(order.dueDate)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" /> Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {order.cardName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nome</span>
                        <span className="text-right max-w-[60%] truncate">{order.cardName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Codigo</span>
                      <span className="font-mono">{order.customerId}</span>
                    </div>
                    {order.shipToAddress && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Entrega
                        </span>
                        <span className="text-right max-w-[60%] truncate">{order.shipToAddress}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Observações */}
              {order.comments && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> Observacoes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{order.comments}</p>
                  </CardContent>
                </Card>
              )}

              {/* Itens do Pedido */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Itens do Pedido ({order.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {order.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Detalhes dos itens nao disponiveis
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {order.items.map((item, idx) => {
                        const img = itemImage(item);
                        return (
                          <div key={`${item.sku}-${idx}`}>
                            {idx > 0 && <Separator className="mb-3" />}
                            <div className="flex items-start gap-3">
                              <div className="h-16 w-16 flex-shrink-0 rounded-lg border bg-white overflow-hidden flex items-center justify-center">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={img}
                                    alt={item.description ?? item.sku}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <Package className="h-6 w-6 text-muted-foreground/40" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm leading-snug">
                                      {item.description ?? item.sku}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                      SKU: {item.sku}
                                      {item.warehouse && ` | Depósito: ${item.warehouse}`}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <Badge variant="outline" className="font-mono">
                                      {item.quantity}x
                                    </Badge>
                                    {item.lineTotal != null && item.lineTotal > 0 && (
                                      <p className="text-sm font-semibold mt-1">
                                        {formatCurrency(item.lineTotal, order.currency ?? "BRL")}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Sinalizações do vendedor */}
                                {item.flags && item.flags.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {item.flags.map((f) => {
                                      const meta = FLAG_META[f.flag];
                                      const Icon = meta.icon;
                                      return (
                                        <div
                                          key={f.id}
                                          className={`inline-flex items-start gap-1.5 rounded-md border px-2 py-1 text-xs ${meta.cls}`}
                                        >
                                          <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                          <span>
                                            <strong>{meta.label}</strong>
                                            {f.note ? `: ${f.note}` : ""}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Ações por item */}
                                <div className="mt-2 flex items-center gap-3 print:hidden">
                                  {item.inCatalog && item.slug && (
                                    <Link
                                      href={`/catalogo/${item.sku}`}
                                      className="inline-flex items-center gap-1 text-xs text-gsn-brand hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" /> Ver produto
                                    </Link>
                                  )}
                                  {canInteract && (
                                    <button
                                      onClick={() => addOneToCart(item)}
                                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gsn-brand"
                                    >
                                      <Plus className="h-3 w-3" /> Adicionar ao carrinho
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conversa com o vendedor */}
              <MessagesThread docEntry={docEntry} canInteract={canInteract} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function MessagesThread({
  docEntry,
  canInteract,
}: {
  docEntry: string;
  canInteract: boolean;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<MessageKind>("message");

  const { data, isLoading } = useQuery<{ messages: OrderMessage[] }>({
    queryKey: ["b2b-order-messages", docEntry],
    queryFn: () => get(`/b2b/orders/${docEntry}/messages`),
    refetchInterval: 30000,
  });

  const messages = data?.messages ?? [];
  const openRequest = useMemo(
    () => messages.find((m) => m.kind !== "message" && m.status === "aberto"),
    [messages],
  );

  const mutation = useMutation({
    mutationFn: () => post(`/b2b/orders/${docEntry}/messages`, { kind, body: body.trim() }),
    onSuccess: () => {
      setBody("");
      setKind("message");
      qc.invalidateQueries({ queryKey: ["b2b-order-messages", docEntry] });
      toast.success("Enviado!", {
        description: "Nossa equipe de vendas vai responder em breve.",
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Conversa com o vendedor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Nenhuma mensagem ainda. Fale com a nossa equipe sobre este pedido.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const mine = m.authorType === "customer";
              const kindMeta = KIND_META[m.kind];
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "bg-gsn-brand text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-medium ${mine ? "text-white/80" : "text-muted-foreground"}`}>
                        {mine ? "Você" : m.authorName ?? "Vendedor"}
                      </span>
                      {m.kind !== "message" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${mine ? "bg-white/20" : kindMeta.cls}`}>
                          {kindMeta.label}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.status && (
                      <div className="mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${REQUEST_STATUS_META[m.status]?.cls ?? ""}`}>
                          {REQUEST_STATUS_META[m.status]?.label ?? m.status}
                        </span>
                        {m.resolutionNote && (
                          <p className={`text-[11px] mt-1 ${mine ? "text-white/80" : "text-muted-foreground"}`}>
                            {m.resolutionNote}
                          </p>
                        )}
                      </div>
                    )}
                    <p className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground/70"}`}>
                      {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canInteract ? (
          <div className="rounded-lg border p-3 print:hidden">
            {openRequest && (
              <div className="mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs text-amber-800">
                <Clock className="h-3.5 w-3.5" /> Você já tem uma solicitação em análise neste pedido.
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(["message", "change_request", "cancel_request"] as MessageKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    kind === k
                      ? "bg-gsn-brand text-white border-transparent"
                      : "bg-white text-muted-foreground border-input hover:border-gsn-brand/40"
                  }`}
                >
                  {KIND_META[k].label}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder={
                kind === "cancel_request"
                  ? "Conte o motivo do cancelamento…"
                  : kind === "change_request"
                    ? "Descreva a alteração desejada (quantidades, itens, entrega)…"
                    : "Escreva sua mensagem para o vendedor…"
              }
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-gsn-brand/30"
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                disabled={!body.trim() || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {kind === "message" ? (
                  <Send className="h-4 w-4 mr-1.5" />
                ) : (
                  <ShoppingCart className="h-4 w-4 mr-1.5" />
                )}
                {kind === "message" ? "Enviar" : "Enviar solicitação"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground print:hidden">
            Este pedido está encerrado para novas interações.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
