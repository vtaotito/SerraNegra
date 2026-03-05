"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Wallet,
  UserCircle,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { label: "Visão geral", path: "/", icon: LayoutDashboard },
  { label: "Documentos / Vendas", path: "/comercial/dados", icon: FileText },
  { label: "Estoque", path: "/estoque", icon: Package },
  { label: "Clientes", path: "/clientes", icon: Users },
  { label: "Carteira", path: "/carteira", icon: Wallet },
  { label: "Vendedores", path: "/vendedores", icon: UserCircle },
  { label: "CMV / Margens", path: "/margens", icon: TrendingUp },
  { label: "Resumo Comercial", path: "/resumo", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-cockpit-border bg-cockpit-surface flex flex-col">
      <div className="p-4 border-b border-cockpit-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cockpit-accent flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">Cockpit BI</span>
        </Link>
        <p className="text-xs text-cockpit-muted mt-1">Serra Negra</p>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, path, icon: Icon }) => {
          const isActive =
            path === "/" ? pathname === "/" : pathname.startsWith(path);
          return (
            <Link
              key={path}
              href={path}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-cockpit-accent/20 text-cockpit-accent border border-cockpit-accent/30"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-cockpit-border">
        <p className="text-xs text-cockpit-muted">
          Dados: Volume Comercial
        </p>
      </div>
    </aside>
  );
}
