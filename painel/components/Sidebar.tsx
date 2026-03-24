"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  LogOut,
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

const GSN_LOGO = "https://garrafariaserranegra.com.br/wp-content/uploads/2021/03/cropped-gsn-logo2021.png";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/bussiness-inteligence", label: "Business Intelligence", icon: BarChart3, roles: null, module: "cockpit" as const },
  { href: "/usuarios", label: "Usuários", icon: Users, roles: ["admin", "supervisor"] },
  { href: "/perfil", label: "Meu Perfil", icon: UserCircle, roles: null },
];

const moduleLinks = [
  { href: WMS_BASE_URL, label: "WMS / OMS", icon: Package, module: "wms" as const },
  { href: `${WMS_BASE_URL}/b2b`, label: "Portal B2B", icon: ShoppingCart, module: "b2b" as const },
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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
          <Image src={GSN_LOGO} alt="GSN" width={28} height={28} className="object-contain" unoptimized />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">Garrafaria</h2>
            <p className="text-[10px] text-gsn-300 truncate">Serra Negra</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="mb-3">
          {!collapsed && (
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-gsn-400/60">
              Painel
            </span>
          )}
        </div>
        {filteredNav.map((item) => {
          const active = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                active
                  ? "bg-gsn-700/40 text-white font-medium shadow-sm shadow-gsn-950/20"
                  : "text-gsn-200/70 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        <div className="mt-6 mb-3">
          {!collapsed && (
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-gsn-400/60">
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gsn-200/70 hover:text-white hover:bg-white/5 transition-all duration-150"
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] text-gsn-400/40">↗</span>
              </>
            )}
          </a>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gsn-700/50 flex items-center justify-center text-xs font-medium text-white flex-shrink-0 ring-1 ring-gsn-600/30">
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
              <p className="text-[10px] text-gsn-300/60 truncate capitalize">{user.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gsn-200/70 hover:text-red-300 hover:bg-white/5 transition"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gsn-900 text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gsn-950 transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-gsn-300 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      <aside
        className={cn(
          "hidden lg:flex flex-col bg-gsn-950 border-r border-gsn-900 transition-all duration-200 flex-shrink-0",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute bottom-20 -right-3 w-6 h-6 rounded-full bg-gsn-800 text-gsn-200 hover:bg-gsn-700 flex items-center justify-center shadow-lg ring-1 ring-gsn-700/50"
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
