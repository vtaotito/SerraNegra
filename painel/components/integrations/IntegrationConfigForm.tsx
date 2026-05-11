"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Loader2,
  Save,
  X,
  Eye,
  EyeOff,
  Database,
  HardDrive,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export type ConfigGroup = "smtp" | "rd-crm" | "rd-marketing";

export interface ConfigFieldDef {
  key: string;
  label: string;
  /** Texto auxiliar abaixo do input. */
  hint?: string;
  /** Placeholder visível quando vazio. */
  placeholder?: string;
  /** "password" => mascara secret no input + olho de revelar. */
  type?: "text" | "password" | "email" | "number" | "url";
  /** Marca o campo como obrigatório (apenas visual; backend valida). */
  required?: boolean;
  /** Coluna no grid do form (1 ou 2 — sm:col-span). */
  span?: 1 | 2;
}

interface ApiField {
  key: string;
  isSecret: boolean;
  hasValue: boolean;
  value: string | null;
  preview: string | null;
  source: "db" | "env" | "none";
}

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

interface IntegrationConfigFormProps {
  group: ConfigGroup;
  fields: ConfigFieldDef[];
  /** Cor base da ação primária (Salvar). Ex.: "amber" | "violet" | "pink". */
  accent: "amber" | "violet" | "pink";
  /** Disparado após salvar com sucesso (use para refazer status). */
  onSaved?: () => void;
  /** Slot opcional ao lado do botão Salvar (ex.: "Salvar e testar"). */
  extraActions?: ReactNode;
  /** Quando false, oculta totalmente o form (sem permissão). */
  enabled: boolean;
  /** Estado de "expansão" controlado externamente. */
  open: boolean;
  onClose: () => void;
}

const ACCENT_CLASSES: Record<
  IntegrationConfigFormProps["accent"],
  { btn: string; ring: string; border: string }
> = {
  amber: {
    btn: "bg-amber-600 hover:bg-amber-700",
    ring: "focus:ring-amber-400/40 focus:border-amber-400/60",
    border: "border-amber-200",
  },
  violet: {
    btn: "bg-violet-600 hover:bg-violet-700",
    ring: "focus:ring-violet-400/40 focus:border-violet-400/60",
    border: "border-violet-200",
  },
  pink: {
    btn: "bg-pink-600 hover:bg-pink-700",
    ring: "focus:ring-pink-400/40 focus:border-pink-400/60",
    border: "border-pink-200",
  },
};

