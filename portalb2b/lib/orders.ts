import {
  ClipboardList,
  Clock,
  Package,
  Receipt,
  Truck,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Estágios do funil de atendimento do canal e-commerce (Portal B2B). É o mesmo
 * vocabulário gerido pela equipe de vendas no painel, para que cliente e
 * vendedor enxerguem o pedido na mesma etapa.
 */
export type OrderStatus =
  | "novo"
  | "em_analise"
  | "separacao"
  | "faturado"
  | "enviado"
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
  novo: {
    label: "Novo",
    variant: "info",
    icon: ClipboardList,
    hint: "Recebemos seu pedido e ele entrou na fila de atendimento.",
  },
  em_analise: {
    label: "Em análise",
    variant: "warning",
    icon: Clock,
    hint: "Nossa equipe comercial está revisando seu pedido.",
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
    label: "Enviado",
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
    hint: "Este pedido foi cancelado.",
  },
};

/** Sequência da timeline (exclui o estado terminal "cancelado"). */
export const ORDER_FLOW: OrderStatus[] = [
  "novo",
  "em_analise",
  "separacao",
  "faturado",
  "enviado",
  "entregue",
];

/** Filtros de status para a lista de pedidos. */
export const ORDER_STATUS_FILTERS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "novo", label: "Novos" },
  { value: "em_analise", label: "Em análise" },
  { value: "separacao", label: "Em separação" },
  { value: "faturado", label: "Faturados" },
  { value: "enviado", label: "Enviados" },
  { value: "entregue", label: "Entregues" },
  { value: "cancelado", label: "Cancelados" },
];

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
}
