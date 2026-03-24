"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useState, useCallback } from "react";
import {
  Zap, Loader2, CheckCircle2, XCircle,
  RefreshCw, Wifi, WifiOff, Database, ArrowDownToLine,
} from "lucide-react";
import { syncSAP, sapHealth } from "@/lib/cockpit-api";

const SYNC_ENDPOINTS = [
  { key: "cockpit" as const, label: "Sync Completo", desc: "Todas as entidades do SAP", icon: Database },
  { key: "invoices" as const, label: "Notas Fiscais", desc: "A/R Invoices", icon: ArrowDownToLine },
  { key: "products" as const, label: "Produtos", desc: "Items + UDFs", icon: ArrowDownToLine },
  { key: "inventory" as const, label: "Estoque", desc: "Warehouse info", icon: ArrowDownToLine },
  { key: "customers" as const, label: "Clientes", desc: "BusinessPartners", icon: ArrowDownToLine },
  { key: "salespersons" as const, label: "Vendedores", desc: "SalesPersons", icon: ArrowDownToLine },
];

export default function IntegracoesPage() {
  const { user } = useAuth();
  const [syncStates, setSyncStates] = useState<Record<string, "idle" | "loading" | "ok" | "error">>({});
  const [sapStatus, setSapStatus] = useState<{ connected: boolean; ms: number } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const handleSync = useCallback(async (endpoint: string) => {
    setSyncStates((prev) => ({ ...prev, [endpoint]: "loading" }));
    try {
      await syncSAP(endpoint as any);
      setSyncStates((prev) => ({ ...prev, [endpoint]: "ok" }));
      setTimeout(() => setSyncStates((prev) => ({ ...prev, [endpoint]: "idle" })), 4000);
    } catch {
      setSyncStates((prev) => ({ ...prev, [endpoint]: "error" }));
      setTimeout(() => setSyncStates((prev) => ({ ...prev, [endpoint]: "idle" })), 5000);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const data = await sapHealth();
      setSapStatus({ connected: data.sap_connected, ms: data.response_time_ms });
    } catch {
      setSapStatus({ connected: false, ms: 0 });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  if (!user) return null;

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gsn-50">
              <Zap className="w-5 h-5 text-gsn-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
              <p className="text-sm text-gray-500">SAP Business One · Service Layer</p>
            </div>
          </div>
          <button
            onClick={checkHealth}
            disabled={checkingHealth}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {checkingHealth ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Verificar conexão
          </button>
        </div>

        {sapStatus && (
          <div className={`rounded-xl border p-4 mb-6 flex items-center gap-3 ${
            sapStatus.connected
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}>
            {sapStatus.connected ? (
              <>
                <Wifi className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">SAP conectado</p>
                  <p className="text-xs text-emerald-600">Tempo de resposta: {sapStatus.ms}ms</p>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">SAP offline</p>
                  <p className="text-xs text-red-600">Verifique a conexão com o Service Layer</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-900">Sincronização de dados</h2>
            <p className="text-xs text-gray-500 mt-0.5">Clique para sincronizar cada entidade com o SAP B1</p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SYNC_ENDPOINTS.map((ep) => {
              const state = syncStates[ep.key] || "idle";
              const Icon = ep.icon;
              return (
                <button
                  key={ep.key}
                  onClick={() => handleSync(ep.key)}
                  disabled={state === "loading"}
                  className={`rounded-xl p-4 border text-left transition-all duration-200 ${
                    state === "ok"
                      ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
                      : state === "error"
                      ? "border-red-300 bg-red-50 ring-1 ring-red-200"
                      : state === "loading"
                      ? "border-gsn-300 bg-gsn-50/50"
                      : "border-gray-200 bg-white hover:border-gsn-300 hover:shadow-sm"
                  } disabled:cursor-wait`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${
                        state === "ok" ? "text-emerald-600" :
                        state === "error" ? "text-red-500" :
                        state === "loading" ? "text-gsn-600" : "text-gray-400"
                      }`} />
                      <p className="text-sm font-semibold text-gray-900">{ep.label}</p>
                    </div>
                    {state === "loading" && <Loader2 className="w-4 h-4 text-gsn-600 animate-spin" />}
                    {state === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {state === "error" && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  <p className="text-xs text-gray-500">{ep.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
