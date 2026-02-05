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
import { Separator } from "@/components/ui/separator";

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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 flex-col fixed left-0 top-0 h-screen border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Package className="h-6 w-6 text-primary" />
          <span className="text-lg">WMS/OMS</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Separator className="my-4" />

        {/* Footer Info */}
        <div className="px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium">Versão 0.1.0</p>
          <p className="mt-1">Backend: localhost:8000</p>
        </div>
      </nav>
    </aside>
  );
}
