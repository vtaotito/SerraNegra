"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Largura do painel no desktop (mobile é full-screen). */
  className?: string;
  /** Fecha ao pressionar Esc (padrão: true). */
  closeOnEsc?: boolean;
}

/**
 * Drawer lateral (desliza da direita). Full-screen no mobile, painel no
 * desktop. Fecha por Esc, clique no backdrop ou botão. Trava o scroll do body.
 */
export function Drawer({ open, onClose, children, className, closeOnEsc = true }: DrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, closeOnEsc]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-y-auto border-l border-slate-700 bg-slate-900 shadow-2xl sm:max-w-xl",
          "animate-in slide-in-from-right duration-200",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface DrawerHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}

export function DrawerHeader({ title, description, onClose, children }: DrawerHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-700 bg-slate-900/95 px-5 py-4 backdrop-blur">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
        {description && (
          <p className="mt-0.5 truncate text-xs text-slate-400">{description}</p>
        )}
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 space-y-6 px-5 py-5", className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-slate-700 bg-slate-900/95 px-5 py-4 backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
