"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdmin } from "@/lib/admin/context";
import { adminGet } from "@/lib/admin/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ShieldCheck,
  LogOut,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

interface Registration {
  id: number;
  cnpj: string;
  razao_social: string;
  email: string;
  city: string | null;
  state: string | null;
  status: string;
  created_at: string;
  reviewed_by: string | null;
  sap_card_code: string | null;
  sap_error: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "warning" | "success" | "destructive" | "info"; icon: typeof Clock }
> = {
  pending: { label: "Pendente", variant: "warning", icon: Clock },
  approved: { label: "Aprovado", variant: "info", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", variant: "destructive", icon: XCircle },
  published: { label: "Publicado", variant: "success", icon: Send },
};

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, logout } = useAdmin();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadRegistrations();
  }, [isAuthenticated, filter]);

  async function loadRegistrations() {
    setLoading(true);
    setError("");
    try {
      const url = filter
        ? `/b2b/admin/registrations?status=${filter}`
        : "/b2b/admin/registrations";
      const data = await adminGet<{ items: Registration[] }>(url);
      setRegistrations(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const counts = registrations.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-800/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <h1 className="text-lg font-bold">Painel Comercial</h1>
            <span className="text-sm text-slate-400">({user})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { logout(); router.replace("/admin/login"); }}
            className="text-slate-400 hover:text-white"
          >
            <LogOut className="mr-1 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["pending", "approved", "rejected", "published"] as const).map((s) => {
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? null : s)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  filter === s
                    ? "border-emerald-500 bg-emerald-900/30"
                    : "border-slate-700 bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </div>
                <div className="mt-1 text-2xl font-bold">{counts[s] ?? 0}</div>
              </button>
            );
          })}
        </div>

        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5" />
                Cadastros {filter ? `(${STATUS_CONFIG[filter]?.label})` : ""}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {registrations.length} registro(s)
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadRegistrations}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                Nenhum cadastro encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {registrations.map((reg) => {
                  const cfg = STATUS_CONFIG[reg.status] ?? STATUS_CONFIG.pending;
                  return (
                    <Link
                      key={reg.id}
                      href={`/admin/${reg.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-slate-600 hover:bg-slate-700/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {reg.razao_social}
                          </span>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>{formatCnpj(reg.cnpj)}</span>
                          <span>{reg.email}</span>
                          {reg.city && reg.state && (
                            <span>{reg.city}/{reg.state}</span>
                          )}
                          <span>
                            {new Date(reg.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {reg.sap_error && (
                          <div className="mt-1 text-xs text-red-400 truncate">
                            Erro SAP: {reg.sap_error.slice(0, 100)}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="ml-3 h-5 w-5 flex-shrink-0 text-slate-500" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
