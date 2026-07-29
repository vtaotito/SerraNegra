"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle2,
  Ban,
  Send,
  Building2,
  MapPin,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

interface Registration {
  id: number;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  email: string;
  phone: string | null;
  contact_name: string | null;
  address: string | null;
  street_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  inscricao_estadual: string | null;
  sap_config: Record<string, unknown>;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  sap_card_code: string | null;
  sap_error: string | null;
  created_at: string;
  delivery?: Record<string, unknown> | null;
}

interface PriceList {
  priceListNo: number;
  priceListName: string;
}

interface PricePreview {
  itemCode: string;
  itemName: string | null;
  price: number;
}

interface Salesperson {
  code: number;
  name: string | null;
}

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  in_review: "bg-sky-50 text-sky-700",
  approved: "bg-indigo-50 text-indigo-700",
  rejected: "bg-red-50 text-red-600",
  published: "bg-emerald-50 text-emerald-700",
};

function fmtCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return raw;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function B2BCadastroDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const regId = Number(params.id);

  const [reg, setReg] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [priceListNum, setPriceListNum] = useState<number>(1);
  const [salesPersonCode, setSalesPersonCode] = useState<number>(9);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [preview, setPreview] = useState<PricePreview[]>([]);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!Number.isFinite(regId)) return;
    setLoading(true);
    try {
      const [regRes, plRes, spRes] = await Promise.all([
        fetch(`/api/b2b-admin/registrations/${regId}`),
        fetch("/api/b2b-admin/price-lists"),
        fetch("/api/b2b-admin/salespersons"),
      ]);
      const regJ = await regRes.json();
      if (!regRes.ok || !regJ.success) throw new Error(regJ.error || "Erro");
      const row = regJ.data as Registration;
      setReg(row);
      setNotes(row.admin_notes ?? "");
      setPriceListNum(Number(row.sap_config?.PriceListNum ?? 1));
      setSalesPersonCode(Number(row.sap_config?.SalesPersonCode ?? 9));

      const plJ = await plRes.json();
      if (plRes.ok && plJ.success) setPriceLists(plJ.data?.items ?? []);

      const spJ = await spRes.json();
      if (spRes.ok && spJ.success) setSalespersons(spJ.data?.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [regId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPreview = useCallback(async () => {
    if (!priceListNum) return;
    setPreviewLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "25" });
      if (previewSearch.trim()) qs.set("search", previewSearch.trim());
      const res = await fetch(
        `/api/b2b-admin/price-lists/${priceListNum}/preview?${qs}`,
      );
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro no preview");
      setPreview(j.data?.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [priceListNum, previewSearch]);

  useEffect(() => {
    void loadPreview();
  }, [priceListNum]); // eslint-disable-line react-hooks/exhaustive-deps

  const canAct =
    reg &&
    ["pending", "in_review", "approved"].includes(reg.status) &&
    reg.status !== "published";

  async function saveConfig() {
    if (!reg) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/b2b-admin/registrations/${reg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNotes: notes,
          sapConfig: {
            ...reg.sap_config,
            PriceListNum: priceListNum,
            SalesPersonCode: salesPersonCode,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao salvar");
      setReg(j.data);
      toast.success("Dados salvos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function assumeReview() {
    if (!reg) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/b2b-admin/registrations/${reg.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro");
      setReg(j.data);
      toast.success("Cadastro em análise");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function approveAndPublish() {
    if (!reg) return;
    if (!priceListNum || !salesPersonCode) {
      toast.error("Selecione lista de preços e vendedor");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/b2b-admin/registrations/${reg.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          priceListNum,
          salesPersonCode,
          sapConfig: {
            ...reg.sap_config,
            PriceListNum: priceListNum,
            SalesPersonCode: salesPersonCode,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao publicar");
      toast.success(
        `Publicado no SAP${j.data?.cardCode ? ` (${j.data.cardCode})` : ""}. Acesso liberado por e-mail.`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao publicar");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reg || !rejectReason.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/b2b-admin/registrations/${reg.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: rejectReason.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao rejeitar");
      toast.success("Cadastro rejeitado. Cliente notificado.");
      setRejectOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!user || !["admin", "supervisor", "comercial"].includes(user.role)) {
    return (
      <ProtectedLayout>
        <div className="p-8 text-sm text-gray-500">Sem permissão.</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/b2b-cadastros")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {reg?.razao_social ?? "Cadastro B2B"}
            </h1>
            <p className="text-sm text-gray-500">
              {reg ? fmtCNPJ(reg.cnpj) : "—"}
            </p>
          </div>
          {reg && (
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium",
                STATUS_CLS[reg.status] ?? "bg-gray-100 text-gray-600",
              )}
            >
              {reg.status}
            </span>
          )}
        </div>

        {loading || !reg ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            {reg.sap_error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Erro no último publish SAP</p>
                  <p className="text-xs mt-1 whitespace-pre-wrap">{reg.sap_error}</p>
                  <p className="text-xs mt-1 text-red-600/80">
                    Corrija os dados e tente Aprovar e publicar novamente.
                  </p>
                </div>
              </div>
            )}

            <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Empresa
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">Razão social</dt>
                  <dd>{reg.razao_social}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Nome fantasia</dt>
                  <dd>{reg.nome_fantasia || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">E-mail</dt>
                  <dd>{reg.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Telefone / Contato</dt>
                  <dd>
                    {reg.phone || "—"}
                    {reg.contact_name ? ` · ${reg.contact_name}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">IE</dt>
                  <dd>{reg.inscricao_estadual || "ISENTO"}</dd>
                </div>
                {reg.sap_card_code && (
                  <div>
                    <dt className="text-xs text-gray-400">CardCode SAP</dt>
                    <dd className="font-mono">{reg.sap_card_code}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Endereço
              </h2>
              <p className="text-sm text-gray-700">
                {[reg.address, reg.street_number, reg.neighborhood]
                  .filter(Boolean)
                  .join(", ")}
                <br />
                {[reg.city, reg.state, reg.zip_code].filter(Boolean).join(" · ")}
              </p>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">
                Comercial (obrigatório para publicar)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="text-xs text-gray-500">Lista de preços</span>
                  <select
                    value={priceListNum}
                    onChange={(e) => setPriceListNum(Number(e.target.value))}
                    disabled={!canAct || busy}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {priceLists.length === 0 && (
                      <option value={priceListNum}>Lista #{priceListNum}</option>
                    )}
                    {priceLists.map((pl) => (
                      <option key={pl.priceListNo} value={pl.priceListNo}>
                        #{pl.priceListNo} — {pl.priceListName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-gray-500">Vendedor</span>
                  <select
                    value={salesPersonCode}
                    onChange={(e) => setSalesPersonCode(Number(e.target.value))}
                    disabled={!canAct || busy}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {salespersons.length === 0 && (
                      <option value={salesPersonCode}>
                        Código {salesPersonCode}
                      </option>
                    )}
                    {salespersons.map((sp) => (
                      <option key={sp.code} value={sp.code}>
                        #{sp.code} — {sp.name || "Sem nome"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Preview da lista
                  </p>
                  <Link
                    href="/b2b-listas-preco"
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    Ver todas
                  </Link>
                </div>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void loadPreview();
                      }}
                      placeholder="Buscar SKU..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                    />
                  </div>
                  <button
                    onClick={() => void loadPreview()}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 hover:bg-gray-50"
                  >
                    Buscar
                  </button>
                </div>
                <div className="rounded-lg border border-gray-100 max-h-40 overflow-y-auto text-xs">
                  {previewLoading ? (
                    <p className="p-3 text-gray-400">Carregando preview...</p>
                  ) : preview.length === 0 ? (
                    <p className="p-3 text-gray-400">Nenhum item nesta amostra.</p>
                  ) : (
                    preview.map((it) => (
                      <div
                        key={it.itemCode}
                        className="flex justify-between px-3 py-1.5 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-mono text-gray-600">
                          {it.itemCode}
                          {it.itemName ? ` — ${it.itemName}` : ""}
                        </span>
                        <span className="font-medium">
                          {it.price.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <label className="block text-sm">
                <span className="text-xs text-gray-500">Notas internas</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canAct || busy}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            </section>

            {canAct && (
              <div className="flex flex-wrap gap-2 sticky bottom-4 bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-3 shadow-sm">
                <button
                  onClick={() => void saveConfig()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Salvar
                </button>
                {reg.status === "pending" && (
                  <button
                    onClick={() => void assumeReview()}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    Assumir análise
                  </button>
                )}
                <button
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" /> Rejeitar
                </button>
                <button
                  onClick={() => void approveAndPublish()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 ml-auto"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Aprovar e publicar
                </button>
              </div>
            )}

            {reg.status === "published" && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Cadastro publicado. Credencial e e-mail de acesso já foram
                disparados.
              </div>
            )}
          </>
        )}

        {rejectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => !busy && setRejectOpen(false)}
            />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Rejeitar cadastro</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Motivo (obrigatório — enviado ao cliente)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRejectOpen(false)}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm rounded-lg border"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void reject()}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white"
                >
                  Confirmar rejeição
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
