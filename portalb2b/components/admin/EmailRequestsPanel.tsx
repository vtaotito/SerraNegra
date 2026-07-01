"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { adminGet, adminPost } from "@/lib/admin/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EmailAccessRequest {
  id: number;
  cnpj: string;
  card_code: string | null;
  card_name: string | null;
  requested_email: string;
  contact_name: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<
  EmailAccessRequest["status"],
  { label: string; variant: "warning" | "success" | "destructive"; icon: typeof Clock }
> = {
  pending: { label: "Pendente", variant: "warning", icon: Clock },
  approved: { label: "Aprovado", variant: "success", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", variant: "destructive", icon: XCircle },
};

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function EmailRequestsPanel() {
  const [items, setItems] = useState<EmailAccessRequest[]>([]);
  const [filter, setFilter] = useState<EmailAccessRequest["status"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [action, setAction] = useState<{
    request: EmailAccessRequest;
    kind: "approve" | "reject";
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = filter
        ? `/b2b/admin/email-requests?status=${filter}`
        : "/b2b/admin/email-requests";
      const data = await adminGet<{ items: EmailAccessRequest[] }>(url);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function openAction(request: EmailAccessRequest, kind: "approve" | "reject") {
    setAction({ request, kind });
    setNotes("");
  }

  async function confirmAction() {
    if (!action) return;
    if (action.kind === "reject" && !notes.trim()) {
      toast.error("Informe o motivo da recusa nas observacoes");
      return;
    }

    setSubmitting(true);
    try {
      await adminPost(
        `/b2b/admin/email-requests/${action.request.id}/${action.kind}`,
        { notes: notes.trim() || undefined },
      );
      toast.success(
        action.kind === "approve"
          ? "Acesso liberado. O cliente foi avisado por e-mail."
          : "Solicitacao recusada.",
      );
      setAction(null);
      setNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setSubmitting(false);
    }
  }

  const counts = items.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {(["pending", "approved", "rejected"] as const).map((s) => {
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
              <Mail className="h-5 w-5" />
              Acessos por e-mail{" "}
              {filter ? `(${STATUS_CONFIG[filter].label})` : ""}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {items.length} solicitacao(oes) &mdash; clientes que ja existem no
              SAP B1 mas nao tem e-mail cadastrado
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-950/40 p-3 text-xs text-blue-200">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Ao aprovar, o e-mail informado passa a valer para o primeiro acesso
              do cliente no portal. O cadastro no SAP B1 nao e alterado.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-500/50 bg-red-900/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              Nenhuma solicitacao encontrada
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((req) => {
                const cfg = STATUS_CONFIG[req.status];
                return (
                  <div
                    key={req.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-white">
                            {req.card_name || "Cliente sem nome"}
                          </span>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>{formatCnpj(req.cnpj)}</span>
                          {req.card_code && <span>SAP: {req.card_code}</span>}
                          <span className="text-slate-300">
                            {req.requested_email}
                          </span>
                          {req.contact_name && <span>{req.contact_name}</span>}
                          <span>
                            {new Date(req.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {req.notes && (
                          <p className="mt-1 text-xs text-slate-500">
                            Obs.: {req.notes}
                          </p>
                        )}
                        {req.reviewed_by && (
                          <p className="mt-1 text-[11px] text-slate-600">
                            Revisado por {req.reviewed_by}
                            {req.reviewed_at &&
                              ` em ${new Date(req.reviewed_at).toLocaleString("pt-BR")}`}
                          </p>
                        )}
                      </div>

                      {req.status === "pending" && (
                        <div className="flex flex-shrink-0 gap-2">
                          <Button
                            size="sm"
                            onClick={() => openAction(req, "approve")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openAction(req, "reject")}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Recusar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              {action.kind === "approve"
                ? "Liberar acesso por e-mail"
                : "Recusar solicitacao"}
            </h3>
            <div className="mt-3 rounded-md bg-slate-700/50 p-3 text-sm text-slate-300">
              <p className="font-medium text-white">
                {action.request.card_name || "Cliente"}
              </p>
              <p className="text-xs text-slate-400">
                {formatCnpj(action.request.cnpj)}
              </p>
              <p className="mt-1 text-xs">
                E-mail solicitado:{" "}
                <span className="text-slate-200">
                  {action.request.requested_email}
                </span>
              </p>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs text-slate-400">
                Observacoes{" "}
                {action.kind === "reject" ? "(obrigatorio)" : "(opcional)"}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                autoFocus
                className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                placeholder={
                  action.kind === "reject"
                    ? "Motivo da recusa..."
                    : "Observacoes internas (opcional)..."
                }
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setAction(null)}
                disabled={submitting}
                className="text-slate-300 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmAction}
                disabled={submitting}
                className={
                  action.kind === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : action.kind === "approve" ? (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                ) : (
                  <XCircle className="mr-1 h-4 w-4" />
                )}
                {action.kind === "approve" ? "Liberar acesso" : "Recusar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
