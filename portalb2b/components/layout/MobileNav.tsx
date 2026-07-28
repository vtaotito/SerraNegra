"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/lib/cart/context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingCart,
  User,
} from "lucide-react";

const ITEMS = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/catalogo", label: "Catálogo", icon: Package },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/carrinho", label: "Carrinho", icon: ShoppingCart, badge: true },
  { href: "/entrega", label: "Conta", icon: User },
] as const;

/**
 * Barra de navegação inferior (mobile-first). Fixa na base da viewport, some
 * a partir de md. Respeita a safe-area do iOS (viewport-fit=cover no layout).
 */
export function MobileNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const showBadge = "badge" in item && item.badge && totalItems > 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-medium transition-colors sm:text-[11px]",
                  isActive ? "text-gsn-brand" : "text-gsn-gray",
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gsn-brand px-1 text-[9px] font-bold leading-none text-white">
                      {totalItems > 99 ? "99+" : totalItems}
                    </span>
                  )}
                </span>
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-gsn-brand sm:inset-x-4" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
