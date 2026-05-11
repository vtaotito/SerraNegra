"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useState, useCallback, useEffect, useRef } from "react";
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
  const { user } = useAuth();
  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState<IntegrationsStatusResp["data"] | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

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

          {/* RD CRM */}
          <RdCrmCard
            rd={status?.rdCrm ?? null}
            allowed={allowed}
            loading={statusLoading && !status}
            onConfigSaved={fetchStatus}
          />

          {/* RD Marketing */}
          <RdMarketingCard
            rd={status?.rdMarketing ?? null}
            allowed={allowed}
            loading={statusLoading && !status}
            onConfigSaved={fetchStatus}
          />
        </div>
      </div>
    </ProtectedLayout>
  );
}

/* ════════════════════════════════════════════════════════════
   SAP Card — status + 6 botões de sync
   ════════════════════════════════════════════════════════════ */

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

/* ════════════════════════════════════════════════════════════
   SMTP Card — input email + envio teste
   ════════════════════════════════════════════════════════════ */

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
                value: smtp.hasPassword ? "✓ presente" : "ausente",
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

/* ════════════════════════════════════════════════════════════
   RD CRM Card — botão validar token
   ════════════════════════════════════════════════════════════ */

function rdStatusToBadge(rd: RdStatus | null): IntegrationStatus {
  if (!rd) return "unknown";
  if (!rd.configured) return "not_configured";
  return "ok";
}

const RD_CRM_FIELDS: ConfigFieldDef[] = [
  {
    key: "RD_STATION_CRM_ACCESS_TOKEN",
    label: "Access Token (Bearer)",
    type: "password",
    required: true,
    hint: "Obtido após OAuth: POST /oauth2/token",
    span: 2,
  },
  {
    key: "RD_STATION_CRM_CLIENT_ID",
    label: "Client ID",
    type: "text",
    placeholder: "uuid do app no App Publisher",
    span: 1,
  },
  {
    key: "RD_STATION_CRM_CLIENT_SECRET",
    label: "Client Secret",
    type: "password",
    span: 1,
  },
  {
    key: "RD_STATION_CRM_REDIRECT_URI",
    label: "Redirect URI",
    type: "url",
    placeholder: "https://painel.garrafariaserranegra.com.br/api/webhooks/rd-station/crm",
    span: 2,
  },
];

function RdCrmCard({
  rd,
  allowed,
  loading,
  onConfigSaved,
}: {
  rd: RdStatus | null;
  allowed: boolean;
  loading: boolean;
  onConfigSaved: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/rd-crm/test", {
        method: "POST",
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: {
          pipelinesCount: number | null;
          responseTimeMs: number;
          checkedAt: string;
        };
      };
      if (!res.ok || !body.success) {
        setFeedback({
          kind: "error",
          text: body.error ?? `Falha (HTTP ${res.status})`,
        });
      } else {
        setFeedback({
          kind: "ok",
          text: `Token CRM válido — ${body.data?.pipelinesCount ?? 0} pipeline(s) acessível(is) (${body.data?.responseTimeMs ?? 0} ms).`,
        });
      }
    } catch (e) {
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "Falha de rede",
      });
    } finally {
      setTesting(false);
    }
  }, []);

  return (
    <IntegrationCard
      icon={Workflow}
      iconColor="text-violet-700"
      iconBg="bg-violet-100"
      title="RD Station CRM"
      subtitle="Pipelines · negociações · funil de vendas"
      status={loading ? "unknown" : rdStatusToBadge(rd)}
      details={
        rd
          ? [
              {
                label: "Access token",
                value: rd.configured ? "✓ presente" : "ausente",
              },
              {
                label: "Client credentials",
                value: rd.hasClientCredentials ? "✓ presente" : "ausente",
              },
              { label: "Redirect URI", value: rd.redirectUri, mono: true },
            ]
          : undefined
      }
      envHints={[
        {
          key: "RD_STATION_CRM_ACCESS_TOKEN",
          required: true,
          note: "Bearer obtido após OAuth (POST /oauth2/token)",
        },
        { key: "RD_STATION_CRM_CLIENT_ID" },
        { key: "RD_STATION_CRM_CLIENT_SECRET" },
        { key: "RD_STATION_CRM_REDIRECT_URI" },
      ]}
      message={feedback}
      actions={
        <>
          <button
            type="button"
            onClick={handleTest}
            disabled={!allowed || testing || !rd?.configured}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 motion-safe:transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Validar token
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            disabled={!allowed}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 motion-safe:transition-colors disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            {editing ? "Fechar" : "Editar configuração"}
          </button>
        </>
      }
    >
      <IntegrationConfigForm
        group="rd-crm"
        accent="violet"
        fields={RD_CRM_FIELDS}
        enabled={allowed}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={onConfigSaved}
      />
    </IntegrationCard>
  );
}

