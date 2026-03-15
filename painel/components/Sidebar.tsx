"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  LogOut,
  Wine,
  Package,
  BarChart3,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { WMS_BASE_URL } from "@/lib/config";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/usuarios", label: "Usuários", icon: Users, roles: ["admin", "supervisor"] },
  { href: "/perfil", label: "Meu Perfil", icon: UserCircle, roles: null },
];

const moduleLinks = [
  { href: WMS_BASE_URL, label: "WMS / OMS", icon: Package, module: "wms" as const },
  { href: `${WMS_BASE_URL}/cockpit`, label: "Cockpit BI", icon: BarChart3, module: "cockpit" as const },
  { href: `${WMS_BASE_URL}/b2b`, label: "Portal B2B", icon: ShoppingCart, module: "b2b" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const filteredNav = navItems.filter(
    (item) => item.roles === null || item.roles.includes(user.role)
  );

  const filteredModules = moduleLinks.filter((item) =>
    user.allowedModules.includes(item.module)
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
          <Wine className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">Garrafaria</h2>
            <p className="text-[10px] text-slate-400 truncate">Serra Negra</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="mb-3">
          {!collapsed && (
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Painel
            </span>
          )}
        </div>
        {filteredNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                active
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Modules */}
        <div className="mt-6 mb-3">
          {!collapsed && (
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Módulos
            </span>
          )}
        </div>
        {filteredModules.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] text-slate-600">↗</span>
              </>
            )}
          </a>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700 px-3 py-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
            {user.displayName
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">{user.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-white/5 transition"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200 flex-shrink-0",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute bottom-20 -right-3 w-6 h-6 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center shadow-lg"
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
