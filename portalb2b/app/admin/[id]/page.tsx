"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAdmin } from "@/lib/admin/context";
import { adminGet, adminPatch, adminPost } from "@/lib/admin/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Send,
  Building2,
  MapPin,
  FileText,
  Settings2,
  Truck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  EMPTY_DELIVERY_FORM,
  ESTADOS_BR,
  formatCep,
  formatPhone,
  type DeliveryForm,
} from "@/components/onboarding/types";

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
  udf_bp: Record<string, unknown>;
  udf_addr: Record<string, unknown>;
  sap_config: Record<string, unknown>;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  sap_card_code: string | null;
  sap_error: string | null;
  created_at: string;
  updated_at: string;
  delivery: DeliveryForm | null;
}

interface UdfFieldMeta {
  label: string;
  type: string;
  options?: string[];
  default?: unknown;
}

interface UdfMetadata {
  udfBp: { label: string; fields: Record<string, UdfFieldMeta> };
  udfAddr: { label: string; fields: Record<string, UdfFieldMeta> };
  sapConfig: { label: string; fields: Record<string, UdfFieldMeta> };
}

const STATUS_MAP: Record<string, { label: string; variant: "warning" | "info" | "destructive" | "success" }> = {
  pending: { label: "Pendente", variant: "warning" },
  in_review: { label: "Em análise", variant: "info" },
  approved: { label: "Aprovado", variant: "info" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  published: { label: "Publicado no SAP", variant: "success" },
};

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function FieldInput({
  fieldKey,
  meta,
  value,
  onChange,
  disabled,
}: {
  fieldKey: string;
  meta: UdfFieldMeta;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
  disabled: boolean;
}) {
  const strVal = value?.toString() ?? "";

  if (meta.type === "select" && meta.options) {
    return (
      <select
        value={strVal}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        <option value="">--</option>
        {meta.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  return (
    <Input
      type={meta.type === "number" ? "number" : "text"}
      value={strVal}
      onChange={(e) =>
        onChange(fieldKey, meta.type === "number" ? Number(e.target.value) || null : e.target.value)
      }
      disabled={disabled}
      className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500 disabled:opacity-50"
    />
  );
}

export default function RegistrationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const regId = params.id as string;
  const { isAuthenticated, isLoading: adminLoading } = useAdmin();

  const [reg, setReg] = useState<Registration | null>(null);
  const [metadata, setMetadata] = useState<UdfMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notes, setNotes] = useState("");

  const [editUdfBp, setEditUdfBp] = useState<Record<string, unknown>>({});
  const [editUdfAddr, setEditUdfAddr] = useState<Record<string, unknown>>({});
  const [editSapCfg, setEditSapCfg] = useState<Record<string, unknown>>({});
  const [editInfo, setEditInfo] = useState({
    address: "",
    streetNumber: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    inscricaoEstadual: "",
    phone: "",
    contactName: "",
  });
  const [editDelivery, setEditDelivery] =
    useState<DeliveryForm>(EMPTY_DELIVERY_FORM);

  useEffect(() => {
    if (!adminLoading && !isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, adminLoading, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regData, meta] = await Promise.all([
        adminGet<Registration>(`/b2b/admin/registrations/${regId}`),
        adminGet<UdfMetadata>("/b2b/admin/udf-metadata"),
      ]);
      setReg(regData);
      setMetadata(meta);
      setEditUdfBp(regData.udf_bp ?? {});
      setEditUdfAddr(regData.udf_addr ?? {});
      setEditSapCfg(regData.sap_config ?? {});
      setNotes(regData.admin_notes ?? "");
      setEditInfo({
        address: regData.address ?? "",
        streetNumber: regData.street_number ?? "",
        neighborhood: regData.neighborhood ?? "",
        city: regData.city ?? "",
        state: regData.state ?? "",
        zipCode: regData.zip_code ?? "",
        inscricaoEstadual: regData.inscricao_estadual ?? "",
        phone: regData.phone ?? "",
        contactName: regData.contact_name ?? "",
      });
      setEditDelivery({ ...EMPTY_DELIVERY_FORM, ...(regData.delivery ?? {}) });
    } catch {
      toast.error("Erro ao carregar registro");
    } finally {
      setLoading(false);
    }
  }, [regId]);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await adminPatch<Registration>(
        `/b2b/admin/registrations/${regId}`,
        {
          udfBp: editUdfBp,
          udfAddr: editUdfAddr,
          sapConfig: editSapCfg,
          adminNotes: notes,
          ...editInfo,
          delivery: editDelivery,
        },
      );
      setReg(updated);
      toast.success("Dados salvos com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    try {
      const updated = await adminPost<Registration>(
        `/b2b/admin/registrations/${regId}/approve`,
        { notes },
      );
      setReg(updated);
      toast.success("Registro aprovado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar");
    }
  }

  async function handleReject() {
    if (!notes.trim()) {
      toast.error("Informe o motivo da rejeicao nas observacoes");
      return;
    }
    try {
      const updated = await adminPost<Registration>(
        `/b2b/admin/registrations/${regId}/reject`,
        { notes },
      );
      setReg(updated);
      toast.success("Registro rejeitado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao rejeitar");
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const result = await adminPost<{ ok: boolean; cardCode: string; message: string }>(
        `/b2b/admin/registrations/${regId}/publish`,
      );
      toast.success(`${result.message} - CardCode: ${result.cardCode}`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao publicar");
      await loadData();
    } finally {
      setPublishing(false);
    }
  }

  if (adminLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
      </div>
    );
  }

  if (!reg || !metadata) return null;

  const readonly = reg.status === "published" || reg.status === "rejected";
  const statusCfg = STATUS_MAP[reg.status] ?? STATUS_MAP.pending;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-800/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex-1" />
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          {reg.sap_card_code && (
            <Badge variant="success">SAP: {reg.sap_card_code}</Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {reg.sap_error && (
          <div className="rounded-lg border border-red-500/50 bg-red-900/20 p-4">
            <h3 className="text-sm font-medium text-red-300">Ultimo Erro SAP</h3>
            <pre className="mt-1 text-xs text-red-400 whitespace-pre-wrap overflow-auto max-h-40">
              {reg.sap_error}
            </pre>
          </div>
        )}

        {/* Dados da Empresa */}
        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Building2 className="h-4 w-4 text-emerald-400" />
              Dados da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">CNPJ</label>
                <div className="rounded-md bg-slate-700/50 px-3 py-2 text-sm font-mono">
                  {formatCnpj(reg.cnpj)}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Razao Social</label>
                <div className="rounded-md bg-slate-700/50 px-3 py-2 text-sm">
                  {reg.razao_social}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Nome Fantasia</label>
                <div className="rounded-md bg-slate-700/50 px-3 py-2 text-sm">
                  {reg.nome_fantasia || "-"}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Email</label>
                <div className="rounded-md bg-slate-700/50 px-3 py-2 text-sm">
                  {reg.email}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Telefone</label>
                <Input
                  value={editInfo.phone}
                  onChange={(e) => setEditInfo((s) => ({ ...s, phone: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Contato</label>
                <Input
                  value={editInfo.contactName}
                  onChange={(e) => setEditInfo((s) => ({ ...s, contactName: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Inscricao Estadual</label>
                <Input
                  value={editInfo.inscricaoEstadual}
                  onChange={(e) => setEditInfo((s) => ({ ...s, inscricaoEstadual: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Cadastrado em</label>
                <div className="rounded-md bg-slate-700/50 px-3 py-2 text-sm">
                  {new Date(reg.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <MapPin className="h-4 w-4 text-blue-400" />
              Endereco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Logradouro</label>
                <Input
                  value={editInfo.address}
                  onChange={(e) => setEditInfo((s) => ({ ...s, address: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Numero</label>
                <Input
                  value={editInfo.streetNumber}
                  onChange={(e) => setEditInfo((s) => ({ ...s, streetNumber: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Bairro</label>
                <Input
                  value={editInfo.neighborhood}
                  onChange={(e) => setEditInfo((s) => ({ ...s, neighborhood: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Cidade</label>
                <Input
                  value={editInfo.city}
                  onChange={(e) => setEditInfo((s) => ({ ...s, city: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Estado</label>
                <Input
                  value={editInfo.state}
                  onChange={(e) => setEditInfo((s) => ({ ...s, state: e.target.value }))}
                  disabled={readonly}
                  maxLength={2}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">CEP</label>
                <Input
                  value={editInfo.zipCode}
                  onChange={(e) => setEditInfo((s) => ({ ...s, zipCode: e.target.value }))}
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados de Entrega */}
        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Truck className="h-4 w-4 text-orange-400" />
              Dados de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={editDelivery.sameAsBilling}
                disabled={readonly}
                onChange={(e) =>
                  setEditDelivery((s) => ({ ...s, sameAsBilling: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-600 accent-emerald-500 disabled:opacity-50"
              />
              Entrega no mesmo endereço de cobrança
            </label>

            {!editDelivery.sameAsBilling && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">CEP</label>
                  <Input
                    value={editDelivery.zipCode}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, zipCode: formatCep(e.target.value) }))
                    }
                    disabled={readonly}
                    className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Logradouro</label>
                  <Input
                    value={editDelivery.street}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, street: e.target.value }))
                    }
                    disabled={readonly}
                    className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Número</label>
                  <Input
                    value={editDelivery.number}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, number: e.target.value }))
                    }
                    disabled={readonly}
                    className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Complemento</label>
                  <Input
                    value={editDelivery.complement}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, complement: e.target.value }))
                    }
                    disabled={readonly}
                    className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Bairro</label>
                  <Input
                    value={editDelivery.neighborhood}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, neighborhood: e.target.value }))
                    }
                    disabled={readonly}
                    className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Cidade</label>
                  <Input
                    value={editDelivery.city}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, city: e.target.value }))
                    }
                    disabled={readonly}
                    className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Estado</label>
                  <select
                    value={editDelivery.state}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, state: e.target.value }))
                    }
                    disabled={readonly}
                    className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    <option value="">--</option>
                    {ESTADOS_BR.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <label className="mb-1 block text-xs text-slate-400">Ponto de referência</label>
                  <Input
                    value={editDelivery.reference}
                    onChange={(e) =>
                      setEditDelivery((s) => ({ ...s, reference: e.target.value }))
                    }
                    disabled={readonly}
                    className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Contato (recebimento)</label>
                <Input
                  value={editDelivery.contactName}
                  onChange={(e) =>
                    setEditDelivery((s) => ({ ...s, contactName: e.target.value }))
                  }
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Telefone</label>
                <Input
                  value={editDelivery.contactPhone}
                  onChange={(e) =>
                    setEditDelivery((s) => ({ ...s, contactPhone: formatPhone(e.target.value) }))
                  }
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">E-mail</label>
                <Input
                  value={editDelivery.contactEmail}
                  onChange={(e) =>
                    setEditDelivery((s) => ({ ...s, contactEmail: e.target.value }))
                  }
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Dias para entrega</label>
                <Input
                  value={editDelivery.deliveryDays}
                  onChange={(e) =>
                    setEditDelivery((s) => ({ ...s, deliveryDays: e.target.value }))
                  }
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Horários</label>
                <Input
                  value={editDelivery.deliveryHours}
                  onChange={(e) =>
                    setEditDelivery((s) => ({ ...s, deliveryHours: e.target.value }))
                  }
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Restrição de veículo</label>
                <Input
                  value={editDelivery.vehicleRestriction}
                  onChange={(e) =>
                    setEditDelivery((s) => ({ ...s, vehicleRestriction: e.target.value }))
                  }
                  disabled={readonly}
                  className="border-slate-600 bg-slate-700/50 text-white disabled:opacity-50"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={editDelivery.needsScheduling}
                disabled={readonly}
                onChange={(e) =>
                  setEditDelivery((s) => ({ ...s, needsScheduling: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-600 accent-emerald-500 disabled:opacity-50"
              />
              Entrega precisa de agendamento prévio
            </label>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Observações de entrega</label>
              <textarea
                value={editDelivery.notes}
                onChange={(e) =>
                  setEditDelivery((s) => ({ ...s, notes: e.target.value }))
                }
                disabled={readonly}
                rows={3}
                className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 disabled:opacity-50"
                placeholder="Janelas, restrições e instruções para logística..."
              />
            </div>
          </CardContent>
        </Card>

        {/* UDFs do BP */}
        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <FileText className="h-4 w-4 text-amber-400" />
              {metadata.udfBp.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metadata.udfBp.fields).map(([key, meta]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-400" title={key}>
                    {meta.label}
                  </label>
                  <FieldInput
                    fieldKey={key}
                    meta={meta}
                    value={editUdfBp[key]}
                    onChange={(k, v) => setEditUdfBp((s) => ({ ...s, [k]: v }))}
                    disabled={readonly}
                  />
                  <span className="text-[10px] text-slate-600">{key}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* UDFs de Endereço */}
        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <MapPin className="h-4 w-4 text-purple-400" />
              {metadata.udfAddr.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metadata.udfAddr.fields).map(([key, meta]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-400" title={key}>
                    {meta.label}
                  </label>
                  <FieldInput
                    fieldKey={key}
                    meta={meta}
                    value={editUdfAddr[key]}
                    onChange={(k, v) => setEditUdfAddr((s) => ({ ...s, [k]: v }))}
                    disabled={readonly}
                  />
                  <span className="text-[10px] text-slate-600">{key}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Config SAP */}
        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Settings2 className="h-4 w-4 text-cyan-400" />
              {metadata.sapConfig.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(metadata.sapConfig.fields).map(([key, meta]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-400" title={key}>
                    {meta.label}
                  </label>
                  <FieldInput
                    fieldKey={key}
                    meta={meta}
                    value={editSapCfg[key]}
                    onChange={(k, v) => setEditSapCfg((s) => ({ ...s, [k]: v }))}
                    disabled={readonly}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Observações e Ações */}
        <Card className="border-slate-700 bg-slate-800/80">
          <CardHeader>
            <CardTitle className="text-white text-base">Observacoes e Acoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Observacoes do comercial
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={readonly}
                rows={3}
                className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 disabled:opacity-50"
                placeholder="Observacoes sobre o cadastro..."
              />
            </div>

            {reg.reviewed_by && (
              <div className="text-xs text-slate-500">
                Revisado por <strong>{reg.reviewed_by}</strong>{" "}
                {reg.reviewed_at &&
                  `em ${new Date(reg.reviewed_at).toLocaleString("pt-BR")}`}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {!readonly && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  Salvar
                </Button>
              )}

              {reg.status === "pending" && (
                <>
                  <Button
                    onClick={handleApprove}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="destructive"
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Rejeitar
                  </Button>
                </>
              )}

              {reg.status === "approved" && (
                <Button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {publishing ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-4 w-4" />
                  )}
                  Publicar no SAP B1
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
