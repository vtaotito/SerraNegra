"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Zap,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Database,
  ArrowDownToLine,
  Mail,
  Send,
  Workflow,
  Megaphone,
  Search,
  AlertCircle,
  Pencil,
  ArrowRightLeft,
  Play,
  Eye,
  ExternalLink,
  Shield,
  Radio,
  Users as UsersIcon,
  Tag,
} from "lucide-react";
import { syncSAP } from "@/lib/cockpit-api";
import {
  IntegrationCard,
  type IntegrationStatus,
} from "@/components/integrations/IntegrationCard";
import {
  IntegrationConfigForm,
  type ConfigFieldDef,
} from "@/components/integrations/IntegrationConfigForm";
import { RdStationPanel } from "@/components/integrations/RdStationPanel";

type SyncKey =
  | "cockpit"
  | "invoices"
  | "products"
  | "inventory"
  | "customers"
  | "salespersons";

const SYNC_ENDPOINTS: Array<{
  key: SyncKey;
  label: string;
  desc: string;
}> = [
  { key: "cockpit", label: "Sync Completo", desc: "Todas as entidades" },
  { key: "invoices", label: "Notas Fiscais", desc: "A/R Invoices" },
  { key: "products", label: "Produtos", desc: "Items + UDFs" },
  { key: "inventory", label: "Estoque", desc: "Warehouse info" },
  { key: "customers", label: "Clientes", desc: "BusinessPartners" },
  { key: "salespersons", label: "Vendedores", desc: "SalesPersons" },
];

interface SapStatus {
  configured: boolean;
  healthy: boolean;
  responseTimeMs: number | null;
  message: string | null;
  baseUrl: string | null;
}
interface SmtpStatus {
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  hasPassword: boolean;
  from: string;
}
interface RdStatus {
  configured: boolean;
  hasApiToken?: boolean;
  hasClientCredentials: boolean;
  redirectUri: string | null;
}

interface IntegrationsStatusResp {
  success: boolean;
  data?: {
    sap: SapStatus;
    smtp: SmtpStatus;
    rdCrm: RdStatus;
    rdMarketing: RdStatus;
  };
  error?: string;
}