export function IntegrationConfigForm({
  group,
  fields,
  accent,
  onSaved,
  extraActions,
  enabled,
  open,
  onClose,
}: IntegrationConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [serverFields, setServerFields] = useState<Record<string, ApiField>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const fieldDefs = useMemo(() => fields, [fields]);
  const cls = ACCENT_CLASSES[accent];

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/integrations/config?group=${encodeURIComponent(group)}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as ApiResponse<{
        group: string;
        fields: ApiField[];
      }>;
      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const map: Record<string, ApiField> = {};
      const initialDraft: Record<string, string> = {};
      for (const f of body.data.fields) {
        map[f.key] = f;
        // Para campos não-secretos, pré-popula com o valor atual.
        // Para secretos, deixa vazio (placeholder mostra preview).
        initialDraft[f.key] = f.isSecret ? "" : f.value ?? "";
      }
      setServerFields(map);
      setDraft(initialDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar configuração");
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  const isDirty = useMemo(() => {
    for (const f of fieldDefs) {
      const apiF = serverFields[f.key];
      if (!apiF) continue;
      if (apiF.isSecret) {
        // Para secret: dirty se digitou algo (não vazio = vai sobrescrever).
        if (draft[f.key]?.length > 0) return true;
      } else {
        const current = apiF.value ?? "";
        if ((draft[f.key] ?? "") !== current) return true;
      }
    }
    return false;
  }, [draft, fieldDefs, serverFields]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const values: Record<string, string | null> = {};
      for (const f of fieldDefs) {
        const apiF = serverFields[f.key];
        const v = draft[f.key] ?? "";
        if (apiF?.isSecret) {
          // Convenção: secret vazio = não mexer; digitado = sobrescrever.
          if (v.trim().length === 0) continue;
          values[f.key] = v;
        } else {
          // Não-secreto: vazio = apaga; preenchido = grava.
          values[f.key] = v;
        }
      }
      const res = await fetch(
        `/api/integrations/config?group=${encodeURIComponent(group)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        },
      );
      const body = (await res.json()) as ApiResponse<{
        changedKeys: string[];
        message?: string;
      }>;
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const changed = body.data?.changedKeys ?? [];
      setFeedback({
        kind: "ok",
        text:
          changed.length === 0
            ? "Nada alterado."
            : `Salvo: ${changed.length} campo(s) atualizado(s).`,
      });
      await reload();
      onSaved?.();
    } catch (e) {
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "Falha ao salvar configuração",
      });
    } finally {
      setSaving(false);
    }
  }, [draft, fieldDefs, serverFields, group, reload, onSaved]);

  if (!open) return null;

  return (
    <div
      className={`mt-3 rounded-lg border bg-gray-50/40 ${cls.border} divide-y divide-gray-100`}
      role="region"
      aria-label="Editor de configuração da integração"
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Configuração
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 motion-safe:transition-colors"
          aria-label="Fechar editor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
          Carregando configuração…
        </div>
      ) : error ? (
        <div className="px-4 py-3 text-xs text-red-700 bg-red-50/60 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fieldDefs.map((f) => {
              const apiF = serverFields[f.key];
              const isSecret = Boolean(apiF?.isSecret);
              const value = draft[f.key] ?? "";
              const showReveal = isSecret && !!reveal[f.key];
              const inputType = isSecret
                ? showReveal
                  ? "text"
                  : "password"
                : f.type ?? "text";
              const placeholder =
                isSecret && apiF?.hasValue
                  ? `Atual: ${apiF.preview ?? "•••"}  (deixe em branco para manter)`
                  : f.placeholder ?? (isSecret ? "Cole o token aqui" : "");

              return (
                <div
                  key={f.key}
                  className={f.span === 2 ? "sm:col-span-2" : "sm:col-span-1"}
                >
                  <label
                    htmlFor={`cfg-${f.key}`}
                    className="flex items-center justify-between text-[11px] font-semibold text-gray-700 mb-1.5"
                  >
                    <span>
                      {f.label}
                      {f.required && (
                        <span className="ml-1 text-red-500" aria-hidden>
                          *
                        </span>
                      )}
                    </span>
                    <SourceBadge source={apiF?.source ?? "none"} />
                  </label>
                  <div className="relative">
                    <input
                      id={`cfg-${f.key}`}
                      type={inputType}
                      value={value}
                      placeholder={placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!enabled || saving}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      className={`w-full ${
                        isSecret ? "pr-9" : ""
                      } px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${cls.ring} disabled:bg-gray-50 disabled:text-gray-400 font-mono`}
                    />
                    {isSecret && value.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setReveal((p) => ({ ...p, [f.key]: !p[f.key] }))
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 motion-safe:transition-colors"
                        aria-label={showReveal ? "Ocultar valor" : "Mostrar valor"}
                        tabIndex={-1}
                      >
                        {showReveal ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  {f.hint && (
                    <p className="text-[10px] text-gray-500 mt-1">{f.hint}</p>
                  )}
                </div>
              );
            })}
          </div>

          {feedback && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
                feedback.kind === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {feedback.kind === "ok" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!enabled || saving || !isDirty}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg ${cls.btn} text-white text-sm font-semibold motion-safe:transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar configuração
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
              }}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 motion-safe:transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            {extraActions}
            {!isDirty && !saving && (
              <span className="text-[10px] text-gray-400">
                Sem alterações pendentes
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: "db" | "env" | "none" }) {
  if (source === "db") {
    return (
      <span
        title="Valor atual veio do banco (editado pela UI)"
        className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
      >
        <Database className="w-2.5 h-2.5" />
        DB
      </span>
    );
  }
  if (source === "env") {
    return (
      <span
        title="Valor atual veio do .env do servidor (legado)"
        className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded"
      >
        <HardDrive className="w-2.5 h-2.5" />
        env
      </span>
    );
  }
  return (
    <span
      title="Sem valor configurado"
      className="inline-flex items-center gap-1 text-[9px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded"
    >
      —
    </span>
  );
}
