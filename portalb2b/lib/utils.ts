import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// O SAP devolve a moeda como símbolo (ex.: "R$"), mas Intl.NumberFormat exige
// o código ISO 4217 ("BRL"). Sem essa normalização, "R$" lança
// RangeError: Invalid currency code e derruba a renderização da página.
const CURRENCY_SYMBOL_TO_ISO: Record<string, string> = {
  "R$": "BRL",
  REAL: "BRL",
  REAIS: "BRL",
  "US$": "USD",
  $: "USD",
  "€": "EUR",
};

function normalizeCurrencyCode(currency?: string | null): string {
  if (!currency) return "BRL";
  const code = currency.trim().toUpperCase();
  if (CURRENCY_SYMBOL_TO_ISO[code]) return CURRENCY_SYMBOL_TO_ISO[code];
  // Códigos ISO 4217 válidos têm exatamente 3 letras; qualquer outra coisa
  // (símbolos, vazio) cai no padrão BRL para nunca quebrar a formatação.
  return /^[A-Z]{3}$/.test(code) ? code : "BRL";
}

export function formatCurrency(value: number, currency = "BRL"): string {
  const code = normalizeCurrencyCode(currency);
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
