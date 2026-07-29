"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Search,
  Building2,
  Clock,
  CheckCircle2,
  Ban,
  Send,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

type RegStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "published"
  | "";

interface RegistrationRow {
  id: number;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  email: string;
  city: string | null;
  state: string | null;
  status: Exclude<RegStatus, "">;
  created_at: string;
  reviewed_by: string | null;
  sap_card_code: string | null;
  sap_error: string | null;
}

const STATUS_META: Record<
  Exclude<RegStatus, "">,
  { label: string; cls: string }
> = {
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-700" },
  in_review: { label: "Em análise", cls: "bg-sky-50 text-sky-700" },
  approved: { label: "Aprovado", cls: "bg-indigo-50 text-indigo-700" },
  rejected: { label: "Rejeitado", cls: "bg-red-50 text-red-600" },
  published: { label: "Publicado", cls: "bg-emerald-50 text-emerald-700" },
};

function fmtCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return raw;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function B2BCadastrosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<RegStatus>("pending");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/b2b-admin/registrations${qs}`);
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao listar");
      setItems(j.data?.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar cadastros");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.razao_social.toLowerCase().includes(q) ||
        r.cnpj.includes(q.replace(/\D/g, "")) ||
        r.email.toLowerCase().includes(q) ||
        (r.nome_fantasia ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  if (!user || !["admin", "supervisor", "comercial"].includes(user.role)) {
    return (
      <ProtectedLayout>
        <div className="p-8 text-sm text-gray-500">Sem permissão para esta área.</div>
      </ProtectedLayout>
    );
  }

  const filters: { value: RegStatus; label: string }[] = [
    { value: "pending", label: "Pendentes" },
    { value: "in_review", label: "Em análise" },
    { value: "approved", label: "Aprovados" },
    { value: "published", label: "Publicados" },
    { value: "rejected", label: "Rejeitados" },
    { value: "", label: "Todos" },
  ];

  return (
    <ProtectedLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-700" />
              Cadastros B2B
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Fila de aprovação de novos clientes — publique no SAP com lista de
              preços e vendedor.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                status === f.value
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razão social, CNPJ ou e-mail..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
            Nenhum cadastro neste filtro.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white overflow-hidden">
            {filtered.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <Link
                  key={r.id}
                  href={`/b2b-cadastros/${r.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {r.razao_social}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                          meta.cls,
                        )}
                      >
                        {meta.label}
                      </span>
                      {r.sap_error && (
                        <span className="text-[11px] text-red-600">Erro SAP</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtCNPJ(r.cnpj)} · {r.email}
                      {r.city ? ` · ${r.city}/${r.state ?? ""}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {fmtDate(r.created_at)}
                      {r.reviewed_by ? ` · por ${r.reviewed_by}` : ""}
                      {r.sap_card_code ? ` · ${r.sap_card_code}` : ""}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 shrink-0">
                    <Eye className="w-3.5 h-3.5" /> Revisar
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" /> Pendente / em análise
          </span>
          <span className="inline-flex items-center gap-1">
            <Send className="w-3.5 h-3.5 text-indigo-500" /> Aprovado (aguardando publish)
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Publicado no SAP
          </span>
          <span className="inline-flex items-center gap-1">
            <Ban className="w-3.5 h-3.5 text-red-500" /> Rejeitado
          </span>
        </div>
      </div>
    </ProtectedLayout>
  );
}
