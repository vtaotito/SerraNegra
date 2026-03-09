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
  Target,
  X,
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
  { label: "Fat. Mês Atual", path: "/faturamento", icon: Target },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-60 border-r border-cockpit-border bg-cockpit-surface flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-cockpit-border flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cockpit-accent flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Cockpit BI</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-cockpit-muted hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-cockpit-muted px-4 pt-2">Serra Negra</p>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, path, icon: Icon }) => {
            const isActive =
              path === "/" ? pathname === "/" : pathname.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                onClick={onClose}
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
            Fonte: Volume Comercial 10.12
          </p>
        </div>
      </aside>
    </>
  );
}
