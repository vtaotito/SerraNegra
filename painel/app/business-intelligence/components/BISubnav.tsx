"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, type KeyboardEvent } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Wallet,
  UserCircle,
  TrendingUp,
  BarChart3,
  Target,
  DollarSign,
  Calculator,
  Megaphone,
} from "lucide-react";
import { BI_ROUTE_PREFIX } from "@/lib/bi-routes";

type NavItem = { label: string; path: string };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Visão",
    items: [{ label: "Visão geral", path: "" }],
  },
  {
    label: "Marketing",
    items: [{ label: "Marketing & CRM", path: "/marketing" }],
  },
  {
    label: "Comercial",
    items: [
      { label: "Pedidos", path: "/pedidos" },
      { label: "Documentos", path: "/comercial/dados" },
      { label: "Estoque", path: "/estoque" },
      { label: "Carteira", path: "/carteira" },
      { label: "Vendedores", path: "/vendedores" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Margens", path: "/margens" },
      { label: "Resumo", path: "/resumo" },
      { label: "Faturamento", path: "/faturamento" },
      { label: "Preços", path: "/precos" },
    ],
  },
  {
    label: "Cadastros",
    items: [{ label: "MarkUp", path: "/markup" }],
  },
];

const ICONS: Record<string, typeof LayoutDashboard> = {
  "": LayoutDashboard,
  "/pedidos": ShoppingCart,
  "/comercial/dados": FileText,
  "/estoque": Package,
  "/carteira": Wallet,
  "/vendedores": UserCircle,
  "/margens": TrendingUp,
  "/resumo": BarChart3,
  "/faturamento": Target,
  "/precos": DollarSign,
  "/markup": Calculator,
  "/marketing": Megaphone,
};

export function BISubnav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  const focusLinkByDelta = useCallback((delta: number) => {
    const nav = navRef.current;
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href^="/business-intelligence"]'));
    const i = links.findIndex((el) => el === document.activeElement);
    const next = i < 0 ? 0 : Math.min(Math.max(0, i + delta), links.length - 1);
    links[next]?.focus();
  }, []);

  const onNavKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusLinkByDelta(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusLinkByDelta(-1);
      }
    },
    [focusLinkByDelta]
  );

  return (
    <div className="mt-4 relative">
      <nav
        ref={navRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none touch-scroll -mx-1 px-1"
        aria-label="Navegação BI"
        onKeyDown={onNavKeyDown}
      >
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className="flex gap-1 shrink-0 items-center">
            {gi > 0 && (
              <div
                className="hidden sm:block w-px h-6 bg-cockpit-border shrink-0 mx-0.5"
                aria-hidden
              />
            )}
            <span className="sr-only">{group.label}</span>
            {group.items.map(({ label, path }) => {
              const href = `${BI_ROUTE_PREFIX}${path}`;
              const Icon = ICONS[path] ?? LayoutDashboard;
              const isActive =
                path === ""
                  ? pathname === BI_ROUTE_PREFIX || pathname === `${BI_ROUTE_PREFIX}/`
                  : pathname.startsWith(href);

              return (
                <Link
                  key={path}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-medium whitespace-nowrap motion-safe:transition-all motion-safe:duration-200 min-h-[44px] sm:min-h-0 shrink-0 ${
                    isActive
                      ? "bg-cockpit-accent/10 text-cockpit-accent border border-cockpit-accent/20"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent active:bg-gray-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sm:hidden absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
    </div>
  );
}
