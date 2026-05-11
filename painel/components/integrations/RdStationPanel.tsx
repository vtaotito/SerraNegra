"use client";

import { useState, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  RefreshCw,
  Workflow,
  Megaphone,
  Search,
  AlertCircle,
  Pencil,
  Send,
  ArrowRightLeft,
  Play,
  Eye,
  ExternalLink,
  Shield,
  Radio,
  Users as UsersIcon,
  Tag,
} from "lucide-react";
import {
  IntegrationConfigForm,
  type ConfigFieldDef,
} from "./IntegrationConfigForm";

interface RdStatus {
  configured: boolean;
  hasApiToken?: boolean;
  hasClientCredentials: boolean;
  redirectUri: string | null;
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
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

type RdTab = "status" | "sync" | "contacts" | "config";

const RD_CRM_FIELDS: ConfigFieldDef[] = [
  { key: "RD_STATION_CRM_ACCESS_TOKEN", label: "Access Token (Bearer)", type: "password", hint: "Obtido automaticamente via OAuth ou colado manualmente.", span: 2 },
  { key: "RD_STATION_CRM_CLIENT_ID", label: "Client ID", type: "text", placeholder: "uuid", span: 1 },
  { key: "RD_STATION_CRM_CLIENT_SECRET", label: "Client Secret", type: "password", span: 1 },
  { key: "RD_STATION_CRM_REDIRECT_URI", label: "Redirect URI", type: "url", placeholder: "https://painel.garrafariaserranegra.com.br/api/webhooks/rd-station/crm", span: 2 },
];

const RD_MARKETING_FIELDS: ConfigFieldDef[] = [
  { key: "RD_STATION_API_TOKEN", label: "API Token (conversões)", type: "password", required: true, hint: "Chave fixa — para envio de conversões e criação de contatos. Não expira.", span: 2 },
  { key: "RD_STATION_MARKETING_ACCESS_TOKEN", label: "Access Token (Bearer OAuth)", type: "password", hint: "Obtido automaticamente via OAuth. Usado para consultas e tags.", span: 2 },
  { key: "RD_STATION_MARKETING_CLIENT_ID", label: "Client ID", type: "text", placeholder: "uuid", span: 1 },
  { key: "RD_STATION_MARKETING_CLIENT_SECRET", label: "Client Secret", type: "password", span: 1 },
  { key: "RD_STATION_MARKETING_REDIRECT_URI", label: "Redirect URI", type: "url", placeholder: "https://painel.garrafariaserranegra.com.br/api/webhooks/rd-station/marketing", span: 2 },
];

export function RdStationPanel({
  rdCrm,
  rdMarketing,
  allowed,
  loading,
  onConfigSaved,
}: {
  rdCrm: RdStatus | null;
  rdMarketing: RdStatus | null;
  allowed: boolean;
  loading: boolean;
  onConfigSaved: () => void;
}) {
  const [tab, setTab] = useState<RdTab>("status");
  const [editingCrm, setEditingCrm] = useState(false);
  const [editingMkt, setEditingMkt] = useState(false);

  const [testingCrm, setTestingCrm] = useState(false);
  const [testingApiToken, setTestingApiToken] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [email, setEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [feedback, setFeedback] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);
  const [contactResult, setContactResult] = useState<{ found: boolean; contact: RdMarketingContact | null; elapsed: number } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    succeeded: number; failed: number; withEmail: number; totalSap: number;
    skippedNoEmail: number; elapsedMs: number; dryRun: boolean;
    sampleDetails?: Array<{ cardCode: string; email: string; tags: string[]; ok: boolean; reason?: string; tagsApplied?: number; tagsNote?: string }>;
  } | null>(null);

  const crmOk = rdCrm?.configured ?? false;
  const mktOk = rdMarketing?.configured ?? false;
  const hasApiToken = rdMarketing?.hasApiToken ?? false;
  const hasCredsCrm = rdCrm?.hasClientCredentials ?? false;
  const hasCredsMkt = rdMarketing?.hasClientCredentials ?? false;

