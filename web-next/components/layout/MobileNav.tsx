"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const menuItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: ShoppingCart,
  },
  {
    href: "/produtos",
    label: "Produtos",
    icon: Package,
  },
  {
    href: "/estoque",
    label: "Estoque",
    icon: Warehouse,
  },
  {
    href: "/integracao",
    label: "Integração",
    icon: RefreshCw,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
      <ul className="flex items-center justify-around">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
