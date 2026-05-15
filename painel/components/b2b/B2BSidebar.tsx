"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  ShoppingCart,
  LogOut,
  X,
} from "lucide-react";
import { useB2BAuth } from "@/contexts/B2BAuthContext";
import { useCart } from "@/contexts/CartContext";

const NAV_ITEMS = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/pedidos", label: "Meus Pedidos", icon: ClipboardList },
  { href: "/portal/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/portal/carrinho", label: "Carrinho", icon: ShoppingCart, showBadge: true },
];

interface B2BSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function B2BSidebar({ open, onClose }: B2BSidebarProps) {
  const pathname = usePathname();
  const { customer, logout } = useB2BAuth();
  const { totalItems } = useCart();

  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-cockpit-border flex flex-col transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-cockpit-border">
          <Link href="/portal" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-cockpit-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">GSN</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">Portal B2B</p>
              <p className="text-[10px] text-cockpit-muted">Garrafaria Serra Negra</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-cockpit-bg lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {customer && (
          <div className="px-5 py-3 border-b border-cockpit-border bg-cockpit-bg/50">
            <p className="text-xs text-cockpit-muted">Logado como</p>
            <p className="text-sm font-medium text-gray-900 truncate">{customer.cardName}</p>
            <p className="text-[10px] text-cockpit-muted truncate">{customer.cnpj}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-cockpit-accent/10 text-cockpit-accent"
                    : "text-gray-600 hover:bg-cockpit-bg hover:text-gray-900"
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.showBadge && totalItems > 0 && (
                  <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-cockpit-accent text-white text-[10px] font-bold">
                    {totalItems}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-cockpit-border">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
