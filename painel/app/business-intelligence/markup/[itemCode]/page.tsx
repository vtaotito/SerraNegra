"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Check, Calculator, Receipt, ChevronRight, AlertTriangle,
} from "lucide-react";
import { fmtBRL } from "@/lib/format";
import {
  fetchMarkupItems,
  saveMarkupOverride,
  type MarkupItem,
} from "@/lib/cockpit-api";
import { useFetch } from "@/hooks/useFetch";
import { LoadingSkeleton, ErrorState } from "@/components/cockpit/DataState";
import {
  calcCMV,
  calcPE,
  calcLucro,
  calcPrecoFromMargem,
  igForFaixa,
  ICMS_FAIXAS,
  type MarkupCostParams,
  type MarkupPriceParams,
} from "@/lib/markup-engine";

function MargemBadge({ value, size = "md" }: { value: number | null; size?: "sm" | "md" }) {
  if (value === null || isNaN(value)) return <span className="text-gray-300">&mdash;</span>;
  const pct = (value * 100).toFixed(1);
  const cls =
    value >= 0.15 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
    value >= 0.05 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
    value >= 0 ? "bg-red-50 text-red-600 ring-1 ring-red-200" :
    "bg-red-100 text-red-800 ring-1 ring-red-300";
  const sz = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return <span className={`inline-flex items-center justify-center rounded-full font-bold ${cls} ${sz}`}>{pct}%</span>;
}

function EditField({
  label, value, onChange, prefix, suffix, step,
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 group">
      <span className="text-xs text-gray-600 group-hover:text-gray-900 motion-safe:transition-colors">{label}</span>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-xs font-semibold text-gray-500">{prefix}</span>}
        <input
          type="number"
          step={step ?? "0.01"}
          value={value || ""}
          onChange={(e) => onChange(+(e.target.value) || 0)}
          className="w-[100px] px-2.5 py-1.5 border border-gray-200 rounded-md text-xs font-semibold text-right font-mono focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent bg-white transition-shadow"
        />
        {suffix && <span className="text-[10px] text-gray-400 min-w-[16px]">{suffix}</span>}
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-xs font-semibold text-gray-800 font-mono">{value}</span>
    </div>
  );
}

