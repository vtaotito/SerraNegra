"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, User, X } from "lucide-react";

import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_NAV_ITEMS,
  isAccountNavActive,
  isAnyAccountNavActive,
} from "./account-nav";

type AccountMenuProps = {
  /** Desktop: dropdown no header. Mobile: gatilho na barra inferior + sheet. */
  variant?: "desktop" | "mobile";
};

export function AccountMenu({ variant = "desktop" }: AccountMenuProps) {
  const { customer, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const accountActive = isAnyAccountNavActive(pathname);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);

    const prev = document.body.style.overflow;
    if (variant === "mobile") document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      if (variant === "mobile") document.body.style.overflow = prev;
    };
  }, [open, close, variant]);

  if (!customer) return null;

  const displayName = customer.cardName?.trim() || "Minha conta";
  const subtitle = customer.cnpj || customer.cardCode;

  const links = (
    <ul className="py-1" role="menu" aria-label="Menu da conta">
      {ACCOUNT_NAV_ITEMS.map((item) => {
        const active = isAccountNavActive(pathname, item.href);
        return (
          <li key={item.href} role="none">
            <Link
              href={item.href}
              role="menuitem"
              onClick={close}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "bg-gsn-brand/10 font-semibold text-gsn-brand"
                  : "text-gsn-text hover:bg-accent",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const logoutButton = (
    <div className="border-t p-1">
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          close();
          logout();
        }}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-gsn-gray transition-colors hover:bg-accent hover:text-gsn-brand"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Sair
      </button>
    </div>
  );

  if (variant === "mobile") {
    return (
      <div ref={rootRef} className="flex-1">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-medium transition-colors sm:text-[11px]",
            open || accountActive ? "text-gsn-brand" : "text-gsn-gray",
          )}
        >
          <User className="h-5 w-5 sm:h-6 sm:w-6" />
          Conta
          {(open || accountActive) && (
            <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-gsn-brand sm:inset-x-4" />
          )}
        </button>

        {open && (
          <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
            <button
              type="button"
              aria-label="Fechar menu da conta"
              className="absolute inset-0 bg-black/40"
              onClick={close}
            />
            <div
              id={menuId}
              role="dialog"
              aria-modal="true"
              aria-label="Menu da conta"
              className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t bg-white shadow-2xl pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-200"
            >
              <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gsn-text">{displayName}</p>
                  {subtitle && (
                    <p className="truncate text-xs text-gsn-gray">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar"
                  className="shrink-0 rounded-md p-1.5 text-gsn-gray hover:bg-accent hover:text-gsn-brand"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {links}
              {logoutButton}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        title="Minha conta"
        className={cn(
          "flex max-w-[220px] items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          open || accountActive
            ? "bg-gsn-brand/10 text-gsn-brand"
            : "text-gsn-gray hover:bg-accent hover:text-gsn-brand",
        )}
      >
        <User className="h-4 w-4 shrink-0" />
        <span className="hidden truncate lg:inline">{displayName}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border bg-white shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold text-gsn-text">{displayName}</p>
            {subtitle && (
              <p className="truncate text-xs text-gsn-gray">{subtitle}</p>
            )}
          </div>
          {links}
          {logoutButton}
        </div>
      )}
    </div>
  );
}
