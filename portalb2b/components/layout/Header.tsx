"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useCart } from "@/lib/cart/context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  Package,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  User,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { GSN_LOGO_URL } from "@/lib/product-images";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/catalogo", label: "Catalogo", icon: Package },
  { href: "/pedidos", label: "Meus Pedidos", icon: ClipboardList },
];

export function Header() {
  const { customer, logout } = useAuth();
  const { totalItems } = useCart();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={GSN_LOGO_URL}
              alt="Garrafaria Serra Negra"
              width={140}
              height={33}
              className="h-8 w-auto object-contain"
              priority
            />
            <span className="text-sm font-semibold text-gsn-brand hidden sm:inline border-l border-border pl-3">
              Portal B2B
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gsn-brand/10 text-gsn-brand font-semibold"
                      : "text-gsn-gray hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/carrinho">
            <Button variant="ghost" size="icon" className="relative text-gsn-text hover:text-gsn-brand">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gsn-brand text-[10px] font-bold text-white">
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>

          {customer && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gsn-gray">
              <User className="h-4 w-4" />
              <span className="max-w-[150px] truncate">{customer.cardName}</span>
            </div>
          )}

          <Button variant="ghost" size="icon" onClick={logout} title="Sair" className="text-gsn-gray hover:text-gsn-brand">
            <LogOut className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t md:hidden px-4 py-3 space-y-1 bg-white">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                  isActive ? "bg-gsn-brand/10 text-gsn-brand" : "text-gsn-gray hover:bg-accent"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
