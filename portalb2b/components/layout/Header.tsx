"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Package, ShoppingCart } from "lucide-react";

import { useCart } from "@/lib/cart/context";
import { useInbox } from "@/lib/messages/useInbox";
import { GSN_LOGO_URL } from "@/lib/product-images";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./AccountMenu";
import { MobileNav } from "./MobileNav";

/** Navegação primária: só o fluxo de compra. Conta fica no menu do usuário. */
const NAV_ITEMS = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/catalogo", label: "Catálogo", icon: Package },
];

export function Header() {
  const { totalItems } = useCart();
  const { unreadCount } = useInbox();
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <img
                src={GSN_LOGO_URL}
                alt="Garrafaria Serra Negra"
                className="h-8 w-auto object-contain sm:h-10"
              />
              <span className="hidden border-l border-border pl-3 text-sm font-semibold text-gsn-brand sm:inline">
                Portal B2B
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-gsn-brand/10 font-semibold text-gsn-brand"
                        : "text-gsn-gray hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/mensagens"
              aria-label={`Mensagens${unreadCount > 0 ? ` (${unreadCount} sem ler)` : ""}`}
              title="Mensagens"
            >
              <Button
                variant="ghost"
                size="icon"
                className="relative text-gsn-text hover:text-gsn-brand"
              >
                <MessageSquare className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gsn-brand text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </Link>

            <Link
              href="/carrinho"
              aria-label={`Carrinho${totalItems > 0 ? ` (${totalItems} itens)` : ""}`}
              className="hidden md:inline-flex"
            >
              <Button
                variant="ghost"
                size="icon"
                className="relative text-gsn-text hover:text-gsn-brand"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gsn-brand text-[10px] font-bold text-white">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </Button>
            </Link>

            <AccountMenu variant="desktop" />
          </div>
        </div>
      </header>

      <MobileNav />
    </>
  );
}
