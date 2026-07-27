"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api/client";

export interface Salesperson {
  code: number;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

/** Só dígitos, para montar o link do WhatsApp (assume DDI 55 quando ausente). */
export function whatsappHref(whatsapp: string | null, message?: string): string | null {
  if (!whatsapp) return null;
  let digits = whatsapp.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 11) digits = `55${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

/**
 * Vendedor associado ao cliente logado (Portal B2B). Usado para exibir "seu
 * vendedor" e orientar o cliente quando o pedido excede o estoque.
 */
export function useSalesperson() {
  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    get<{ salesperson: Salesperson | null }>("/b2b/salesperson")
      .then((res) => {
        if (active) setSalesperson(res.salesperson ?? null);
      })
      .catch(() => {
        if (active) setSalesperson(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { salesperson, loading };
}
