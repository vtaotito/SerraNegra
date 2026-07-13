"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldCheck,
  LogOut,
  Users,
  PackageSearch,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAdmin } from "@/lib/admin/context";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Acessos B2B",
    icon: Users,
    description: "Cadastros e liberações de acesso",
  },
  {
    href: "/admin/catalogo",
    label: "Gestão de Catálogo",
    icon: PackageSearch,
    description: "Produtos, imagens, SEO e categorias",
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/**
 * Shell do painel admin: navegação persistente (sidebar no desktop, menu
 * deslizante no mobile) unindo os módulos, header compartilhado e guarda de
 * autenticação. Envolve o conteúdo das páginas de módulo.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user, logout } = useAdmin();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/admin/login");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const current = NAV.find((n) => isActive(pathname, n.href)) ?? NAV[0];

  const navList = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-emerald-500/10 text-white ring-1 ring-emerald-500/40"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-5 w-5 flex-shrink-0",
                active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300",
              )}
            />
            <span className="min-w-0">
              <span className="block font-medium">{item.label}</span>
              <span className="block text-[11px] text-slate-500">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-950/70 px-4 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <div className="leading-tight">
            <p className="text-sm font-bold">Painel Comercial</p>
            <p className="text-[11px] text-slate-500">Garrafaria Serra Negra</p>
          </div>
        </div>
        {navList}
        <div className="mt-auto border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">{user}</p>
              <p className="text-[11px] text-slate-500">Administrador</p>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace("/admin/login");
              }}
              aria-label="Sair"
              className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Menu mobile (slide-over) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5">
            <div className="mb-6 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                <p className="text-sm font-bold">Painel Comercial</p>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList}
            <button
              onClick={() => {
                logout();
                router.replace("/admin/login");
              }}
              className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair ({user})
            </button>
          </div>
        </div>
      )}

      <div className="md:pl-64">
        {/* Header compartilhado */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            className="rounded-md p-2 text-slate-300 hover:bg-slate-800 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <current.icon className="h-5 w-5 text-emerald-400" />
            <h1 className="text-base font-semibold">{current.label}</h1>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
