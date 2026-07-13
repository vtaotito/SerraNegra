"use client";

import { usePathname } from "next/navigation";
import { AdminProvider } from "@/lib/admin/context";
import { AdminShell } from "@/components/admin/AdminShell";

// Rotas que rodam fora do shell (gerenciam o próprio layout):
// - /admin/login: tela de autenticação;
// - /admin/[id]: detalhe do cadastro (full-screen, com voltar próprio).
function usesShell(pathname: string): boolean {
  if (pathname === "/admin/login") return false;
  if (pathname === "/admin") return true;
  if (pathname.startsWith("/admin/catalogo")) return true;
  return false;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AdminProvider>
      {usesShell(pathname) ? <AdminShell>{children}</AdminShell> : children}
    </AdminProvider>
  );
}
