export type Step =
  | "cnpj"
  | "password"
  | "email"
  | "request-email"
  | "otp"
  | "set-password"
  | "register"
  | "delivery"
  | "pending-approval";

export interface LookupResult {
  status: "has_password" | "needs_verification" | "not_found";
  cardCode?: string;
  cardName?: string;
  maskedEmail?: string;
  hasEmail?: boolean;
  emailRequestStatus?: "pending" | "none";
}

export type PendingKind = "register" | "email-access";

export interface RegForm {
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  contactName: string;
}

export const EMPTY_REG_FORM: RegForm = {
  razaoSocial: "",
  nomeFantasia: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  contactName: "",
};

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Dados de entrega do novo cliente B2B. Segue EXATAMENTE o contrato de API
 * compartilhado com o gateway (camelCase). Quando `sameAsBilling` for true, os
 * campos de endereço podem ir vazios: o backend replica o endereço de cobrança.
 */
export interface DeliveryForm {
  sameAsBilling: boolean;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  deliveryDays: string;
  deliveryHours: string;
  vehicleRestriction: string;
  needsScheduling: boolean;
  notes: string;
}

export const EMPTY_DELIVERY_FORM: DeliveryForm = {
  sameAsBilling: true,
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  deliveryDays: "",
  deliveryHours: "",
  vehicleRestriction: "",
  needsScheduling: false,
  notes: "",
};

/** Máscara leve de CEP: 00000-000. */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Máscara leve de telefone BR: (00) 00000-0000 ou (00) 0000-0000. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** CEP válido = 8 dígitos (ou vazio, pois é opcional quando mesmo endereço). */
export function isValidCep(value: string): boolean {
  return value.replace(/\D/g, "").length === 8;
}
