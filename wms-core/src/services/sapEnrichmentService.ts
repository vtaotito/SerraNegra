import type { Order, Priority } from "../domain/order.js";

/**
 * Dados do SAP B1 (Sales Order)
 */
export type SapOrder = {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName?: string;
  ShipToCode?: string;
  Address?: string;
  U_Carrier?: string;
  U_Priority?: string;
  U_SLA_DueAt?: string;
  DocumentLines?: Array<{
    ItemCode: string;
    Quantity: number;
  }>;
  DocDate?: string;
  DocDueDate?: string;
};

/**
 * Enriquece um pedido com dados do SAP B1
 */
export const enrichOrderWithSapData = (
  order: Order,
  sapOrder: SapOrder
): Order => {
  return {
    ...order,
    sapDocEntry: sapOrder.DocEntry,
    sapDocNum: sapOrder.DocNum,
    customerName: sapOrder.CardName,
    shipToAddress: order.shipToAddress ?? sapOrder.Address,
    carrier: sapOrder.U_Carrier,
    priority: normalizePriority(sapOrder.U_Priority),
    slaDueAt: sapOrder.U_SLA_DueAt ?? sapOrder.DocDueDate
  };
};

/**
 * Calcula prioridade baseada em regras de negócio
 */
export const calculatePriority = (input: {
  slaDueAt?: string;
  customerId?: string;
  orderValue?: number;
}): Priority => {
  if (!input.slaDueAt) return "P3";
  
  const now = Date.now();
  const dueAt = new Date(input.slaDueAt).getTime();
  const hoursLeft = (dueAt - now) / (1000 * 60 * 60);

  // P1: menos de 4 horas
  if (hoursLeft < 4) return "P1";
  
  // P2: menos de 12 horas
  if (hoursLeft < 12) return "P2";
  
  // P3: demais casos
  return "P3";
};

/**
 * Calcula SLA baseado em tipo de cliente ou transportadora
 */
export const calculateSla = (input: {
  createdAt: string;
  carrier?: string;
  customerId?: string;
  priority?: Priority;
}): string => {
  const created = new Date(input.createdAt);
  
  // SLA padrão por prioridade
  let hoursToAdd = 24;
  if (input.priority === "P1") hoursToAdd = 6;
  else if (input.priority === "P2") hoursToAdd = 12;
  
  // Ajustes por transportadora
  if (input.carrier === "Azul Cargo") hoursToAdd = Math.min(hoursToAdd, 8);
  
  const dueAt = new Date(created.getTime() + hoursToAdd * 60 * 60 * 1000);
  return dueAt.toISOString();
};

/**
 * Normaliza string de prioridade do SAP para enum
 */
const normalizePriority = (value?: string): Priority | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === "P1" || normalized === "ALTA") return "P1";
  if (normalized === "P2" || normalized === "MEDIA") return "P2";
  if (normalized === "P3" || normalized === "BAIXA") return "P3";
  return undefined;
};

/**
 * Extrai informações de issues/pendências do pedido
 */
export const extractPendingIssues = (order: Order): string[] => {
  const issues: string[] = [];
  
  if (!order.shipToAddress || order.shipToAddress.length < 10) {
    issues.push("Endereço incompleto");
  }
  
  if (!order.carrier) {
    issues.push("Transportadora não definida");
  }
  
  if (order.items.length === 0) {
    issues.push("Pedido sem itens");
  }
  
  return issues;
};
