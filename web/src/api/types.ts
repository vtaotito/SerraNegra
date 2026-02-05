export type OrderStatus =
  | "A_SEPARAR"
  | "EM_SEPARACAO"
  | "CONFERIDO"
  | "AGUARDANDO_COTACAO"
  | "AGUARDANDO_COLETA"
  | "DESPACHADO";

export type OrderEventType =
  | "INICIAR_SEPARACAO"
  | "FINALIZAR_SEPARACAO"
  | "CONFERIR"
  | "SOLICITAR_COTACAO"
  | "CONFIRMAR_COTACAO"
  | "AGUARDAR_COLETA"
  | "DESPACHAR";

export type OrderItem = {
  sku: string;
  itemDescription?: string;
  quantity: number;
  price?: number;
  warehouseCode?: string; // WarehouseCode do SAP (ex: 02.02)
  measureUnit?: string; // MeasureUnit do SAP (ex: UN, KG)
  lineTotal?: number;
  lineStatus?: string; // LineStatus do SAP (bost_Open, bost_Close)
};

export type Priority = "P1" | "P2" | "P3";

export type Order = {
  orderId: string; // UUID/ULID interno do WMS
  externalOrderId: string | null; // DocNum do SAP (número visível ao usuário)
  sapDocEntry?: number | null; // DocEntry do SAP (chave interna)
  sapDocNum?: number | null; // DocNum do SAP (redundante com externalOrderId para compatibilidade)
  customerId: string; // CardCode do SAP
  customerName?: string | null; // CardName do SAP
  shipToCode?: string | null; // ShipToCode do SAP
  shipToAddress?: string | null; // Address do SAP
  shipToCity?: string | null; // Extraído do Address ou campo específico
  shipToState?: string | null; // Extraído do Address ou campo específico
  shipToZipCode?: string | null; // Extraído do Address ou campo específico
  status: OrderStatus; // Status WMS (state machine)
  sapStatus?: string | null; // DocumentStatus original do SAP (bost_Open, bost_Close)
  cancelled?: boolean | null; // Cancelled do SAP (tYES = true, tNO = false)
  carrier?: string | null; // Transportadora (WMS)
  priority?: Priority | null; // Prioridade (WMS)
  docDate?: string | null; // DocDate do SAP (ISO)
  docDueDate?: string | null; // DocDueDate do SAP (ISO)
  slaDueAt?: string | null; // SLA calculado pelo WMS (pode usar DocDueDate como base)
  docTotal?: number | null; // DocTotal do SAP
  currency?: string | null; // DocCurrency do SAP (ex: "R$", "US$")
  discountPercent?: number | null; // DiscountPercent do SAP
  comments?: string | null; // Comments do SAP
  items: OrderItem[];
  createdAt: string; // CreationDate do SAP ou gerado pelo WMS (ISO)
  updatedAt: string; // Atualização no WMS (ISO)
  metadata?: Record<string, unknown> | null; // Outros campos SAP (UDFs, etc)
};

export type OrderEventActor = {
  kind: "USER" | "SYSTEM" | "INTEGRATION";
  id: string;
};

export type OrderEvent = {
  eventId: string;
  type: OrderEventType;
  from: OrderStatus;
  to: OrderStatus;
  occurredAt: string;
  actor: OrderEventActor;
  idempotencyKey?: string | null;
};

export type OrderHistoryResponse = {
  orderId: string;
  events: OrderEvent[];
};

export type PostOrderEventRequest = {
  type: OrderEventType;
  occurredAt?: string;
  actor: OrderEventActor;
  reason?: string | null;
};

export type PostOrderEventResult = {
  orderId: string;
  previousStatus: OrderStatus;
  currentStatus: OrderStatus;
  applied: boolean;
  event: OrderEvent;
};

// Extensões de UI (scanHistory e pendingIssues são calculados no frontend)
export type UiOrder = Order & {
  pendingIssues?: string[];
  scanHistory?: Array<{
    at: string; // ISO
    by: string;
    sku: string;
    quantity: number;
  }>;
};

