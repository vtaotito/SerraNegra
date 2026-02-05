import { format as formatDateFns, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formata valor monetário
 */
export function formatCurrency(value: number, currency?: string | null): string {
  // SAP B1 retorna moedas como "R$", "US$" etc - precisamos mapear para códigos ISO
  const currencyMap: Record<string, string> = {
    "R$": "BRL",
    "US$": "USD",
    "€": "EUR",
    "$": "USD",
  };

  const currencyCode = currency ? (currencyMap[currency] || currency) : "BRL";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

/**
 * Formata data
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return formatDateFns(dateObj, "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Formata data e hora
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return formatDateFns(dateObj, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/**
 * Formata data relativa (ex: "há 2 horas")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) return "agora";
  if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} h`;
  if (diffInSeconds < 604800) return `há ${Math.floor(diffInSeconds / 86400)} d`;
  
  return formatDate(dateObj);
}

/**
 * Formata número
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
