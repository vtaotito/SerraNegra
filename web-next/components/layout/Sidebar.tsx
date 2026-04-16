"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

const menuItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Visão geral",
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: ShoppingCart,
    description: "Gerenciar pedidos",
  },
  {
    href: "/produtos",
    label: "Produtos",
    icon: Package,
    description: "Catálogo",
  },
  {
    href: "/estoque",
    label: "Estoque",
    icon: Warehouse,
    description: "Inventário",
  },
  {
    href: "/integracao",
    label: "Integração",
    icon: RefreshCw,
    description: "SAP B1",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 flex-col fixed left-0 top-0 h-screen border-r bg-card z-30">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-lg font-bold">WMS</span>
            <span className="text-xs text-muted-foreground ml-1">Serra Negra</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-3 px-3">
          Menu
        </p>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Separator className="my-4" />

        <div className="px-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Sistema online</span>
          </div>
        </div>
      </nav>

      <div className="border-t p-4 space-y-3">
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" type="submit">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">v0.1.0</Badge>
          <span className="text-[10px] text-muted-foreground">
            Garrafaria Serra Negra
          </span>
        </div>
      </div>
    </aside>
  );
}