/* ════════════════════════════════════════════════════════════
   RD Marketing Card — buscar contato por e-mail
   ════════════════════════════════════════════════════════════ */

const RD_MARKETING_FIELDS: ConfigFieldDef[] = [
  {
    key: "RD_STATION_API_TOKEN",
    label: "API Token (conversões)",
    type: "password",
    required: true,
    hint: "Chave fixa — para envio de conversões e criação de contatos. Não expira.",
    span: 2,
  },
  {
    key: "RD_STATION_MARKETING_ACCESS_TOKEN",
    label: "Access Token (Bearer OAuth)",
    type: "password",
    hint: "Obtido após OAuth: POST /oauth2/token — usado pelo Cliente 360 para consulta de contatos.",
    span: 2,
  },
  {
    key: "RD_STATION_MARKETING_CLIENT_ID",
    label: "Client ID",
    type: "text",
    placeholder: "uuid do app no App Publisher",
    span: 1,
  },
  {
    key: "RD_STATION_MARKETING_CLIENT_SECRET",
    label: "Client Secret",
    type: "password",
    span: 1,
  },
  {
    key: "RD_STATION_MARKETING_REDIRECT_URI",
    label: "Redirect URI",
    type: "url",
    placeholder: "https://painel.garrafariaserranegra.com.br/api/webhooks/rd-station/marketing",
    span: 2,
  },
];