  const handleTestCrm = useCallback(async () => {
    setTestingCrm(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/rd-crm/test", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setFeedback({ kind: "error", text: body.error ?? `Falha (HTTP ${res.status})` });
      } else {
        setFeedback({ kind: "ok", text: `Token CRM válido — ${body.data?.pipelinesCount ?? 0} pipeline(s) (${body.data?.responseTimeMs ?? 0} ms).` });
      }
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : "Falha de rede" });
    } finally {
      setTestingCrm(false);
    }
  }, []);

  const handleTestApiToken = useCallback(async () => {
    setTestingApiToken(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/rd-marketing/conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "teste-api-token@garrafariaserranegra.com.br", conversion_identifier: "painel-gsn-api-token-test", name: "Teste API Token (Painel GSN)", tags: ["teste-painel"] }),
      });
      const body = await res.json();
      setFeedback(body.success
        ? { kind: "ok", text: `API Token válido — conversão de teste enviada (${body.data?.responseTimeMs ?? 0} ms).` }
        : { kind: "error", text: body.error ?? "Falha" });
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : "Falha de rede" });
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
      const body = await res.json();
      if (!res.ok || !body.success) {
        setFeedback({ kind: "error", text: body.error ?? "Falha" });
      } else if (body.data) {
        const d = body.data;
        setSyncResult({ succeeded: d.succeeded, failed: d.failed, withEmail: d.withEmail, totalSap: d.totalSapCustomers, skippedNoEmail: d.skippedNoEmail, elapsedMs: d.elapsedMs, dryRun: d.dryRun, sampleDetails: d.sampleDetails });
        setFeedback({
          kind: d.failed > 0 ? "warn" : "ok",
          text: dryRun
            ? `Simulação: ${d.withEmail} clientes com e-mail de ${d.totalSapCustomers} SAP.`
            : `Sync OK: ${d.succeeded} enviados, ${d.failed} falhas (${(d.elapsedMs / 1000).toFixed(1)}s).`,
        });
      }
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : "Falha de rede" });
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleSearchContact = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) { inputRef.current?.focus(); return; }
    setSearching(true);
    setFeedback(null);
    setContactResult(null);
    try {
      const res = await fetch("/api/integrations/rd-marketing/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setFeedback({ kind: "error", text: body.error ?? "Falha" });
        return;
      }
      const found = body.data?.found ?? false;
      setContactResult({ found, contact: body.data?.contact ?? null, elapsed: body.data?.responseTimeMs ?? 0 });
      setFeedback(found
        ? { kind: "ok", text: `Contato encontrado em ${body.data?.responseTimeMs ?? 0} ms.` }
        : { kind: "warn", text: `Token válido — contato ${target} não está na base.` });
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "Falha de rede" });
    } finally {
      setSearching(false);
    }
  }, [email]);

  const oauthUrl = (product: "marketing" | "crm") => {
    const clientId = product === "marketing"
      ? "bd02d48a-9ed8-4dec-8385-3556f2867c02"
      : "dde1e214-feab-4921-9774-3718bdac803c";
    const redirectUri = encodeURIComponent(
      `https://painel.garrafariaserranegra.com.br/api/webhooks/rd-station/${product}`,
    );
    return `https://api.rd.services/auth/dialog?client_id=${clientId}&redirect_uri=${redirectUri}`;
  };

  const anyLoading = testingCrm || testingApiToken || syncing || searching;

  return (
    <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-5 border-b border-gray-100 bg-gradient-to-r from-violet-50/60 via-pink-50/40 to-white">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-100 to-pink-100 shrink-0">
          <Radio className="w-5 h-5 text-violet-700" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-bold text-gray-900">RD Station</h3>
              <p className="text-xs text-gray-500 mt-0.5">CRM · Marketing · Automações · Cliente 360</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill label="CRM" ok={crmOk} loading={loading} />
              <StatusPill label="Mkt" ok={mktOk} loading={loading} />
              <StatusPill label="API" ok={hasApiToken} loading={loading} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-100 bg-gray-50/50 px-4 pt-2">
        {([
          { id: "status" as RdTab, label: "Status & Tokens", icon: Shield },
          { id: "sync" as RdTab, label: "Sync SAP → RD", icon: ArrowRightLeft },
          { id: "contacts" as RdTab, label: "Buscar Contato", icon: UsersIcon },
          { id: "config" as RdTab, label: "Configuração", icon: Pencil },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setFeedback(null); }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg text-xs font-semibold motion-safe:transition-all border-b-2 -mb-px ${
              tab === t.id
                ? "bg-white text-violet-700 border-violet-500 shadow-sm"
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/60"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Feedback global */}
        {feedback && (
          <div role="status" aria-live="polite" className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
            feedback.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : feedback.kind === "error" ? "border-red-200 bg-red-50 text-red-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
          }`}>
            {feedback.kind === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {/* ═══ TAB: STATUS ═══ */}
        {tab === "status" && (
          <div className="space-y-5">
            {/* Status grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TokenCard
                title="CRM (Bearer OAuth)"
                configured={crmOk}
                loading={loading}
                description="Pipelines, negociações e funil de vendas"
                actions={
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={handleTestCrm} disabled={!allowed || testingCrm || !crmOk}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 motion-safe:transition-colors disabled:opacity-50">
                      {testingCrm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Validar
                    </button>
                    {hasCredsCrm && (
                      <a href={oauthUrl("crm")} target="_self"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 text-xs font-medium hover:bg-violet-50 motion-safe:transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        {crmOk ? "Re-autorizar" : "Autorizar OAuth"}
                      </a>
                    )}
                  </div>
                }
              />
              <TokenCard
                title="Marketing (Bearer OAuth)"
                configured={mktOk}
                loading={loading}
                description="Consulta de contatos, tags e Cliente 360"
                actions={
                  <div className="flex flex-wrap gap-2 mt-3">
                    {hasCredsMkt && (
                      <a href={oauthUrl("marketing")} target="_self"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-200 text-pink-700 text-xs font-medium hover:bg-pink-50 motion-safe:transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        {mktOk ? "Re-autorizar" : "Autorizar OAuth"}
                      </a>
                    )}
                  </div>
                }
              />
              <TokenCard
                title="API Token (conversões)"
                configured={hasApiToken}
                loading={loading}
                description="Envio de conversões e criação de leads (não expira)"
                actions={
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={handleTestApiToken} disabled={!allowed || testingApiToken || !hasApiToken}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700 motion-safe:transition-colors disabled:opacity-50">
                      {testingApiToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Testar
                    </button>
                  </div>
                }
              />
            </div>

            {/* Quick guide */}
            {(!crmOk || !mktOk || !hasApiToken) && (
              <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-4 text-xs text-violet-900 space-y-2">
                <p className="font-semibold text-sm">Guia rápido de configuração</p>
                <ol className="list-decimal pl-5 space-y-1.5 text-violet-800 leading-relaxed">
                  {!hasApiToken && (
                    <li>
                      Vá na aba <strong>Configuração</strong>, cole o <strong>API Token</strong> (fixo, obtido no RD) e salve.
                    </li>
                  )}
                  {!hasCredsMkt && (
                    <li>
                      Cole o <strong>Client ID</strong> e <strong>Client Secret</strong> do app Marketing no RD Publisher.
                    </li>
                  )}
                  {hasCredsMkt && !mktOk && (
                    <li>
                      Clique em <strong>&ldquo;Autorizar OAuth&rdquo;</strong> no card Marketing acima para obter o Bearer automaticamente.
                    </li>
                  )}
                  {!hasCredsCrm && (
                    <li>
                      Para CRM: cole Client ID/Secret do app CRM na aba Configuração.
                    </li>
                  )}
                  {hasCredsCrm && !crmOk && (
                    <li>
                      Clique em <strong>&ldquo;Autorizar OAuth&rdquo;</strong> no card CRM para obter o Bearer.
                    </li>
                  )}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: SYNC ═══ */}
        {tab === "sync" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-pink-600" />
                  Sync SAP → RD Station Marketing
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
                  Busca clientes ativos no SAP, cria leads no RD e aplica tags automáticas:
                  <span className="inline-flex flex-wrap gap-1 ml-1">
                    {["sap-ativo", "tipo-cliente", "uf-SP", "regiao-sudeste"].map((t) => (
                      <code key={t} className="px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 text-[10px] font-semibold">{t}</code>
                    ))}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSapSync(true)} disabled={!allowed || anyLoading || !hasApiToken}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pink-300 bg-white text-sm font-medium text-pink-700 hover:bg-pink-50 motion-safe:transition-colors disabled:opacity-50">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Simulação
                </button>
                <button onClick={() => handleSapSync(false)} disabled={!allowed || anyLoading || !hasApiToken}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-600 text-sm font-semibold text-white hover:bg-pink-700 motion-safe:transition-colors disabled:opacity-50">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Executar sync
                </button>
              </div>
            </div>

            {!hasApiToken && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Configure o <strong>API Token</strong> na aba Configuração antes de sincronizar.
              </div>
            )}

            {syncResult && (
              <div className="rounded-lg border border-pink-200 bg-white p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
                  {[
                    { label: "SAP Total", value: syncResult.totalSap, color: "text-gray-900", bg: "bg-gray-50" },
                    { label: "Enviados", value: syncResult.succeeded, color: "text-emerald-700", bg: "bg-emerald-50" },
                    { label: "Falhas", value: syncResult.failed, color: "text-red-600", bg: "bg-red-50" },
                    { label: "Sem e-mail", value: syncResult.skippedNoEmail, color: "text-gray-500", bg: "bg-gray-50" },
                  ].map((k) => (
                    <div key={k.label} className={`rounded-lg ${k.bg} p-2.5 text-center`}>
                      <span className="block text-[10px] text-cockpit-muted uppercase">{k.label}</span>
                      <span className={`block text-lg font-bold ${k.color}`}>{k.value}</span>
                    </div>
                  ))}
                </div>

                {syncResult.sampleDetails && syncResult.sampleDetails.length > 0 && (
                  <details className="text-xs" open>
                    <summary className="cursor-pointer text-pink-700 font-medium hover:underline">
                      Detalhes ({syncResult.sampleDetails.length})
                    </summary>
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-pink-100">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-pink-50 text-pink-900/60 text-[10px] uppercase sticky top-0">
                            <th className="py-1.5 px-2 text-left bg-pink-50">Código</th>
                            <th className="py-1.5 px-2 text-left bg-pink-50">E-mail</th>
                            <th className="py-1.5 px-2 text-left bg-pink-50">Tags</th>
                            <th className="py-1.5 px-2 text-center bg-pink-50">Conv.</th>
                            <th className="py-1.5 px-2 text-center bg-pink-50">Tags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-50">
                          {syncResult.sampleDetails.map((d, i) => (
                            <tr key={i} className="hover:bg-pink-50/40">
                              <td className="py-1 px-2 font-mono text-gray-700">{d.cardCode}</td>
                              <td className="py-1 px-2 text-gray-600 truncate max-w-[160px]" title={d.email}>{d.email}</td>
                              <td className="py-1 px-2">
                                <div className="flex flex-wrap gap-0.5">
                                  {d.tags.slice(0, 3).map((t) => (
                                    <span key={t} className="px-1 py-0.5 rounded bg-pink-100 text-pink-700 text-[9px]">{t}</span>
                                  ))}
                                  {d.tags.length > 3 && <span className="text-[9px] text-gray-400">+{d.tags.length - 3}</span>}
                                </div>
                              </td>
                              <td className="py-1 px-2 text-center">{d.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 inline" />}</td>
                              <td className="py-1 px-2 text-center">
                                {typeof d.tagsApplied === "number" && d.tagsApplied > 0
                                  ? <span className="text-emerald-600 font-semibold">{d.tagsApplied}</span>
                                  : <span className="text-gray-400" title={d.tagsNote ?? ""}>—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {!mktOk && syncResult.sampleDetails?.some((d) => d.tagsNote) && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Conversões criadas, mas tags não aplicadas — <strong>Bearer OAuth Marketing</strong> ausente.
                      Autorize na aba <strong>Status & Tokens</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: CONTACTS ═══ */}
        {tab === "contacts" && (
          <div className="space-y-4">
            <form onSubmit={handleSearchContact}>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-pink-600" />
                Buscar contato no RD Marketing
              </h4>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input ref={inputRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@empresa.com.br" autoComplete="off" disabled={!mktOk || !allowed}
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400/40 focus:border-pink-400/60 disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
                <button type="submit" disabled={!allowed || searching || !mktOk || email.trim().length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 motion-safe:transition-colors disabled:opacity-50">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar
                </button>
              </div>
              {!mktOk && (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Requer Bearer OAuth Marketing. Autorize na aba Status & Tokens.
                </p>
              )}
            </form>

            {contactResult && contactResult.found && contactResult.contact && (
              <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/40 px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-purple-600/15"><Radio className="w-3.5 h-3.5 text-purple-800" /></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{contactResult.contact.name ?? "—"}</p>
                    <p className="text-[11px] text-purple-900/85 font-mono">{contactResult.contact.email}</p>
                  </div>
                  {contactResult.contact.lifecycle && (
                    <span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900">
                      {contactResult.contact.lifecycle}
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-700 mt-3">
                  {contactResult.contact.jobTitle && (
                    <><dt className="text-gray-400">Cargo</dt><dd>{contactResult.contact.jobTitle}</dd></>
                  )}
                  {(contactResult.contact.city || contactResult.contact.state) && (
                    <><dt className="text-gray-400">Local</dt><dd>{[contactResult.contact.city, contactResult.contact.state].filter(Boolean).join(" — ")}</dd></>
                  )}
                  <dt className="text-gray-400">Última conversão</dt>
                  <dd>{fmtDateTime(contactResult.contact.lastConversionDate)}</dd>
                </dl>
                {contactResult.contact.tags && contactResult.contact.tags.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-purple-100/80">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {contactResult.contact.tags.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-purple-600/10 text-purple-900 font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: CONFIG ═══ */}
        {tab === "config" && (
          <div className="space-y-5">
            {/* Marketing */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="w-3.5 h-3.5 text-pink-600" />
                  RD Marketing
                </h4>
                <button onClick={() => setEditingMkt((v) => !v)} disabled={!allowed}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 motion-safe:transition-colors disabled:opacity-50">
                  <Pencil className="w-3.5 h-3.5" />
                  {editingMkt ? "Fechar" : "Editar"}
                </button>
              </div>
              <IntegrationConfigForm group="rd-marketing" accent="pink" fields={RD_MARKETING_FIELDS}
                enabled={allowed} open={editingMkt} onClose={() => setEditingMkt(false)} onSaved={onConfigSaved} />
              {!editingMkt && (
                <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>API Token: {hasApiToken ? <strong className="text-emerald-600">✓</strong> : <strong className="text-gray-400">—</strong>}</span>
                  <span>Bearer: {mktOk ? <strong className="text-emerald-600">✓</strong> : <strong className="text-gray-400">—</strong>}</span>
                  <span>Client creds: {hasCredsMkt ? <strong className="text-emerald-600">✓</strong> : <strong className="text-gray-400">—</strong>}</span>
                </div>
              )}
            </div>

            {/* CRM */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <Workflow className="w-3.5 h-3.5 text-violet-600" />
                  RD CRM
                </h4>
                <button onClick={() => setEditingCrm((v) => !v)} disabled={!allowed}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 motion-safe:transition-colors disabled:opacity-50">
                  <Pencil className="w-3.5 h-3.5" />
                  {editingCrm ? "Fechar" : "Editar"}
                </button>
              </div>
              <IntegrationConfigForm group="rd-crm" accent="violet" fields={RD_CRM_FIELDS}
                enabled={allowed} open={editingCrm} onClose={() => setEditingCrm(false)} onSaved={onConfigSaved} />
              {!editingCrm && (
                <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>Bearer: {crmOk ? <strong className="text-emerald-600">✓</strong> : <strong className="text-gray-400">—</strong>}</span>
                  <span>Client creds: {hasCredsCrm ? <strong className="text-emerald-600">✓</strong> : <strong className="text-gray-400">—</strong>}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ label, ok, loading }: { label: string; ok: boolean; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
        {label} <Loader2 className="w-2.5 h-2.5 animate-spin" />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
      ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-500"
    }`}>
      {label} {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <span>—</span>}
    </span>
  );
}

function TokenCard({ title, configured, loading, description, actions }: {
  title: string; configured: boolean; loading: boolean; description: string; actions: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-4 motion-safe:transition-all ${
      loading ? "border-gray-200 bg-gray-50/50"
      : configured ? "border-emerald-200 bg-emerald-50/30"
      : "border-gray-200 bg-white"
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-800">{title}</span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
        ) : configured ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>
      {actions}
    </div>
  );
}
