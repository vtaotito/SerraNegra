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
  ShoppingCart,
  Tag,
  X,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { label: "Visão geral", path: "/", icon: LayoutDashboard },
  { label: "Pedidos de Venda", path: "/pedidos", icon: ShoppingCart },
  { label: "Documentos / Vendas", path: "/comercial/dados", icon: FileText },
  { label: "Produtos", path: "/produtos", icon: Tag },
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
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-60 border-r border-cockpit-border bg-cockpit-surface flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Menu principal"
      >
        <div className="p-4 border-b border-cockpit-border flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Cockpit BI - Página inicial">
            <div className="w-8 h-8 rounded-lg bg-cockpit-accent flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-gray-900" />
            </div>
            <span className="font-semibold text-gray-900">Cockpit BI</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-cockpit-muted hover:text-gray-900 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-widest px-4 pt-3 pb-1">
          Serra Negra
        </p>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, path, icon: Icon }) => {
            const isActive =
              path === "/" ? pathname === "/" : pathname.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out",
                  "border border-transparent",
                  isActive
                    ? "nav-link-active bg-cockpit-accent/10 text-cockpit-accent font-semibold"
                    : "text-gray-500 hover:bg-black/5 hover:text-gray-700 hover:border-cockpit-border/50"
                )}
              >
                <Icon className={clsx("w-4 h-4 shrink-0 transition-transform duration-200", isActive && "text-cockpit-accent")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-cockpit-border space-y-1">
          <p className="text-[10px] text-cockpit-muted">
            Fonte: SAP B1 + Volume Comercial 10.12
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cockpit-accent animate-pulse" />
            <span className="text-[10px] text-cockpit-muted">v0.2.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
