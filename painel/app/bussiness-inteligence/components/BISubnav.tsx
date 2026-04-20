"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, FileText, Package,
  Wallet, UserCircle, TrendingUp, BarChart3, Target, DollarSign, Calculator,
} from "lucide-react";

const BI_PREFIX = "/bussiness-inteligence";

const navItems = [
  { label: "Visão geral", path: "", icon: LayoutDashboard },
  { label: "Pedidos", path: "/pedidos", icon: ShoppingCart },
  { label: "Documentos", path: "/comercial/dados", icon: FileText },
  { label: "Estoque", path: "/estoque", icon: Package },
  { label: "Carteira", path: "/carteira", icon: Wallet },
  { label: "Vendedores", path: "/vendedores", icon: UserCircle },
  { label: "Margens", path: "/margens", icon: TrendingUp },
  { label: "Resumo", path: "/resumo", icon: BarChart3 },
  { label: "Faturamento", path: "/faturamento", icon: Target },
  { label: "Preços", path: "/precos", icon: DollarSign },
  { label: "MarkUp", path: "/markup", icon: Calculator },
];

export function BISubnav() {
  const pathname = usePathname();

  return (
    <div className="mt-4 relative">
      <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-none touch-scroll -mx-1 px-1" aria-label="Navegação BI">
        {navItems.map(({ label, path, icon: Icon }) => {
          const href = `${BI_PREFIX}${path}`;
          const isActive = path === ""
            ? pathname === BI_PREFIX || pathname === `${BI_PREFIX}/`
            : pathname.startsWith(href);

          return (
            <Link
              key={path}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 min-h-[40px] sm:min-h-0 shrink-0 ${
                isActive
                  ? "bg-cockpit-accent/10 text-cockpit-accent border border-cockpit-accent/20"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent active:bg-gray-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="sm:hidden absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
    </div>
  );
}