function RdMarketingCard({
  rd,
  allowed,
  loading,
  onConfigSaved,
}: {
  rd: RdStatus | null;
  allowed: boolean;
  loading: boolean;
  onConfigSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testingApiToken, setTestingApiToken] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    succeeded: number;
    failed: number;
    withEmail: number;
    totalSap: number;
    skippedNoEmail: number;
    elapsedMs: number;
    dryRun: boolean;
    sampleDetails?: Array<{ cardCode: string; email: string; tags: string[]; ok: boolean; reason?: string; tagsApplied?: number; tagsNote?: string }>;
  } | null>(null);
  const [result, setResult] = useState<{
    found: boolean;
    contact: RdMarketingContact | null;
    elapsed: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "error" | "warn"; text: string } | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTestApiToken = useCallback(async () => {
    setTestingApiToken(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/rd-marketing/conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "teste-api-token@garrafariaserranegra.com.br",
          conversion_identifier: "painel-gsn-api-token-test",
          name: "Teste API Token (Painel GSN)",
          tags: ["teste-painel"],
        }),
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { responseTimeMs: number };
      };
      if (!res.ok || !body.success) {
        setFeedback({
          kind: "error",
          text: body.error ?? `Falha (HTTP ${res.status})`,
        });
      } else {
        setFeedback({
          kind: "ok",
          text: `API Token válido — conversão de teste enviada (${body.data?.responseTimeMs ?? 0} ms).`,
        });
      }
    } catch (e) {
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "Falha de rede",
      });
    } finally {
      setTestingApiToken(false);
    }
  }, []);

  const handleSapSync = useCallback(async (dryRun: boolean) => {
    setSyncing(true);
    setFeedback(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/rd-marketing/sync-sap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: {
          totalSapCustomers: number;
          withEmail: number;
          sent: number;
          succeeded: number;
          failed: number;
          skippedNoEmail: number;
          dryRun: boolean;
          elapsedMs: number;
          sampleDetails?: Array<{ cardCode: string; email: string; tags: string[]; ok: boolean; reason?: string; tagsApplied?: number; tagsNote?: string }>;
        };
      };
      if (!res.ok || !body.success) {
        setFeedback({ kind: "error", text: body.error ?? `Falha (HTTP ${res.status})` });
      } else if (body.data) {
        const d = body.data;
        setSyncResult({
          succeeded: d.succeeded,
          failed: d.failed,
          withEmail: d.withEmail,
          totalSap: d.totalSapCustomers,
          skippedNoEmail: d.skippedNoEmail,
          elapsedMs: d.elapsedMs,
          dryRun: d.dryRun,
          sampleDetails: d.sampleDetails,
        });
        setFeedback({
          kind: d.failed > 0 ? "warn" : "ok",
          text: dryRun
            ? `Simulação: ${d.withEmail} clientes com e-mail de ${d.totalSapCustomers} SAP (${d.skippedNoEmail} sem e-mail).`
            : `Sync concluído: ${d.succeeded} enviados, ${d.failed} falhas, ${d.skippedNoEmail} sem e-mail (${(d.elapsedMs / 1000).toFixed(1)}s).`,
        });
      }
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : "Falha de rede" });
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const target = email.trim().toLowerCase();
      if (!target) {
        inputRef.current?.focus();
        return;
      }
      setSearching(true);
      setFeedback(null);
      setResult(null);
      try {
        const res = await fetch("/api/integrations/rd-marketing/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: target }),
        });
        const body = (await res.json()) as {
          success: boolean;
          error?: string;
          data?: {
            found: boolean;
            contact: RdMarketingContact | null;
            responseTimeMs: number;
          };
        };
        if (!res.ok || !body.success) {
          setFeedback({
            kind: "error",
            text: body.error ?? `Falha (HTTP ${res.status})`,
          });
          return;
        }
        const found = body.data?.found ?? false;
        setResult({
          found,
          contact: body.data?.contact ?? null,
          elapsed: body.data?.responseTimeMs ?? 0,
        });
        if (!found) {
          setFeedback({
            kind: "warn",
            text: `Token válido — mas o contato ${target} não está na base.`,
          });
        } else {
          setFeedback({
            kind: "ok",
            text: `Contato encontrado em ${body.data?.responseTimeMs ?? 0} ms.`,
          });
        }
      } catch (err) {
        setFeedback({
          kind: "error",
          text: err instanceof Error ? err.message : "Falha de rede",
        });
      } finally {
        setSearching(false);
      }
    },
    [email],
  );

  return (
    <IntegrationCard
      icon={Megaphone}
      iconColor="text-pink-700"
      iconBg="bg-pink-100"
      title="RD Station Marketing"
      subtitle="Base de contatos · automações · Cliente 360"
      status={loading ? "unknown" : rdStatusToBadge(rd)}
      details={
        rd
          ? [
              {
                label: "API Token (conversões)",
                value: rd.hasApiToken ? "✓ presente" : "ausente",
              },
              {
                label: "Access token (OAuth)",
                value: rd.configured ? "✓ presente" : "ausente",
              },
              {
                label: "Client credentials",
                value: rd.hasClientCredentials ? "✓ presente" : "ausente",
              },
              { label: "Redirect URI", value: rd.redirectUri, mono: true },
            ]
          : undefined
      }
      envHints={[
        {
          key: "RD_STATION_API_TOKEN",
          required: true,
          note: "Chave fixa da conta — para conversões (não expira)",
        },
        {
          key: "RD_STATION_MARKETING_ACCESS_TOKEN",
          note: "Bearer OAuth — para consulta de contatos (Cliente 360)",
        },
        { key: "RD_STATION_MARKETING_CLIENT_ID" },
        { key: "RD_STATION_MARKETING_CLIENT_SECRET" },
        { key: "RD_STATION_MARKETING_REDIRECT_URI" },
      ]}
      message={feedback}
      actions={
        <>
          <button
            type="button"
            onClick={handleTestApiToken}
            disabled={!allowed || testingApiToken || !rd?.hasApiToken}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 motion-safe:transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testingApiToken ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Testar API Token
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            disabled={!allowed}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 motion-safe:transition-colors disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            {editing ? "Fechar" : "Editar configuração"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSearch}>
        <label
          htmlFor="rd-marketing-test-email"
          className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
        >
          Buscar contato por e-mail
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              id="rd-marketing-test-email"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="cliente@empresa.com.br"
              autoComplete="off"
              disabled={!rd?.configured || !allowed}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400/40 focus:border-pink-400/60 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={
              !allowed || searching || !rd?.configured || email.trim().length === 0
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 motion-safe:transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Buscar
          </button>
        </div>
      </form>

      {result && result.found && result.contact && (
        <div className="rounded-lg border border-pink-200 bg-pink-50/40 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />
            <span className="font-semibold text-gray-800">
              {result.contact.name ?? "(sem nome)"}
            </span>
          </div>
          <Field label="E-mail" value={result.contact.email} mono />
          <Field label="Cargo" value={result.contact.jobTitle} />
          <Field
            label="Cidade/UF"
            value={[result.contact.city, result.contact.state]
              .filter(Boolean)
              .join(" / ") || null}
          />
          <Field label="Lifecycle" value={result.contact.lifecycle} />
          <Field
            label="Última conversão"
            value={fmtDateTime(result.contact.lastConversionDate)}
          />
          {result.contact.tags && result.contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {result.contact.tags.slice(0, 8).map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded bg-white border border-pink-200 text-pink-700 text-[10px] font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <IntegrationConfigForm
        group="rd-marketing"
        accent="pink"
        fields={RD_MARKETING_FIELDS}
        enabled={allowed}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={onConfigSaved}
      />

      {/* Sync SAP → RD Station */}
      <div className="rounded-lg border border-pink-200 bg-pink-50/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-pink-600" />
            <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">
              Sync SAP → RD Station
            </h4>
          </div>
          <span className="text-[10px] text-cockpit-muted">
            Cria leads e tageia contatos automaticamente
          </span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Busca todos os clientes ativos no SAP e envia uma <strong>conversão</strong> para cada um que tenha e-mail.
          Tags automáticas: <code className="text-[10px] bg-white px-1 rounded border border-pink-200">sap-ativo</code>{" "}
          <code className="text-[10px] bg-white px-1 rounded border border-pink-200">uf-SP</code>{" "}
          <code className="text-[10px] bg-white px-1 rounded border border-pink-200">regiao-sudeste</code>{" "}
          <code className="text-[10px] bg-white px-1 rounded border border-pink-200">tipo-cliente</code>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSapSync(true)}
            disabled={!allowed || syncing || !rd?.hasApiToken}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pink-300 bg-white text-sm font-medium text-pink-700 hover:bg-pink-50 motion-safe:transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Simulação (dry run)
          </button>
          <button
            type="button"
            onClick={() => handleSapSync(false)}
            disabled={!allowed || syncing || !rd?.hasApiToken}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-600 text-sm font-semibold text-white hover:bg-pink-700 motion-safe:transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Executar sync
          </button>
          {!rd?.hasApiToken && (
            <span className="text-[10px] text-red-500 italic">
              Configure o API Token primeiro
            </span>
          )}
        </div>

        {syncResult && (
          <div className="rounded-lg border border-pink-200 bg-white p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
              <div className="rounded-md bg-gray-50 p-2 text-center">
                <span className="block text-[10px] text-cockpit-muted uppercase">SAP Total</span>
                <span className="block text-base font-bold text-gray-900">{syncResult.totalSap}</span>
              </div>
              <div className="rounded-md bg-emerald-50 p-2 text-center">
                <span className="block text-[10px] text-cockpit-muted uppercase">Enviados</span>
                <span className="block text-base font-bold text-emerald-700">{syncResult.succeeded}</span>
              </div>
              <div className="rounded-md bg-red-50 p-2 text-center">
                <span className="block text-[10px] text-cockpit-muted uppercase">Falhas</span>
                <span className="block text-base font-bold text-red-600">{syncResult.failed}</span>
              </div>
              <div className="rounded-md bg-gray-50 p-2 text-center">
                <span className="block text-[10px] text-cockpit-muted uppercase">Sem e-mail</span>
                <span className="block text-base font-bold text-gray-500">{syncResult.skippedNoEmail}</span>
              </div>
            </div>
            {syncResult.sampleDetails && syncResult.sampleDetails.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-pink-700 font-medium hover:underline">
                  {syncResult.dryRun ? "Preview" : "Detalhes"} ({syncResult.sampleDetails.length} primeiros)
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-pink-100">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-pink-50 text-pink-900/60 text-[10px] uppercase">
                        <th className="py-1.5 px-2 text-left">Código</th>
                        <th className="py-1.5 px-2 text-left">E-mail</th>
                        <th className="py-1.5 px-2 text-left">Tags</th>
                        <th className="py-1.5 px-2 text-center">Conv.</th>
                        <th className="py-1.5 px-2 text-center">Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pink-50">
                      {syncResult.sampleDetails.map((d, i) => (
                        <tr key={i} className="hover:bg-pink-50/40">
                          <td className="py-1 px-2 font-mono text-gray-700">{d.cardCode}</td>
                          <td className="py-1 px-2 text-gray-600 truncate max-w-[140px]" title={d.email}>{d.email}</td>
                          <td className="py-1 px-2">
                            <div className="flex flex-wrap gap-0.5">
                              {d.tags.slice(0, 4).map((t) => (
                                <span key={t} className="px-1 py-0.5 rounded bg-pink-100 text-pink-700 text-[9px]">{t}</span>
                              ))}
                              {d.tags.length > 4 && <span className="text-[9px] text-gray-400">+{d.tags.length - 4}</span>}
                            </div>
                          </td>
                          <td className="py-1 px-2 text-center">{d.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 inline" />}</td>
                          <td className="py-1 px-2 text-center">
                            {typeof d.tagsApplied === "number" && d.tagsApplied > 0
                              ? <span className="text-emerald-600 font-semibold">{d.tagsApplied}</span>
                              : <span className="text-gray-400 text-[9px]" title={d.tagsNote ?? ""}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            {!rd?.configured && syncResult.sampleDetails?.some(d => d.tagsNote) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2 mt-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>Conversões criadas com sucesso</strong>, mas as tags de contato não foram aplicadas
                  porque o <code className="bg-white px-1 rounded text-[10px] font-mono border border-amber-200">RD_STATION_MARKETING_ACCESS_TOKEN</code> (Bearer OAuth)
                  não está configurado. As conversões ficam registradas no RD, mas as tags como{" "}
                  <code className="bg-white px-1 rounded text-[10px]">sap-ativo</code>,{" "}
                  <code className="bg-white px-1 rounded text-[10px]">uf-SP</code> etc. só são
                  atribuídas ao contato quando o Bearer estiver ativo.
                  Configure em &ldquo;Editar configuração&rdquo; acima.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </IntegrationCard>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-gray-800 truncate ${mono ? "font-mono text-[11px]" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
