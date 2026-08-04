"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  X, User, Hash, MapPin, Phone, Mail, ShoppingCart, Tag,
} from "lucide-react";
import clsx from "clsx";

export interface ClientDetailData {
  codigo: string;
  cliente: string;
  tipo: string;
  cidade: string;
  estado: string;
  telefone: string;
  email: string;
  ativo: boolean;
}

interface ClientDetailDrawerProps {
  client: ClientDetailData | null;
  open: boolean;
  onClose: () => void;
}

export function ClientDetailDrawer({ client, open, onClose }: ClientDetailDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(t);
      prev?.focus?.();
    };
  }, [open]);

  if (!client) return null;

  const pedidosUrl = `/pedidos?view=analise&cardCode=${encodeURIComponent(client.codigo)}&clientName=${encodeURIComponent(client.cliente)}`;

  return (
    <>
      <div
        role="presentation"
        aria-hidden={!open}
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-40 drawer-overlay motion-safe:transition-opacity motion-safe:duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />
      <aside
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Detalhes do cliente"
        role="dialog"
        className={clsx(
          "fixed top-0 right-0 z-50 w-full max-w-md h-full bg-white shadow-2xl border-l border-cockpit-border flex flex-col overflow-hidden motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-x-0 motion-reduce:translate-x-0" : "translate-x-full motion-reduce:translate-x-full pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-cockpit-border bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cockpit-accent/10">
              <User className="w-5 h-5 text-cockpit-accent" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Detalhes do cliente</h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-cockpit-muted hover:bg-black/5 hover:text-gray-900 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cockpit-accent focus-visible:ring-offset-2"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="rounded-xl border border-cockpit-border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 truncate" title={client.cliente}>
              {client.cliente}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Hash className="w-3.5 h-3.5 text-cockpit-muted" aria-hidden />
              <span className="text-xs font-mono text-gray-500">{client.codigo}</span>
              <span
                className={clsx(
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  client.ativo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                )}
              >
                {client.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-cockpit-accent/10 text-cockpit-accent">
                <Tag className="w-3 h-3" aria-hidden />
                {client.tipo}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">
              Localização
            </h3>
            <div className="rounded-lg border border-cockpit-border/50 bg-gray-50/50 p-3 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-cockpit-muted shrink-0 mt-0.5" aria-hidden />
              <div className="text-sm text-gray-700">
                {[client.cidade, client.estado].filter(Boolean).join(" — ") || "—"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">
              Contato
            </h3>
            <div className="space-y-2">
              {client.telefone && client.telefone !== "—" && (
                <div className="rounded-lg border border-cockpit-border/50 bg-gray-50/50 p-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-cockpit-muted shrink-0" aria-hidden />
                  <span className="text-sm text-gray-700">{client.telefone}</span>
                </div>
              )}
              {client.email && client.email !== "—" && (
                <div className="rounded-lg border border-cockpit-border/50 bg-gray-50/50 p-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cockpit-muted shrink-0" aria-hidden />
                  <a
                    href={`mailto:${client.email}`}
                    className="text-sm text-cockpit-accent hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cockpit-accent rounded"
                  >
                    {client.email}
                  </a>
                </div>
              )}
              {(!client.telefone || client.telefone === "—") && (!client.email || client.email === "—") && (
                <p className="text-sm text-cockpit-muted italic">Sem contato cadastrado</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Link
              href={pedidosUrl}
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accent/90 motion-safe:active:scale-[0.98] motion-safe:transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cockpit-accent"
            >
              <ShoppingCart className="w-4 h-4" aria-hidden />
              Ver pedidos deste cliente
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
