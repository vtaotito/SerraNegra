"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Package,
  BarChart3,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  Zap,
  Tag,
  UsersRound,
  Radio,
  KeyRound,
} from "lucide-react";
import { useState } from "react";
import { WMS_BASE_URL } from "@/lib/config";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/business-intelligence", label: "Business Intelligence", icon: BarChart3, roles: null, module: "cockpit" as const },
  { href: "/crm", label: "CRM", icon: Radio, roles: null, module: "cockpit" as const },
  { href: "/catalogo", label: "Catálogo", icon: Tag, roles: null, module: "cockpit" as const },
  { href: "/clientes", label: "Clientes", icon: UsersRound, roles: null, module: "cockpit" as const },
  { href: "/usuarios", label: "Usuários", icon: Users, roles: ["admin", "supervisor"] },
  { href: "/b2b-acessos", label: "Acessos B2B", icon: KeyRound, roles: ["admin", "supervisor"] },
  { href: "/integracoes", label: "Integrações", icon: Zap, roles: ["admin", "supervisor"] },
];

const moduleLinks = [
  { href: WMS_BASE_URL, label: "WMS / OMS", icon: Package, module: "wms" as const },
  { href: "/portal", label: "Portal B2B", icon: ShoppingCart, module: "b2b" as const, internal: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const filteredNav = navItems.filter((item) => {
    if ("module" in item && item.module) {
      if (!user.allowedModules.includes(item.module)) return false;
    }
    return item.roles === null || item.roles.includes(user.role);
  });

  const filteredModules = moduleLinks.filter((item) =>
    user.allowedModules.includes(item.module)
  );

  const initials = user.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className={cn(
        "flex items-center gap-3 border-b border-gray-100",
        collapsed ? "px-3 py-4 justify-center" : "px-5 py-5"
      )}>
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white shadow-sm ring-1 ring-gray-100 flex items-center justify-center overflow-hidden">
          <Image src="/favicon.png" alt="GSN" width={24} height={24} className="object-contain" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-gray-900 tracking-tight truncate">
              Garrafaria Serra Negra
            </h2>
            <p className="text-[10px] text-gray-400 font-medium truncate">Painel Administrativo</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-5 pb-3 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-300">
            Navegação
          </p>
        )}
        <div className="space-y-0.5">
          {filteredNav.map((item) => {
            const hasChildRoutes = filteredNav.some((other) => other.href !== item.href && other.href.startsWith(item.href + "/"));
            const active = item.href === "/"
              ? pathname === "/"
              : hasChildRoutes
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg text-[13px] font-medium motion-safe:transition-all duration-200",
                  collapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5",
                  active
                    ? "bg-gsn-700 text-white shadow-md shadow-gsn-700/25"
                    : "text-gray-600 hover:bg-gsn-700 hover:text-white hover:shadow-md hover:shadow-gsn-700/20"
                )}
              >
                <item.icon className={cn(
                  "w-[18px] h-[18px] flex-shrink-0 motion-safe:transition-colors duration-200",
                  active ? "text-white" : "text-gray-400 group-hover:text-white"
                )} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* External modules */}
        {filteredModules.length > 0 && (
          <>
            <div className={cn("my-4", collapsed ? "mx-2" : "mx-3")}>
              <div className="h-px bg-gray-100" />
            </div>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-300">
                Módulos externos
              </p>
            )}
            <div className="space-y-0.5">
              {filteredModules.map((item) =>
                "internal" in item && item.internal ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gsn-700 hover:text-white motion-safe:transition-all duration-200",
                      collapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0 text-gray-400 group-hover:text-white motion-safe:transition-colors duration-200" />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener"
                    className={cn(
                      "group flex items-center gap-3 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gsn-700 hover:text-white motion-safe:transition-all duration-200",
                      collapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0 text-gray-400 group-hover:text-white motion-safe:transition-colors duration-200" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-white/60 motion-safe:transition-colors duration-200" />
                      </>
                    )}
                  </a>
                )
              )}
            </div>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-3 py-3">
        <Link
          href="/perfil"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-2.5 py-2.5 mb-1 motion-safe:transition-colors duration-200 hover:bg-gray-50",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-gsn-700 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 shadow-sm">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-900 truncate group-hover:text-gsn-700 motion-safe:transition-colors">{user.displayName}</p>
              <p className="text-[10px] text-gray-400 truncate capitalize">{user.role}</p>
            </div>
          )}
        </Link>
        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3 w-full rounded-lg text-[13px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 motion-safe:transition-all duration-200",
            collapsed ? "px-3 py-2 justify-center" : "px-3 py-2"
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button — z-[80] stays above date picker (z-[60]) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[80] p-2.5 rounded-xl bg-white text-gray-700 shadow-lg shadow-black/5 ring-1 ring-gray-100"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-[80] w-72 bg-white shadow-2xl shadow-black/10 transform motion-safe:transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 motion-safe:transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-white border-r border-gray-100 motion-safe:transition-all duration-200 flex-shrink-0 relative",
          collapsed ? "w-[72px]" : "w-[264px]"
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute bottom-24 -right-3 w-6 h-6 rounded-full bg-white text-gray-400 hover:text-gsn-700 flex items-center justify-center shadow-md ring-1 ring-gray-100 motion-safe:transition-colors duration-200"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </aside>
    </>
  );
}
