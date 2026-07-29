import {
  ClipboardList,
  Clock,
  Hourglass,
  Package,
  Receipt,
  Truck,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Estágios do funil B2B (cotação → entrega). Mantém os status técnicos
 * retornados pelo gateway e os agrupa na UX do cliente.
 */
export type OrderStatus =
  | "aguardando"
  | "cotacao_aberta"
  | "cotacao_em_analise"
  | "cotacao_convertida"
  | "novo"
  | "em_analise"
  | "separacao"
  | "faturado"
  | "enviado"
  | "entregue"
  | "cancelado";

/** Chaves de filtro da lista (jornada do cliente, não 1:1 com status técnico). */
export type OrderFilterKey =
  | ""
  | "cotacao"
  | "confirmado"
  | "separacao"
  | "faturado"
  | "entrega"
  | "entregue"
  | "cancelado";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "outline";

interface OrderStatusConfig {
  label: string;
  variant: BadgeVariant;
  icon: LucideIcon;
  /** Descrição amigável do que está acontecendo nesta etapa. */
  hint: string;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusConfig> = {
  aguardando: {
    label: "Cotação enviada",
    variant: "warning",
    icon: Hourglass,
    hint: "Sua solicitação foi recebida e aguarda revisão da equipe comercial.",
  },
  cotacao_aberta: {
    label: "Cotação enviada",
    variant: "info",
    icon: ClipboardList,
    hint: "Cotação registrada. Nossa equipe comercial vai revisar em breve.",
  },
  cotacao_em_analise: {
    label: "Cotação em análise",
    variant: "warning",
    icon: Clock,
    hint: "A equipe comercial está revisando quantidades e preços da sua cotação.",
  },
  cotacao_convertida: {
    label: "Pedido confirmado",
    variant: "success",
    icon: CheckCircle2,
    hint: "Cotação aprovada e convertida em pedido.",
  },
  novo: {
    label: "Pedido confirmado",
    variant: "info",
    icon: ClipboardList,
    hint: "Seu pedido foi confirmado e entrou na fila de atendimento.",
  },
  em_analise: {
    label: "Pedido confirmado",
    variant: "warning",
    icon: Clock,
    hint: "Estamos preparando seu pedido para separação no estoque.",
  },
  separacao: {
    label: "Em separação",
    variant: "secondary",
    icon: Package,
    hint: "Seus produtos estão sendo separados no estoque.",
  },
  faturado: {
    label: "Faturado",
    variant: "default",
    icon: Receipt,
    hint: "O pedido foi faturado e está pronto para envio.",
  },
  enviado: {
    label: "Em entrega",
    variant: "info",
    icon: Truck,
    hint: "Seu pedido saiu para entrega.",
  },
  entregue: {
    label: "Entregue",
    variant: "success",
    icon: CheckCircle2,
    hint: "Pedido entregue. Bom proveito!",
  },
  cancelado: {
    label: "Cancelado",
    variant: "destructive",
    icon: XCircle,
    hint: "Este documento foi cancelado.",
  },
};

/**
 * Timeline do pedido (após confirmação da cotação).
 * Cotação em si não usa esta timeline — só pedidos confirmados.
 */
export const ORDER_FLOW: OrderStatus[] = [
  "novo",
  "separacao",
  "faturado",
  "enviado",
  "entregue",
];

/** Rótulos curtos da timeline (mobile/desktop). */
export const ORDER_FLOW_LABELS: Partial<Record<OrderStatus, string>> = {
  novo: "Confirmado",
  separacao: "Separação",
  faturado: "Faturado",
  enviado: "Entrega",
  entregue: "Entregue",
};

/** Filtros da lista — alinhados ao fluxo cotação → entrega. */
export const ORDER_STATUS_FILTERS: {
  value: OrderFilterKey;
  label: string;
}[] = [
  { value: "", label: "Todos" },
  { value: "cotacao", label: "Cotação" },
  { value: "confirmado", label: "Confirmado" },
  { value: "separacao", label: "Separação" },
  { value: "faturado", label: "Faturado" },
  { value: "entrega", label: "Em entrega" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

const FILTER_STATUSES: Record<Exclude<OrderFilterKey, "">, OrderStatus[]> = {
  cotacao: ["cotacao_aberta", "cotacao_em_analise", "aguardando"],
  confirmado: ["novo", "em_analise", "cotacao_convertida"],
  separacao: ["separacao"],
  faturado: ["faturado"],
  entrega: ["enviado"],
  entregue: ["entregue"],
  cancelado: ["cancelado"],
};

export function matchesOrderFilter(
  status: string,
  filter: OrderFilterKey,
): boolean {
  if (!filter) return true;
  return (FILTER_STATUSES[filter] as string[] | undefined)?.includes(status) ?? false;
}

export function getOrderStatusConfig(status: string): OrderStatusConfig {
  return (
    ORDER_STATUS_CONFIG[status as OrderStatus] ?? {
      label: status,
      variant: "secondary" as const,
      icon: ClipboardList,
      hint: "",
    }
  );
}

/** Índice na timeline do pedido (agrupa status equivalentes). */
export function getOrderFlowStepIndex(status: string): number {
  if (status === "em_analise" || status === "cotacao_convertida") {
    return ORDER_FLOW.indexOf("novo");
  }
  return ORDER_FLOW.indexOf(status as OrderStatus);
}

export function isQuotationLike(order: {
  quotation?: boolean;
  pending?: boolean;
  status?: string;
  documentType?: string;
}): boolean {
  if (order.quotation || order.documentType === "quotation") return true;
  if (order.pending || order.documentType === "pending_order") return true;
  const st = order.status ?? "";
  return (
    st === "cotacao_aberta" ||
    st === "cotacao_em_analise" ||
    st === "aguardando"
  );
}

export function getDocumentTitle(order: {
  docNum: number;
  quotation?: boolean;
  pending?: boolean;
  status?: string;
  documentType?: string;
}): string {
  if (isQuotationLike(order)) return `Cotação #${order.docNum}`;
  return `Pedido #${order.docNum}`;
}

/** Tipo do pedido em formato camelCase retornado pelo gateway. */
export interface OrderSummary {
  docEntry: number;
  docNum: number;
  createdAt: string;
  dueDate?: string | null;
  cardCode: string;
  cardName?: string | null;
  docTotal?: number | null;
  currency?: string | null;
  sapStatus?: string | null;
  cancelled: boolean;
  status: OrderStatus;
  itemCount: number;
  totalQuantity: number;
  comments?: string | null;
  /** true quando o pedido ainda aguarda confirmação do vendedor (não existe no SAP). */
  pending?: boolean;
  pendingId?: number;
  /** true quando o documento é uma cotação SAP (OQUT). */
  quotation?: boolean;
  quotationId?: number;
  quotationStatus?: string;
  documentType?: "order" | "quotation" | "pending_order";
  orderDocEntry?: number | null;
  orderDocNum?: number | null;
  rejectReason?: string | null;
  /** true quando o pedido ainda pode ser cancelado (não faturado / pendente). */
  canCancel?: boolean;
}