interface RdMarketingContact {
  uuid?: string;
  name: string | null;
  email: string | null;
  jobTitle?: string | null;
  city?: string | null;
  state?: string | null;
  lastConversionDate?: string | null;
  lifecycle?: string | null;
  tags?: string[];
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export default function IntegracoesPage() {
  return (
    <Suspense>
      <IntegracoesContent />
    </Suspense>
  );
}

function IntegracoesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState<IntegrationsStatusResp["data"] | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [oauthBanner, setOauthBanner] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const kind = searchParams?.get("rd_oauth") as "ok" | "error" | null;
    const msg = searchParams?.get("rd_msg");
    if (kind && msg) {
      setOauthBanner({ kind, text: msg });
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("rd_oauth");
        url.searchParams.delete("rd_msg");
        window.history.replaceState({}, "", url.pathname);
      }
    }
  }, [searchParams]);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/integrations/status", {
        cache: "no-store",
      });
      const body = (await res.json()) as IntegrationsStatusResp;
      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStatus(body.data);
      setLastChecked(new Date().toISOString());
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchStatus();
  }, [user, fetchStatus]);

  if (!user) return null;

  const allowed = user.role === "admin" || user.role === "supervisor";

  return (
    <ProtectedLayout>
      <div className="max-w-6xl mx-auto pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gsn-50">
              <Zap className="w-5 h-5 text-gsn-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
              <p className="text-sm text-gray-500">
                SAP Business One · SMTP · RD Station CRM/Marketing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastChecked && (
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                Última verificação: {fmtDateTime(lastChecked)}
              </span>
            )}
            <button
              type="button"
              onClick={fetchStatus}
              disabled={statusLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 motion-safe:transition-colors disabled:opacity-50"
            >
              {statusLoading ? (
                <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Recarregar status
            </button>
          </div>
        </div>

        {!allowed && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Apenas <strong>admin</strong> e <strong>supervisor</strong> podem
              testar as integrações. Você vê os status mas as ações estão
              desabilitadas.
            </span>
          </div>
        )}

        {statusError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Falha ao carregar status: {statusError}
          </div>
        )}

        {oauthBanner && (
          <div
            role="alert"
            className={`mb-5 rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
              oauthBanner.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {oauthBanner.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div>
              <strong>OAuth RD Station:</strong> {oauthBanner.text}
              <button
                type="button"
                onClick={() => setOauthBanner(null)}
                className="ml-3 text-xs underline opacity-60 hover:opacity-100"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SAP */}
          <SapCard
            sap={status?.sap ?? null}
            allowed={allowed}
            loading={statusLoading && !status}
            onAfterSync={fetchStatus}
          />

          {/* SMTP */}
          <SmtpCard
            smtp={status?.smtp ?? null}
            allowed={allowed}
            loading={statusLoading && !status}
            currentEmail={user.email ?? null}
            onConfigSaved={fetchStatus}
          />

          {/* RD Station (CRM + Marketing unificado) */}
          <RdStationPanel
            rdCrm={status?.rdCrm ?? null}
            rdMarketing={status?.rdMarketing ?? null}
            allowed={allowed}
            loading={statusLoading && !status}
            onConfigSaved={fetchStatus}
          />
        </div>
      </div>
    </ProtectedLayout>
  );
}

/* ═══════════════════════════════════════════════════════════
   SAP Card — status + 6 botões de sync
   ═══════════════════════════════════════════════════════════ */

function sapStatusToBadge(sap: SapStatus | null): IntegrationStatus {
  if (!sap) return "unknown";
  if (!sap.configured) return "not_configured";
  if (sap.healthy) return "ok";
  return "error";
}

function SapCard({
  sap,
  allowed,
  loading,
  onAfterSync,
}: {
  sap: SapStatus | null;
  allowed: boolean;
  loading: boolean;
  onAfterSync: () => void;
}) {
  const [syncStates, setSyncStates] = useState<
    Record<string, "idle" | "loading" | "ok" | "error">
  >({});

  const handleSync = useCallback(
    async (endpoint: SyncKey) => {
      setSyncStates((p) => ({ ...p, [endpoint]: "loading" }));
      try {
        await syncSAP(endpoint);
        setSyncStates((p) => ({ ...p, [endpoint]: "ok" }));
        setTimeout(() => {
          setSyncStates((p) => ({ ...p, [endpoint]: "idle" }));
          onAfterSync();
        }, 3000);
      } catch {
        setSyncStates((p) => ({ ...p, [endpoint]: "error" }));
        setTimeout(
          () => setSyncStates((p) => ({ ...p, [endpoint]: "idle" })),
          5000,
        );
      }
    },
    [onAfterSync],
  );

  return (
    <IntegrationCard
      span={2}
      icon={Database}
      iconColor="text-cockpit-accent"
      iconBg="bg-cockpit-accent/10"
      title="SAP Business One"
      subtitle="Service Layer · sincronização e healthcheck"
      status={loading ? "unknown" : sapStatusToBadge(sap)}
      details={
        sap
          ? [
              { label: "Base URL", value: sap.baseUrl, mono: true },
              {
                label: "Tempo de resposta",
                value:
                  sap.responseTimeMs != null
                    ? `${sap.responseTimeMs} ms`
                    : null,
              },
              { label: "Status", value: sap.message ?? null },
            ]
          : undefined
      }
      envHints={[
        { key: "SAP_B1_BASE_URL", required: true },
        { key: "SAP_B1_COMPANY_DB", required: true },
        { key: "SAP_B1_USERNAME", required: true },
        { key: "SAP_B1_PASSWORD", required: true },
      ]}
    >
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Sincronização de entidades
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SYNC_ENDPOINTS.map((ep) => {
            const state = syncStates[ep.key] ?? "idle";
            return (
              <button
                key={ep.key}
                type="button"
                onClick={() => handleSync(ep.key)}
                disabled={!allowed || state === "loading"}
                className={`group rounded-lg p-3 border text-left motion-safe:transition-all duration-200 ${
                  state === "ok"
                    ? "border-emerald-300 bg-emerald-50"
                    : state === "error"
                    ? "border-red-300 bg-red-50"
                    : state === "loading"
                    ? "border-gsn-300 bg-gsn-50/50"
                    : "border-gray-200 bg-white hover:border-gsn-400 hover:shadow-sm"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-semibold text-gray-900">
                    {ep.label}
                  </p>
                  {state === "loading" && (
                    <Loader2 className="w-3.5 h-3.5 text-gsn-600 animate-spin motion-reduce:animate-none" />
                  )}
                  {state === "ok" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  {state === "error" && (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                  {state === "idle" && (
                    <ArrowDownToLine className="w-3.5 h-3.5 text-gray-300 group-hover:text-gsn-600 motion-safe:transition-colors" />
                  )}
                </div>
                <p className="text-[10px] text-gray-500">{ep.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </IntegrationCard>
  );
}

/* ═══════════════════════════════════════════════════════════
   SMTP Card — input email + envio teste
   ═══════════════════════════════════════════════════════════ */

function smtpStatusToBadge(smtp: SmtpStatus | null): IntegrationStatus {
  if (!smtp) return "unknown";
  if (!smtp.configured) return "not_configured";
  return "ok";
}

const SMTP_FIELDS: ConfigFieldDef[] = [
  {
    key: "SMTP_HOST",
    label: "Host SMTP",
    type: "text",
    required: true,
    placeholder: "smtp.hostinger.com",
    span: 1,
  },
  {
    key: "SMTP_PORT",
    label: "Porta",
    type: "number",
    placeholder: "587",
    hint: "587 (STARTTLS) ou 465 (SSL)",
    span: 1,
  },
  {
    key: "SMTP_USER",
    label: "Usuário",
    type: "email",
    required: true,
    placeholder: "noreply@garrafariaserranegra.com.br",
    span: 1,
  },
  {
    key: "SMTP_PASS",
    label: "Senha",
    type: "password",
    required: true,
    span: 1,
  },
  {
    key: "SMTP_FROM",
    label: "Remetente (From)",
    type: "text",
    placeholder: 'Painel GSN <noreply@garrafariaserranegra.com.br>',
    hint: 'Formato: "Nome <email@dominio>"',
    span: 2,
  },
];

function SmtpCard({
  smtp,
  allowed,
  loading,
  currentEmail,
  onConfigSaved,
}: {
  smtp: SmtpStatus | null;
  allowed: boolean;
  loading: boolean;
  currentEmail: string | null;
  onConfigSaved: () => void;
}) {
  const [target, setTarget] = useState(currentEmail ?? "");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    if (currentEmail && !target) setTarget(currentEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmail]);

  const handleTest = useCallback(async () => {
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: target.trim() }),
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { sentTo: string; sentAt: string };
      };
      if (!res.ok || !body.success) {
        setFeedback({
          kind: "error",
          text: body.error ?? `Falha (HTTP ${res.status})`,
        });
      } else {
        setFeedback({
          kind: "ok",
          text: `E-mail de teste enviado para ${
            body.data?.sentTo ?? target
          }. Verifique a caixa de entrada e a pasta de spam.`,
        });
      }
    } catch (e) {
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "Falha de rede",
      });
    } finally {
      setSending(false);
    }
  }, [target]);

  const canSend = allowed && !sending && smtp?.configured && target.trim().length > 0;

  return (
    <IntegrationCard
      icon={Mail}
      iconColor="text-amber-700"
      iconBg="bg-amber-100"
      title="SMTP"
      subtitle="Envio de e-mails (reset de senha + alertas)"
      status={loading ? "unknown" : smtpStatusToBadge(smtp)}
      details={
        smtp
          ? [
              {
                label: "Host:Porta",
                value: smtp.host
                  ? `${smtp.host}:${smtp.port}${smtp.secure ? " (TLS)" : ""}`
                  : null,
                mono: true,
              },
              { label: "Usuário", value: smtp.user, mono: true },
              { label: "Remetente", value: smtp.from, mono: true },
              {
                label: "Credencial",
                value: smtp.hasPassword ? "âœ“ presente" : "ausente",
              },
            ]
          : undefined
      }
      envHints={[
        { key: "SMTP_HOST", required: true, note: "ex.: smtp.hostinger.com" },
        { key: "SMTP_PORT", note: "padrão 587 (STARTTLS) ou 465 (SSL)" },
        { key: "SMTP_USER", required: true },
        { key: "SMTP_PASS", required: true },
        { key: "SMTP_FROM", note: 'ex.: "Painel GSN <noreply@…>"' },
      ]}
      message={feedback}
      actions={
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          disabled={!allowed}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 motion-safe:transition-colors disabled:opacity-50"
        >
          <Pencil className="w-4 h-4" />
          {editing ? "Fechar" : "Editar configuração"}
        </button>
      }
    >
      <div>
        <label
          htmlFor="smtp-test-target"
          className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
        >
          Enviar e-mail de teste para
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="smtp-test-target"
              type="email"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="email@exemplo.com.br"
              autoComplete="off"
              disabled={!smtp?.configured || !allowed}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 motion-safe:transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar
          </button>
        </div>
      </div>

      <IntegrationConfigForm
        group="smtp"
        accent="amber"
        fields={SMTP_FIELDS}
        enabled={allowed}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={onConfigSaved}
      />
    </IntegrationCard>
  );
}