function PriceColumn({
  title, modo, icmsVenda, ig, cf, costParams: cp,
}: {
  title: string; modo: "preco" | "margem"; icmsVenda: number;
  ig: number; cf: number; costParams: MarkupCostParams;
}) {
  const [preco, setPreco] = useState(0);
  const [margem, setMargem] = useState(0.10);

  const params: MarkupPriceParams = { ...cp, icmsVenda, ig, cf };
  const pe = calcPE(params);

  const precoMilheiro = modo === "preco" ? preco * 1000 : calcPrecoFromMargem(margem, params);
  const margemCalc = modo === "preco" ? calcLucro(preco * 1000, params) : margem;
  const precoUnit = precoMilheiro / 1000;

  return (
    <div className="p-3 bg-white rounded-lg border border-gray-100">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {title}
        <span className="ml-1 font-normal text-gray-400">(CF: {(cf * 100).toFixed(0)}%)</span>
      </div>

      {modo === "preco" ? (
        <>
          <label className="text-[10px] text-gray-400 mb-1 block">Preço unitário:</label>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-bold text-gray-500">R$</span>
            <input
              type="number"
              step="0.01"
              value={preco || ""}
              onChange={(e) => setPreco(+(e.target.value) || 0)}
              placeholder="0,00"
              className="w-full px-2.5 py-2 border-2 border-cockpit-accent/20 rounded-lg text-sm font-bold text-center font-mono focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent bg-white transition-shadow"
            />
          </div>
          <div className="text-center py-1">
            <div className="text-[10px] text-gray-400 mb-1">Margem calculada</div>
            <MargemBadge value={margemCalc} />
          </div>
        </>
      ) : (
        <>
          <label className="text-[10px] text-gray-400 mb-1 block">Margem desejada (%):</label>
          <input
            type="number"
            step="0.5"
            value={(margem * 100) || ""}
            onChange={(e) => setMargem((+(e.target.value) || 0) / 100)}
            placeholder="10"
            className="w-full px-2.5 py-2 border-2 border-cockpit-accent/20 rounded-lg text-sm font-bold text-center font-mono focus:outline-none focus:ring-2 focus:ring-cockpit-accent/20 focus:border-cockpit-accent bg-white mb-3 transition-shadow"
          />
          <div className="text-center py-1">
            <div className="text-[10px] text-gray-400 mb-1">Preço calculado</div>
            <div className="text-lg font-bold text-gray-800">{fmtBRL(precoUnit)}</div>
          </div>
        </>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100 text-center">
        <span className="text-[9px] text-gray-400 uppercase tracking-wider">P.E.: </span>
        <span className="text-[11px] font-semibold text-gray-500">{fmtBRL(pe / 1000)}</span>
      </div>
    </div>
  );
}

function IcmsCard({
  label, icmsVenda, color, costParams: cp, ig, cfSaco, cfPallet,
}: {
  label: string; icmsVenda: number; color: string;
  costParams: MarkupCostParams; ig: number; cfSaco: number; cfPallet: number;
}) {
  const [modo, setModo] = useState<"preco" | "margem">("preco");

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex justify-between items-center" style={{ background: color }}>
        <span className="text-white font-bold text-sm">{label}</span>
        <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
          {(["preco", "margem"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold motion-safe:transition-all ${
                modo === m ? "bg-white shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
              style={modo === m ? { color } : undefined}
            >
              {m === "preco" ? "Preço → Margem" : "Margem → Preço"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3 bg-gray-50/50">
        <PriceColumn title="Saco / Unidade" modo={modo} icmsVenda={icmsVenda} ig={ig} cf={cfSaco} costParams={cp} />
        <PriceColumn title="Pallet / Milheiro" modo={modo} icmsVenda={icmsVenda} ig={ig} cf={cfPallet} costParams={cp} />
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 ${
      type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {message}
    </div>
  );
}

export default function MarkupDetailPage() {
  const { itemCode } = useParams<{ itemCode: string }>();
  const router = useRouter();
  const decodedCode = decodeURIComponent(itemCode);

  const { data, loading, error, refetch } = useFetch(() => fetchMarkupItems(), []);

  const item = useMemo(
    () => data?.items.find((i) => i.itemCode === decodedCode) ?? null,
    [data, decodedCode],
  );

  const [v, setV] = useState<number | null>(null);
  const [fr, setFr] = useState<number | null>(null);
  const [sc, setSc] = useState<number | null>(null);
  const [co, setCo] = useState<number | null>(null);
  const [pc, setPc] = useState<number | null>(null);
  const [ic, setIc] = useState<number | null>(null);
  const [ip, setIp] = useState<number | null>(null);
  const [cfSaco, setCfSaco] = useState(0.06);
  const [cfPallet, setCfPallet] = useState(0.03);
  const [cfSacoChanged, setCfSacoChanged] = useState(false);
  const [cfPalletChanged, setCfPalletChanged] = useState(false);
  const [tab, setTab] = useState<"preco" | "custos">("preco");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (item) {
      setCfSaco(item.custoFixoSaco);
      setCfPallet(item.custoFixoPallet);
    }
  }, [item]);

  const current = useMemo(() => {
    if (!item) return null;
    return {
      v: v ?? item.v,
      fr: fr ?? item.fr,
      sc: sc ?? item.sc,
      co: co ?? item.co,
      pc: pc ?? item.pc,
      ic: ic ?? item.ic,
      ip: ip ?? item.ip,
    };
  }, [item, v, fr, sc, co, pc, ic, ip]);

  const cmv = current ? calcCMV(current) : 0;

  const hasChanges = item != null && (
    v !== null || fr !== null || sc !== null || co !== null ||
    pc !== null || ic !== null || ip !== null ||
    cfSacoChanged || cfPalletChanged
  );

  const handleSave = useCallback(async () => {
    if (!item) return;
    setSaving(true);
    try {
      await saveMarkupOverride({
        itemCode: item.itemCode,
        precoSemImp: v,
        frete: fr,
        embalagem: sc,
        comissao: co,
        pisCofins: pc,
        icmsCompra: ic,
        ipi: ip,
        custoFixoSaco: cfSacoChanged ? cfSaco : null,
        custoFixoPallet: cfPalletChanged ? cfPallet : null,
      });
      setToast({ message: "Alterações salvas com sucesso", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao salvar",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [item, v, fr, sc, co, pc, ic, ip, cfSaco, cfPallet, cfSacoChanged, cfPalletChanged]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !saving) handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasChanges, saving, handleSave]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!item) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-3 text-gray-300">?</div>
        <p className="text-gray-500 mb-1">Produto <strong className="font-mono">{decodedCode}</strong> não encontrado.</p>
        <p className="text-xs text-gray-400 mb-4">Verifique o código ou retorne à lista.</p>
        <button
          type="button"
          onClick={() => router.push("/business-intelligence/markup")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-cockpit-border text-sm text-cockpit-accent hover:bg-gray-50 motion-safe:transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar à lista
        </button>
      </div>
    );
  }

  const cp: MarkupCostParams = current!;

  return (
    <div className="space-y-5">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => router.push("/business-intelligence/markup")}
            className="hover:text-cockpit-accent motion-safe:transition-colors"
          >
            MarkUp
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-800 font-medium font-mono">{item.itemCode}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/business-intelligence/markup")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cockpit-border text-xs text-gray-600 hover:bg-gray-50 motion-safe:transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white motion-safe:transition-all ${
              !hasChanges
                ? "bg-gray-300 cursor-not-allowed"
                : saving
                  ? "bg-cockpit-accent/70 cursor-wait"
                  : "bg-cockpit-accent hover:bg-cockpit-accent/90 shadow-sm"
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Salvando..." : "Salvar"}
            {hasChanges && !saving && <span className="text-[9px] opacity-70 ml-1">(Ctrl+S)</span>}
          </button>
        </div>
      </div>

      {/* Product header */}
      <div className="rounded-xl border border-cockpit-border bg-white p-5">
        <div className="flex items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-sm text-cockpit-accent font-bold">{item.itemCode}</span>
              {item.hasOverride && (
                <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md ring-1 ring-amber-200 font-medium">
                  Override ativo
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2 truncate" title={item.itemName}>{item.itemName}</h2>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
              {item.manufacturer && <span>Fornecedor: <strong className="text-gray-700">{item.manufacturer}</strong></span>}
              {item.itemGroup != null && <span>Grupo: <strong className="text-gray-700">{item.itemGroup}</strong></span>}
              {item.qtdPallet > 0 && <span>Qtd/Pallet: <strong className="text-gray-700">{item.qtdPallet}</strong></span>}
              {item.qtdSaco > 0 && <span>Qtd/Saco: <strong className="text-gray-700">{item.qtdSaco}</strong></span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-gray-400 uppercase font-medium">CMV Unitário</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">{fmtBRL(cmv / 1000)}</div>
            <div className="text-[10px] text-gray-400 mt-1">Milheiro: {fmtBRL(cmv)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-cockpit-border">
        <div className="flex gap-0">
          {([
            ["preco", "Precificação", Calculator],
            ["custos", "Custos e Tributos", Receipt],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium border-b-2 motion-safe:transition-colors ${
                tab === key
                  ? "border-cockpit-accent text-cockpit-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-cockpit-border bg-white p-5">
        {tab === "preco" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ICMS_FAIXAS.map((fx) => (
              <IcmsCard
                key={fx.label}
                label={fx.label}
                icmsVenda={fx.rate}
                color={fx.color}
                costParams={cp}
                ig={igForFaixa(fx.rate)}
                cfSaco={cfSaco}
                cfPallet={cfPallet}
              />
            ))}
          </div>
        ) : (
          <>
            {/* CMV highlight */}
            <div className="text-center p-6 bg-gradient-to-b from-gray-50 to-white rounded-xl border border-cockpit-accent/10 mb-6">
              <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Custo de Mercadoria Vendida (unitário)</div>
              <div className="text-4xl font-bold text-gray-900 mt-1">{fmtBRL(cmv / 1000)}</div>
              <div className="text-xs text-gray-400 mt-1">Milheiro: {fmtBRL(cmv)}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Custos */}
              <div className="rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cockpit-accent" />
                  Custos
                </h3>
                <div className="divide-y divide-gray-50">
                  <EditField label="Valor sem Impostos (milh)" value={cp.v} onChange={setV} prefix="R$" />
                  <EditField label="Frete (milh)" value={cp.fr} onChange={setFr} prefix="R$" />
                  <EditField label="Embalagem / Fardo (milh)" value={cp.sc} onChange={setSc} prefix="R$" />
                  <EditField label="Comissão (milh)" value={cp.co} onChange={setCo} prefix="R$" />
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Custos Fixos</div>
                  <EditField
                    label="Custo Fixo Saco"
                    value={cfSaco * 100}
                    onChange={(val) => { setCfSaco(val / 100); setCfSacoChanged(true); }}
                    suffix="%"
                    step="0.5"
                  />
                  <EditField
                    label="Custo Fixo Pallet"
                    value={cfPallet * 100}
                    onChange={(val) => { setCfPallet(val / 100); setCfPalletChanged(true); }}
                    suffix="%"
                    step="0.5"
                  />
                </div>
              </div>

              {/* Tributos */}
              <div className="rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  Tributos
                </h3>
                <div className="divide-y divide-gray-50">
                  <EditField label="PIS/COFINS" value={cp.pc * 100} onChange={(val) => setPc(val / 100)} suffix="%" step="0.01" />
                  <EditField label="ICMS Compra" value={cp.ic * 100} onChange={(val) => setIc(val / 100)} suffix="%" step="0.5" />
                  <EditField label="IPI" value={cp.ip * 100} onChange={(val) => setIp(val / 100)} suffix="%" step="0.01" />
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Constantes</div>
                  <ReadOnlyField label="Imposto Garrafaria (LP)" value="7,04%" />
                  <ReadOnlyField label="Micro Empresa" value="9,40%" />
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Base de Cálculo (milheiro)</div>
                  <ReadOnlyField label="Base tributária" value={fmtBRL(cp.v / (1 - (cp.pc + cp.ic)))} />
                  <ReadOnlyField label="Créd. ICMS+IPI" value={fmtBRL((cp.v / (1 - (cp.pc + cp.ic))) * (cp.ip + cp.ic))} />
                  <div className="flex items-center justify-between py-2 mt-1 pt-2 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">CMV total</span>
                    <span className="text-sm font-bold text-gray-900 font-mono">{fmtBRL(cmv)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
