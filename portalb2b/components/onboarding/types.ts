export type Step =
  | "cnpj"
  | "password"
  | "email"
  | "request-email"
  | "otp"
  | "set-password"
  | "register"
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
