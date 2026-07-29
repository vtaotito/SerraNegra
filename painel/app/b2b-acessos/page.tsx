"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  KeyRound,
  Search,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  MailCheck,
  Copy,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  AlertTriangle,
  X,
  Dices,
  Mail,
  Trash2,
  Inbox,
  CheckCircle2,
  Ban,
  Clock,
  UserRound,
  Phone,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

interface B2BCredential {
  id: number;
  card_code: string;
  cnpj: string;
  card_name: string | null;
  email: string | null;
  has_password: boolean;
  email_verified: boolean;
  sales_person_code: number | null;
  created_at: string;
  updated_at: string;
}

interface Salesperson {
  code: number;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

interface B2BEmailRequest {
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

type PwFilter = "todos" | "com_senha" | "sem_senha";
/** "" = todos; "none" = sem vendedor; número = código do vendedor */
type VendorFilter = "" | "none" | string;

function fmtCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return raw;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Gera senha temporária legível, sem caracteres ambíguos (0/O, 1/l/I). */
function generateTempPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) =>
    Array.from(
      crypto.getRandomValues(new Uint32Array(n)),
      (v) => set[v % set.length],
    ).join("");
  return `${pick(upper, 1)}${pick(lower, 3)}-${pick(digits, 4)}-${pick(lower, 4)}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    return true;
  } catch {
    return false;
  }
}

export default function B2BAcessosPage() {
  const { user } = useAuth();
  const [creds, setCreds] = useState<B2BCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pwFilter, setPwFilter] = useState<PwFilter>("todos");
  const [vendorFilter, setVendorFilter] = useState<VendorFilter>("");
  const [syncLoading, setSyncLoading] = useState(false);

  // Modal de reset (limpar senha)
  const [resetTarget, setResetTarget] = useState<B2BCredential | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Modal de senha temporária
  const [tempTarget, setTempTarget] = useState<B2BCredential | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPw, setShowTempPw] = useState(true);
  const [tempLoading, setTempLoading] = useState(false);
  const [tempDone, setTempDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal de editar/remover e-mail
  const [emailTarget, setEmailTarget] = useState<B2BCredential | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Vendedores (associação vendedor↔cliente + contatos)
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [vendorTarget, setVendorTarget] = useState<B2BCredential | null>(null);
  const [vendorCode, setVendorCode] = useState<string>("");
  const [vendorLoading, setVendorLoading] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  // Solicitações de acesso por e-mail (clientes SAP sem e-mail)
  const [requests, setRequests] = useState<B2BEmailRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<B2BEmailRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/b2b-admin/email-requests");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao carregar solicitações");
      }
      setRequests(json.data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar solicitações");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const fetchCreds = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/b2b-admin/credentials");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao carregar acessos");
      }
      setCreds(json.data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar acessos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchSalespersons = useCallback(async () => {
    try {
      const res = await fetch("/api/b2b-admin/salespersons");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao carregar vendedores");
      }
      setSalespersons(json.data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar vendedores");
    }
  }, []);

  useEffect(() => {
    fetchCreds();
    fetchRequests();
    fetchSalespersons();
  }, [fetchCreds, fetchRequests, fetchSalespersons]);

  const salespersonByCode = useMemo(() => {
    const m = new Map<number, Salesperson>();
    for (const s of salespersons) m.set(s.code, s);
    return m;
  }, [salespersons]);

  const vendorName = useCallback(
    (code: number | null): string => {
      if (code === null || code === undefined) return "—";
      const s = salespersonByCode.get(code);
      return s?.name ?? `Vendedor ${code}`;
    },
    [salespersonByCode],
  );

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "pending"),
    [requests],
  );

  const stats = useMemo(() => {
    const comSenha = creds.filter((c) => c.has_password).length;
    const comVendedor = creds.filter((c) => c.sales_person_code != null).length;
    return {
      total: creds.length,
      comSenha,
      semSenha: creds.length - comSenha,
      verificados: creds.filter((c) => c.email_verified).length,
      comVendedor,
      semVendedor: creds.length - comVendedor,
    };
  }, [creds]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const vendorCode =
      vendorFilter !== "" && vendorFilter !== "none" ? Number(vendorFilter) : null;
    return creds.filter((c) => {
      if (pwFilter === "com_senha" && !c.has_password) return false;
      if (pwFilter === "sem_senha" && c.has_password) return false;
      if (vendorFilter === "none" && c.sales_person_code != null) return false;
      if (vendorCode != null && c.sales_person_code !== vendorCode) return false;
      if (!q) return true;
      const vName = vendorName(c.sales_person_code).toLowerCase();
      return (
        (c.card_name ?? "").toLowerCase().includes(q) ||
        c.card_code.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        vName.includes(q) ||
        (qDigits.length > 0 && c.cnpj.includes(qDigits))
      );
    });
  }, [creds, searchQuery, pwFilter, vendorFilter, vendorName]);

  if (!user || !["admin", "supervisor", "comercial"].includes(user.role)) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Sem permissão para acessar esta página.</p>
        </div>
      </ProtectedLayout>
    );
  }

  const isAdmin = user.role === "admin";

  // ── Ações ──

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    try {
      const res = await fetch(
        `/api/b2b-admin/credentials/${resetTarget.cnpj}/reset`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erro ao resetar senha");
      toast.success(
        `Senha de ${resetTarget.card_name ?? resetTarget.card_code} removida. O cliente deve refazer o primeiro acesso.`,
      );
      setResetTarget(null);
      fetchCreds(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao resetar senha");
    } finally {
      setResetLoading(false);
    }
  };

  const openTempModal = (c: B2BCredential) => {
    setTempTarget(c);
    setTempPassword(generateTempPassword());
    setShowTempPw(true);
    setTempDone(false);
    setCopied(false);
  };

  const handleSetTempPassword = async () => {
    if (!tempTarget) return;
    if (tempPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setTempLoading(true);
    try {
      const res = await fetch(
        `/api/b2b-admin/credentials/${tempTarget.cnpj}/set-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: tempPassword }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erro ao definir senha");
      setTempDone(true);
      toast.success("Senha temporária definida com sucesso.");
      fetchCreds(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao definir senha");
    } finally {
      setTempLoading(false);
    }
  };

  const handleCopyPassword = async () => {
    const ok = await copyToClipboard(tempPassword);
    if (ok) {
      setCopied(true);
      toast.success("Senha copiada!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const openEmailModal = (c: B2BCredential) => {
    setEmailTarget(c);
    setEmailValue(c.email ?? "");
  };

  const saveEmail = async (email: string | null) => {
    if (!emailTarget) return;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setEmailLoading(true);
    try {
      const res = await fetch(
        `/api/b2b-admin/credentials/${emailTarget.cnpj}/email`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erro ao salvar e-mail");
      toast.success(email ? "E-mail atualizado." : "E-mail removido.");
      setEmailTarget(null);
      fetchCreds(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar e-mail");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSyncSalespersons = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/b2b-admin/credentials/sync-salespersons", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao sincronizar vendedores");
      }
      const d = json.data as {
        updated: number;
        alreadySet: number;
        missingInSap: number;
        total: number;
      };
      toast.success(
        `Vendedores sincronizados: ${d.updated} atualizado(s), ${d.alreadySet} já tinham, ${d.missingInSap} sem BP no SAP.`,
      );
      await fetchCreds(true);
      await fetchSalespersons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao sincronizar vendedores");
    } finally {
      setSyncLoading(false);
    }
  };

  const openVendorModal = (c: B2BCredential) => {
    setVendorTarget(c);
    setVendorCode(c.sales_person_code != null ? String(c.sales_person_code) : "");
  };

  const handleAssignVendor = async () => {
    if (!vendorTarget) return;
    const salesPersonCode = vendorCode === "" ? null : Number(vendorCode);
    setVendorLoading(true);
    try {
      const res = await fetch(
        `/api/b2b-admin/credentials/${vendorTarget.cnpj}/salesperson`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ salesPersonCode }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erro ao associar vendedor");
      toast.success(
        salesPersonCode === null
          ? "Vendedor removido do cliente."
          : `Vendedor associado${json.data?.sapUpdated ? " e gravado no SAP" : ""}.`,
      );
      setVendorTarget(null);
      fetchCreds(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao associar vendedor");
    } finally {
      setVendorLoading(false);
    }
  };

  const openReview = (req: B2BEmailRequest, action: "approve" | "reject") => {
    setReviewTarget(req);
    setReviewAction(action);
    setReviewNotes("");
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setReviewLoading(true);
    try {
      const res = await fetch(
        `/api/b2b-admin/email-requests/${reviewTarget.id}/${reviewAction}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: reviewNotes.trim() || null }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erro ao processar solicitação");
      }
      toast.success(
        reviewAction === "approve"
          ? `Acesso de ${reviewTarget.card_name ?? reviewTarget.cnpj} liberado. O cliente foi avisado por e-mail.`
          : `Solicitação de ${reviewTarget.card_name ?? reviewTarget.cnpj} rejeitada.`,
      );
      setReviewTarget(null);
      fetchRequests();
      fetchCreds(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar solicitação");
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <KeyRound className="w-6 h-6 text-gsn-400" />
              Acessos Portal B2B
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Empresas com credencial no Portal do Cliente — resete senhas ou defina uma temporária
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isAdmin && (
              <>
                <button
                  onClick={handleSyncSalespersons}
                  disabled={syncLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50"
                  title="Busca o vendedor de cada cliente no SAP e preenche os que estão vazios"
                >
                  {syncLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserRound className="w-4 h-4" />
                  )}
                  Sincronizar vendedores do SAP
                </button>
                <button
                  onClick={() => setContactsOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition"
                >
                  <Phone className="w-4 h-4" />
                  Contatos de vendedores
                </button>
              </>
            )}
            <button
              onClick={() => { fetchCreds(true); fetchRequests(); fetchSalespersons(); }}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Solicitações de acesso por e-mail (clientes SAP sem e-mail) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Solicitações de acesso
                </h2>
                <p className="text-xs text-gray-500">
                  Clientes já existentes no SAP, sem e-mail, pedindo liberação de acesso
                </p>
              </div>
            </div>
            {pendingRequests.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <Clock className="w-3 h-3" />
                {pendingRequests.length} pendente{pendingRequests.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {requestsLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-5 h-5 animate-spin text-gsn-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-gray-500">
              Nenhuma solicitação de acesso no momento
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <Th>Empresa</Th>
                    <Th>CNPJ</Th>
                    <Th>E-mail solicitado</Th>
                    <Th>Contato</Th>
                    <Th>Status</Th>
                    <Th>Data</Th>
                    {isAdmin && <Th right>Ações</Th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-amber-50/30 transition">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{r.card_name ?? "—"}</p>
                        {r.card_code && <p className="text-xs text-gray-500">{r.card_code}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-mono whitespace-nowrap">
                        {fmtCNPJ(r.cnpj)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 break-all">{r.requested_email}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{r.contact_name ?? "—"}</td>
                      <td className="px-6 py-4">
                        <RequestStatusBadge status={r.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDateTime(r.created_at)}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          {r.status === "pending" ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openReview(r, "approve")}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                                title="Aprovar e liberar acesso"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Aprovar
                              </button>
                              <button
                                onClick={() => openReview(r, "reject")}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition"
                                title="Rejeitar solicitação"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {r.reviewed_by ? `por ${r.reviewed_by}` : "—"}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Empresas" value={stats.total} />
          <KpiCard
            label="Com senha"
            value={stats.comSenha}
            icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
            onClick={() => setPwFilter(pwFilter === "com_senha" ? "todos" : "com_senha")}
            active={pwFilter === "com_senha"}
          />
          <KpiCard
            label="Sem senha"
            value={stats.semSenha}
            icon={<ShieldOff className="w-4 h-4 text-amber-500" />}
            onClick={() => setPwFilter(pwFilter === "sem_senha" ? "todos" : "sem_senha")}
            active={pwFilter === "sem_senha"}
          />
          <KpiCard
            label="E-mail verificado"
            value={stats.verificados}
            icon={<MailCheck className="w-4 h-4 text-blue-500" />}
          />
          <KpiCard
            label="Com vendedor"
            value={stats.comVendedor}
            icon={<UserRound className="w-4 h-4 text-gsn-500" />}
          />
          <KpiCard
            label="Sem vendedor"
            value={stats.semVendedor}
            icon={<UserRound className="w-4 h-4 text-gray-400" />}
            onClick={() => setVendorFilter(vendorFilter === "none" ? "" : "none")}
            active={vendorFilter === "none"}
          />
        </div>

        {/* Busca + filtro por vendedor */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por empresa, CNPJ, código SAP, e-mail ou vendedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none bg-white"
            />
          </div>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value as VendorFilter)}
            className="sm:w-64 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
            aria-label="Filtrar por vendedor"
          >
            <option value="">Todos os vendedores</option>
            <option value="none">Sem vendedor</option>
            {salespersons.map((s) => (
              <option key={s.code} value={String(s.code)}>
                {s.name ?? `Vendedor ${s.code}`}
              </option>
            ))}
          </select>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-gsn-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
              Nenhuma credencial encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <Th>Empresa</Th>
                    <Th>CNPJ (login)</Th>
                    <Th>E-mail</Th>
                    <Th>Senha</Th>
                    <Th>Vendedor</Th>
                    <Th>Atualizado em</Th>
                    {isAdmin && <Th right>Ações</Th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gsn-50/30 transition">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {c.card_name ?? "—"}
                        </p>
                        <p className="text-xs text-gray-500">{c.card_code}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-mono whitespace-nowrap">
                        {fmtCNPJ(c.cnpj)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-700 break-all">{c.email ?? "—"}</span>
                          {c.email_verified && (
                            <span title="E-mail verificado">
                              <MailCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {c.has_password ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <ShieldCheck className="w-3 h-3" />
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            <ShieldOff className="w-3 h-3" />
                            Sem senha
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {c.sales_person_code != null ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                            <UserRound className="w-3.5 h-3.5 text-gsn-400 shrink-0" />
                            {vendorName(c.sales_person_code)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Sem vendedor</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDateTime(c.updated_at)}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openVendorModal(c)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gsn-700 hover:bg-gsn-50 transition"
                              title="Associar vendedor"
                            >
                              <UserRound className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEmailModal(c)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Editar ou remover e-mail"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setResetTarget(c)}
                              disabled={!c.has_password}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={
                                c.has_password
                                  ? "Resetar senha (cliente refaz o primeiro acesso)"
                                  : "Cliente ainda não tem senha"
                              }
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openTempModal(c)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gsn-700 hover:bg-gsn-50 transition"
                              title="Definir senha temporária"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: resetar senha ── */}
      {resetTarget && (
        <Modal onClose={() => !resetLoading && setResetTarget(null)}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Resetar senha do cliente</h2>
              <p className="text-sm text-gray-500 mt-1">
                A senha de{" "}
                <strong className="text-gray-800">
                  {resetTarget.card_name ?? resetTarget.card_code}
                </strong>{" "}
                ({fmtCNPJ(resetTarget.cnpj)}) será removida. O cliente precisará refazer o{" "}
                <strong>primeiro acesso</strong> no portal, com verificação por código no e-mail
                cadastrado.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setResetTarget(null)}
              disabled={resetLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleReset}
              disabled={resetLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
            >
              {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Resetar senha
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: senha temporária ── */}
      {tempTarget && (
        <Modal onClose={() => !tempLoading && setTempTarget(null)}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Definir senha temporária</h2>
              <p className="text-sm text-gray-500 mt-1">
                <strong className="text-gray-800">
                  {tempTarget.card_name ?? tempTarget.card_code}
                </strong>{" "}
                · {fmtCNPJ(tempTarget.cnpj)}
              </p>
            </div>
            <button
              onClick={() => !tempLoading && setTempTarget(null)}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {tempDone ? (
            <>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
                <p className="text-sm text-emerald-800 font-medium mb-2">
                  Senha definida com sucesso. Compartilhe com o cliente:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-emerald-200 text-sm font-mono text-gray-900 select-all">
                    {tempPassword}
                  </code>
                  <button
                    onClick={handleCopyPassword}
                    className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-100 transition"
                    title="Copiar senha"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-emerald-700 mt-2">
                  Login: CNPJ {fmtCNPJ(tempTarget.cnpj)} · Recomende ao cliente trocar a senha
                  depois.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setTempTarget(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition"
                >
                  Concluir
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Senha temporária
              </label>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <input
                    type={showTempPw ? "text" : "password"}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                  />
                  <button
                    onClick={() => setShowTempPw(!showTempPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showTempPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => setTempPassword(generateTempPassword())}
                  className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gsn-700 hover:bg-gsn-50 transition"
                  title="Gerar nova senha"
                >
                  <Dices className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Mínimo de 6 caracteres. A senha atual do cliente (se existir) será substituída
                imediatamente.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setTempTarget(null)}
                  disabled={tempLoading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSetTempPassword}
                  disabled={tempLoading || tempPassword.length < 6}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50"
                >
                  {tempLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Definir senha
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Modal: editar / remover e-mail ── */}
      {emailTarget && (
        <Modal onClose={() => !emailLoading && setEmailTarget(null)}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">E-mail cadastrado</h2>
                <p className="text-sm text-gray-500 mt-1">
                  <strong className="text-gray-800">
                    {emailTarget.card_name ?? emailTarget.card_code}
                  </strong>{" "}
                  · {fmtCNPJ(emailTarget.cnpj)}
                </p>
              </div>
            </div>
            <button
              onClick={() => !emailLoading && setEmailTarget(null)}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            E-mail
          </label>
          <input
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            placeholder="email@empresa.com.br"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none mb-2"
          />
          <p className="text-xs text-gray-500 mb-4 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            Ao alterar o e-mail, a verificação é reiniciada — o cliente confirmará o novo endereço
            por código no próximo acesso ou recuperação de senha.
          </p>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => saveEmail(null)}
              disabled={emailLoading || !emailTarget.email}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title={emailTarget.email ? "Remover e-mail cadastrado" : "Não há e-mail para remover"}
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEmailTarget(null)}
                disabled={emailLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveEmail(emailValue.trim())}
                disabled={emailLoading || emailValue.trim() === (emailTarget.email ?? "") || !emailValue.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50"
              >
                {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: aprovar / rejeitar solicitação de acesso ── */}
      {reviewTarget && (
        <Modal onClose={() => !reviewLoading && setReviewTarget(null)}>
          <div className="flex items-start gap-3 mb-4">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                reviewAction === "approve" ? "bg-emerald-50" : "bg-red-50",
              )}
            >
              {reviewAction === "approve" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Ban className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {reviewAction === "approve" ? "Liberar acesso" : "Rejeitar solicitação"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                <strong className="text-gray-800">
                  {reviewTarget.card_name ?? reviewTarget.cnpj}
                </strong>{" "}
                · {fmtCNPJ(reviewTarget.cnpj)}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4 text-sm">
            <p className="text-gray-500 text-xs">E-mail solicitado</p>
            <p className="font-medium text-gray-900 break-all">{reviewTarget.requested_email}</p>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            {reviewAction === "approve"
              ? "Ao aprovar, o e-mail será cadastrado na credencial do cliente e ele receberá um e-mail para concluir o primeiro acesso (verificação por código + criação de senha)."
              : "Ao rejeitar, o cliente será avisado por e-mail. Você pode informar o motivo abaixo."}
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {reviewAction === "approve" ? "Observação (opcional)" : "Motivo (opcional)"}
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            placeholder={reviewAction === "approve" ? "Anotação interna" : "Ex.: dados divergentes"}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none mb-4 resize-none"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setReviewTarget(null)}
              disabled={reviewLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleReview}
              disabled={reviewLoading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50",
                reviewAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700",
              )}
            >
              {reviewLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {reviewAction === "approve" ? "Aprovar acesso" : "Rejeitar"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: associar vendedor ao cliente ── */}
      {vendorTarget && (
        <Modal onClose={() => !vendorLoading && setVendorTarget(null)}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gsn-50 flex items-center justify-center shrink-0">
                <UserRound className="w-5 h-5 text-gsn-700" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Vendedor do cliente</h2>
                <p className="text-sm text-gray-500 mt-1">
                  <strong className="text-gray-800">
                    {vendorTarget.card_name ?? vendorTarget.card_code}
                  </strong>{" "}
                  · {fmtCNPJ(vendorTarget.cnpj)}
                </p>
              </div>
            </div>
            <button
              onClick={() => !vendorLoading && setVendorTarget(null)}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendedor</label>
          <select
            value={vendorCode}
            onChange={(e) => setVendorCode(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none mb-2 bg-white"
          >
            <option value="">Sem vendedor</option>
            {salespersons.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name ?? `Vendedor ${s.code}`} (#{s.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mb-4 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            O vendedor é gravado também no Business Partner do SAP (SalesPersonCode). Para exibir
            telefone/WhatsApp ao cliente no portal, cadastre o contato em “Contatos de vendedores”.
          </p>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setVendorTarget(null)}
              disabled={vendorLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssignVendor}
              disabled={vendorLoading || vendorCode === (vendorTarget.sales_person_code != null ? String(vendorTarget.sales_person_code) : "")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50"
            >
              {vendorLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: contatos de vendedores ── */}
      {contactsOpen && (
        <SalespersonContactsModal
          salespersons={salespersons}
          onClose={() => setContactsOpen(false)}
          onSaved={fetchSalespersons}
        />
      )}
    </ProtectedLayout>
  );
}

function SalespersonContactsModal({
  salespersons,
  onClose,
  onSaved,
}: {
  salespersons: Salesperson[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Salesperson[]>(salespersons);
  const [savingCode, setSavingCode] = useState<number | null>(null);

  const update = (code: number, field: keyof Salesperson, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.code === code ? { ...r, [field]: value } : r)),
    );
  };

  const save = async (row: Salesperson) => {
    setSavingCode(row.code);
    try {
      const res = await fetch(`/api/b2b-admin/salespersons/${row.code}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: row.name,
          phone: row.phone,
          whatsapp: row.whatsapp,
          email: row.email,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erro ao salvar contato");
      toast.success(`Contato de ${row.name ?? `Vendedor ${row.code}`} salvo.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar contato");
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gsn-50 flex items-center justify-center">
              <UserRound className="w-5 h-5 text-gsn-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Contatos de vendedores</h2>
              <p className="text-xs text-gray-500">
                Telefone/WhatsApp/e-mail exibidos ao cliente no Portal B2B
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-gray-500">
              Nenhum vendedor encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.code}
                  className="rounded-lg border border-gray-200 p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                >
                  <div className="sm:col-span-3 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {row.name ?? `Vendedor ${row.code}`}
                    </p>
                    <p className="text-xs text-gray-500">#{row.code}</p>
                  </div>
                  <div className="sm:col-span-3 relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={row.phone ?? ""}
                      onChange={(e) => update(row.code, "phone", e.target.value)}
                      placeholder="Telefone"
                      className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3 relative">
                    <MessageCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                    <input
                      value={row.whatsapp ?? ""}
                      onChange={(e) => update(row.code, "whatsapp", e.target.value)}
                      placeholder="WhatsApp"
                      className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        value={row.email ?? ""}
                        onChange={(e) => update(row.code, "email", e.target.value)}
                        placeholder="E-mail"
                        className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => save(row)}
                      disabled={savingCode === row.code}
                      className="p-2 rounded-lg text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50 shrink-0"
                      title="Salvar contato"
                    >
                      {savingCode === row.code ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestStatusBadge({ status }: { status: B2BEmailRequest["status"] }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        Aprovada
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
        <Ban className="w-3 h-3" />
        Rejeitada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
      <Clock className="w-3 h-3" />
      Pendente
    </span>
  );
}

// ── Subcomponentes ──────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function KpiCard({
  label,
  value,
  icon,
  onClick,
  active,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border px-4 py-3 text-left transition",
        active ? "border-gsn-700 ring-1 ring-gsn-700/30" : "border-gray-200",
        onClick && "hover:border-gsn-400 cursor-pointer",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </Tag>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
