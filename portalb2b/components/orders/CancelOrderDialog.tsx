"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Ban, Loader2, X } from "lucide-react";

/**
 * Diálogo de confirmação de cancelamento de pedido/solicitação no Portal B2B.
 * O motivo é opcional e enviado à equipe de vendas.
 */
export function CancelOrderDialog({
  title,
  description,
  confirmLabel = "Cancelar pedido",
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gsn-text">
            <Ban className="h-4 w-4 text-destructive" /> {title}
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{description}</span>
          </div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Motivo do cancelamento (opcional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Conte o motivo do cancelamento…"
            className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-gsn-brand/30 sm:text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
