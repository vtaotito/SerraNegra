"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SkipForward,
  Ban,
  ChevronDown,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  startSeoBulkGenerate,
  fetchSeoBulkStatus,
  cancelSeoBulkGenerate,
  type SeoBulkJob,
  type SeoBulkStatus,
} from "@/lib/admin/seo";

interface SeoBulkGenerateCardProps {
  aiConfigured: boolean;
}

const STATUS_LABEL: Record<SeoBulkStatus, string> = {
  idle: "Pronto",
  running: "Gerando…",
  done: "Concluído",
  error: "Erro",
  cancelled: "Cancelado",
};

export function SeoBulkGenerateCard({ aiConfigured }: SeoBulkGenerateCardProps) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [force, setForce] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const prevStatus = useRef<SeoBulkStatus | null>(null);

  const statusQuery = useQuery({
    queryKey: ["admin-seo-bulk-status"],
    queryFn: fetchSeoBulkStatus,
    refetchInterval: (query) =>
      query.state.data?.data?.status === "running" ? 2500 : false,
  });

  const job: SeoBulkJob | undefined = statusQuery.data?.data;
  const running = job?.status === "running";

  // Detecta término do job para toast + refresh do dashboard.
  useEffect(() => {
    if (!job) return;
    const prev = prevStatus.current;
    if (prev === "running" && job.status !== "running") {
      if (job.status === "done") {
        toast.success(
          `Geração concluída: ${job.succeeded} gerados, ${job.skipped} pulados, ${job.failed} falhas.`,
        );
      } else if (job.status === "cancelled") {
        toast.message("Geração cancelada.");
      } else if (job.status === "error") {
        toast.error(job.error ?? "A geração em massa falhou.");
      }
      qc.invalidateQueries({ queryKey: ["admin-seo-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-catalog-product"] });
    }
    prevStatus.current = job.status;
  }, [job, qc]);

  const startMutation = useMutation({
    mutationFn: () => startSeoBulkGenerate({ scope: "visible", force, onlyMissing }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      toast.success("Geração em massa iniciada.");
      qc.setQueryData(["admin-seo-bulk-status"], res);
      statusQuery.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao iniciar a geração"),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSeoBulkGenerate,
    onSuccess: () => {
      toast.message("Cancelamento solicitado. Aguardando finalizar os itens em andamento.");
      statusQuery.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao cancelar"),
  });

  const pct =
    job && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;

  return (
    <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-slate-800/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Gerar SEO para todo o catálogo
            </h3>
            <p className="mt-0.5 max-w-xl text-xs text-slate-400">
              Gera título, meta descrição, slug, palavras-chave, atributos e a descrição comercial
              de todos os produtos visíveis usando IA. O conteúdo é gravado automaticamente e fica{" "}
              <span className="font-medium text-violet-300">travado</span> (o sync diário não
              sobrescreve). Você pode editar depois pela lista.
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {running ? (
            <Button
              size="sm"
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Ban className="h-3.5 w-3.5" />
              )}
              Cancelar
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!aiConfigured}
              onClick={() => setConfirmOpen(true)}
              className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <Rocket className="h-3.5 w-3.5" /> Gerar catálogo
            </Button>
          )}
        </div>
      </div>

      {!aiConfigured && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            IA de SEO não configurada. Defina <code className="text-amber-100">OPENAI_API_KEY</code>{" "}
            no gateway para habilitar a geração em massa.
          </p>
        </div>
      )}

      {/* Progresso / resultado */}
      {job && job.status !== "idle" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                job.status === "running" && "text-violet-300",
                job.status === "done" && "text-emerald-300",
                job.status === "cancelled" && "text-slate-300",
                job.status === "error" && "text-rose-300",
              )}
            >
              {job.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {job.status === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
              {job.status === "error" && <XCircle className="h-3.5 w-3.5" />}
              {STATUS_LABEL[job.status]}
            </span>
            <span className="text-slate-400">
              {job.processed}/{job.total} ({pct}%)
            </span>
          </div>

          {/* Barra de progresso */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                job.status === "error" ? "bg-rose-500" : "bg-violet-500",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Contadores */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Counter icon={CheckCircle2} label="Sucesso" value={job.succeeded} className="text-emerald-300" />
            <Counter icon={SkipForward} label="Pulados" value={job.skipped} className="text-sky-300" />
            <Counter icon={XCircle} label="Falhas" value={job.failed} className="text-rose-300" />
            <Counter icon={Sparkles} label="Total" value={job.total} className="text-slate-200" />
          </div>

          {job.status === "running" && job.currentSku && (
            <p className="truncate text-xs text-slate-400">
              Processando: <span className="font-mono text-slate-300">{job.currentSku}</span>
            </p>
          )}

          {/* Falhas (accordion) */}
          {job.errors.length > 0 && (
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/5">
              <button
                onClick={() => setShowErrors((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-rose-200"
              >
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {job.errors.length} {job.errors.length === 1 ? "falha registrada" : "falhas registradas"}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showErrors && "rotate-180")} />
              </button>
              {showErrors && (
                <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-rose-500/20 px-3 py-2">
                  {job.errors.map((e, i) => (
                    <li key={`${e.sku}-${i}`} className="text-[11px] text-rose-200/90">
                      <span className="font-mono text-rose-100">{e.sku}</span>: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Diálogo de confirmação */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !startMutation.isPending && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-base font-semibold text-slate-100">
                  Gerar SEO para todo o catálogo?
                </h4>
                <p className="mt-1 text-sm text-slate-400">
                  A IA vai gerar e <span className="font-medium text-slate-200">gravar automaticamente</span>{" "}
                  título, meta descrição, slug, palavras-chave, atributos e a descrição comercial de
                  todos os produtos visíveis. O conteúdo fica{" "}
                  <span className="font-medium text-violet-300">travado contra o sync</span>. Você pode
                  editar cada produto depois.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-200">
                  Forçar regeneração
                  <span className="block text-xs text-slate-500">
                    Regera inclusive produtos já travados e preenchidos.
                  </span>
                </span>
                <Switch
                  checked={force}
                  onCheckedChange={(v) => {
                    setForce(v);
                    if (v) setOnlyMissing(false);
                  }}
                  aria-label="Forçar regeneração"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-200">
                  Somente faltantes
                  <span className="block text-xs text-slate-500">
                    Pula quem já tem descrição e meta descrição.
                  </span>
                </span>
                <Switch
                  checked={onlyMissing}
                  onCheckedChange={(v) => {
                    setOnlyMissing(v);
                    if (v) setForce(false);
                  }}
                  aria-label="Somente faltantes"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                disabled={startMutation.isPending}
                onClick={() => setConfirmOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate()}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Iniciar geração
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={cn("mt-0.5 text-lg font-bold", className)}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
