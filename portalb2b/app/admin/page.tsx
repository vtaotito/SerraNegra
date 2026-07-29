"use client";

import { useEffect, useState } from "react";
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
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  ChevronRight,
  Mail,
  PackageSearch,
} from "lucide-react";
import { EmailRequestsPanel } from "@/components/admin/EmailRequestsPanel";

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
  in_review: { label: "Em análise", variant: "info", icon: Clock },
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
  const { isAuthenticated } = useAdmin();
  const [tab, setTab] = useState<"registrations" | "email-requests">(
    "registrations",
  );
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || tab !== "registrations") return;
    loadRegistrations();
  }, [isAuthenticated, filter, tab]);

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

  const counts = registrations.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="text-white">
      <div className="mb-6">
        <Link
          href="/admin/catalogo"
          className="group flex items-center justify-between rounded-xl border border-slate-700 bg-gradient-to-r from-emerald-950/40 to-slate-800/40 p-4 transition-all hover:border-emerald-500/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <PackageSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Gestão de Catálogo</p>
              <p className="text-xs text-slate-400">
                Controle visibilidade por categoria, edite produtos, imagens e SEO.
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-emerald-400" />
        </Link>
      </div>

      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-400">
          <Users className="h-4 w-4" />
          Acessos B2B
        </h2>
        <p className="text-xs text-slate-400">
          Cadastros de novos clientes e liberações de acesso por e-mail.
        </p>
      </div>
      <div className="mb-6 flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setTab("registrations")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "registrations"
                ? "border-emerald-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Cadastros novos
          </button>
          <button
            onClick={() => setTab("email-requests")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "email-requests"
                ? "border-emerald-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mail className="h-4 w-4" />
            Acessos por e-mail
          </button>
        </div>

        {tab === "email-requests" ? (
          <EmailRequestsPanel />
        ) : (
          <>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["pending", "in_review", "approved", "rejected", "published"] as const).map((s) => {
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
          </>
        )}
    </div>
  );
}
