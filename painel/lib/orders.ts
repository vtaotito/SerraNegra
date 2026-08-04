// ---------------------------------------------------------------------------
// Helpers para classificar pedidos de venda — Garrafaria Serra Negra
//
// Regra de negócio:
//   Pedidos com nenhuma linha (num_lines === 0) representam cobranças de
//   **frete avulso** ao cliente — não devem entrar no faturamento de produto.
//   Esses pedidos são tratados na aba Fretes de /pedidos?view=fretes.
// ---------------------------------------------------------------------------

import type { SalesOrderRow, SalesOrderLine } from "@/lib/cockpit-api";

/**
 * Contagem de linhas reais de um pedido — prefere o array `lines`
 * (mais confiável quando já foi sincronizado) e cai para `num_lines`.
 */
export function getOrderLineCount(order: Pick<SalesOrderRow, "lines" | "num_lines">): number {
  if (Array.isArray(order.lines) && order.lines.length > 0) return order.lines.length;
  return Number(order.num_lines) || 0;
}

/**
 * Verdadeiro quando o pedido é um "pedido de frete":
 *   - 0 linhas de produto, ou
 *   - linhas existem mas todas com quantidade nula.
 *
 * Mantém regra simples para evitar falsos positivos.
 */
export function isFreightOrder(order: Pick<SalesOrderRow, "lines" | "num_lines" | "total_quantity">): boolean {
  const lineCount = getOrderLineCount(order);
  if (lineCount === 0) return true;
  // Caso raro: linhas com qty=0 e total_quantity=0
  if (Array.isArray(order.lines) && order.lines.length > 0) {
    const allZeroQty = order.lines.every((l: SalesOrderLine) => (Number(l.Quantity) || 0) === 0);
    if (allZeroQty && (Number(order.total_quantity) || 0) === 0) return true;
  }
  return false;
}

/** Retorna apenas os pedidos que NÃO são de frete (faturamento de produto). */
export function excludeFreight<T extends Pick<SalesOrderRow, "lines" | "num_lines" | "total_quantity">>(orders: T[]): T[] {
  return orders.filter((o) => !isFreightOrder(o));
}

/** Retorna apenas os pedidos de frete (cobranças avulsas). */
export function onlyFreight<T extends Pick<SalesOrderRow, "lines" | "num_lines" | "total_quantity">>(orders: T[]): T[] {
  return orders.filter(isFreightOrder);
}

/** Conta quantos pedidos de frete há na lista. */
export function countFreight<T extends Pick<SalesOrderRow, "lines" | "num_lines" | "total_quantity">>(orders: T[]): number {
  let n = 0;
  for (const o of orders) if (isFreightOrder(o)) n++;
  return n;
}

/** Soma o valor total dos pedidos de frete ativos (não cancelados). */
export function sumFreightValue(orders: SalesOrderRow[]): number {
  let total = 0;
  for (const o of orders) {
    if (o.cancelled === "Y") continue;
    if (isFreightOrder(o)) total += Number(o.doc_total) || 0;
  }
  return total;
}
