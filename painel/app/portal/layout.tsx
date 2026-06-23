"use client";

/**
 * @deprecated Portal B2B interno (legado). O portal oficial do cliente é o
 * `portalb2b` (servido em /b2b). Esta área foi removida do menu do painel e
 * será excluída em etapa posterior. Não adicionar novas features aqui.
 */

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { B2BAuthProvider, useB2BAuth } from "@/contexts/B2BAuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { B2BSidebar } from "@/components/b2b/B2BSidebar";
import { B2BHeader } from "@/components/b2b/B2BHeader";
import { B2B_PORTAL_URL } from "@/lib/config";

function LegacyBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800">
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Versão legada do portal. Acesse o portal oficial em{" "}
        <a href={B2B_PORTAL_URL} className="font-semibold underline hover:text-amber-900">
          {B2B_PORTAL_URL}
        </a>
        .
      </span>
    </div>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  const { customer, loading } = useB2BAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin motion-reduce:animate-none text-cockpit-accent mx-auto mb-3" />
          <p className="text-sm text-cockpit-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-cockpit-bg">
        <LegacyBanner />
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-cockpit-bg relative">
      <B2BSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <LegacyBanner />
        <B2BHeader onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <B2BAuthProvider>
      <CartProvider>
        <PortalShell>{children}</PortalShell>
      </CartProvider>
    </B2BAuthProvider>
  );
}
