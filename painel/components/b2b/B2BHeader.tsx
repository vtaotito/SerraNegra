"use client";

import Link from "next/link";
import { Menu, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface B2BHeaderProps {
  onMenuToggle: () => void;
}

export function B2BHeader({ onMenuToggle }: B2BHeaderProps) {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-cockpit-border lg:hidden">
      <div className="flex items-center justify-between px-4 h-14">
        <button
          type="button"
          onClick={onMenuToggle}
          className="p-2 -ml-2 rounded-lg hover:bg-cockpit-bg"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>

        <Link href="/portal" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cockpit-accent flex items-center justify-center">
            <span className="text-white font-bold text-xs">GSN</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">Portal B2B</span>
        </Link>

        <Link href="/portal/carrinho" className="p-2 -mr-2 rounded-lg hover:bg-cockpit-bg relative">
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          {totalItems > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-cockpit-accent text-white text-[9px] font-bold">
              {totalItems}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
