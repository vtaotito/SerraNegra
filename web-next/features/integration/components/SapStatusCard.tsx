"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  Loader2,
  Shield,
  ShieldOff,
  Layers,
} from "lucide-react";
import {
  useSapHealth,
  useSapSyncStatus,
  useSyncSap,
  useSyncAll,
  useRevokeSapAccess,
  useRefreshSapSession,
} from "../hooks/useSapIntegration";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function SapStatusCard() {
  const { data: health, isLoading: isLoadingHealth } = useSapHealth();
  const { data: syncStatus, isLoading: isLoadingSyncStatus } = useSapSyncStatus();
  const syncMutation = useSyncSap();
  const syncAllMutation = useSyncAll();
  const revokeMutation = useRevokeSapAccess();
  const refreshMutation = useRefreshSapSession();

  // Auto-refresh sessao SAP a cada 25 minutos
  useEffect(() => {
    if (!health?.sap_connected) return;
    const interval = setInterval(async () => {
      try {
        await refreshMutation.mutateAsync();
      } catch { /* silencioso */ }
    }, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, [health?.sap_connected]);

  const handleSyncOrders = async () => {
    try {
      const result = await syncMutation.mutateAsync({});
      toast.success("Pedidos sincronizados!", {
        description: `${(result as any).imported ?? 0} pedido(s) importado(s)`,
      });
    } catch (error: any) {
      toast.error("Erro na sincronizacao", {
        description: String(error?.message || error),
      });
    }
  };

  const handleSyncAll = async () => {
    try {
      const result = await syncAllMutation.mutateAsync();
      const details = Object.entries(result.results || {})
        .map(([entity, r]) => `${entity}: ${r.message}`)
        .join("; ");
      toast.success("Sincronizacao completa!", {
        description: details || result.message,
        duration: 8000,
      });
    } catch (error: any) {
      toast.error("Erro na sincronizacao completa", {
        description: String(error?.message || error),
      });
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Tem certeza que deseja revogar o acesso ao SAP?")) return;
    try {
      await revokeMutation.mutateAsync();
      toast.success("Acesso revogado!");
    } catch (error: any) {
      toast.error("Erro ao revogar acesso", {
        description: String(error?.message || error),
      });
    }
  };

  const isSyncing = syncMutation.isPending || syncAllMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Status da Integracao SAP
              {health?.sap_connected && (
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Sessao Ativa
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Conexao e sincronizacao com SAP Business One
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleSyncAll}
              disabled={isSyncing || !health?.sap_connected}
              size="sm"
              className="gap-2"
            >
              {syncAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}
              Sincronizar Tudo
            </Button>
            <Button
              onClick={handleSyncOrders}
              disabled={isSyncing || !health?.sap_connected}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Pedidos
            </Button>
            {health?.sap_connected && (
              <Button
                onClick={handleRevoke}
                disabled={revokeMutation.isPending}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <ShieldOff className="h-4 w-4" />
                Revogar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status de Conexao */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Conexao SAP</span>
            {isLoadingHealth ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge variant={health?.sap_connected ? "default" : "destructive"}>
                <div
                  className={`mr-2 h-2 w-2 rounded-full ${
                    health?.sap_connected ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {health?.sap_connected ? "Conectado" : "Desconectado"}
              </Badge>
            )}
          </div>

          {health && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {health.session_valid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-muted-foreground">
                  Sessao: {health.session_valid ? "Valida" : "Invalida"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">
                  Latencia: {health.response_time_ms || "N/A"}ms
                </span>
              </div>
            </div>
          )}

          {health?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Erro de Conexao</p>
                  <p className="mt-1">{health.error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t" />

        {/* Status de Sync */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sincronizacao</span>
            {!isLoadingSyncStatus && syncStatus?.last_sync_status && (
              <Badge
                variant={
                  syncStatus.last_sync_status === "SUCCESS"
                    ? "default"
                    : syncStatus.last_sync_status === "FAILED"
                      ? "destructive"
                      : "secondary"
                }
              >
                {syncStatus.last_sync_status}
              </Badge>
            )}
          </div>

          {syncStatus && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ultima sincronizacao:</span>
                <span className="font-medium">
                  {syncStatus.last_sync_date
                    ? formatDistanceToNow(new Date(syncStatus.last_sync_date), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : "Nunca"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedidos abertos no SAP:</span>
                <span className="font-medium text-blue-600">
                  {syncStatus.sap_open_orders || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Resultado do ultimo sync all */}
        {syncAllMutation.data && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
            <p className="font-medium text-blue-900 mb-2">Resultado da Ultima Sincronizacao Completa</p>
            <div className="grid gap-1">
              {Object.entries(syncAllMutation.data.results || {}).map(([entity, r]) => (
                <div key={entity} className="flex items-center justify-between">
                  <span className="capitalize text-blue-800">{entity}</span>
                  <div className="flex items-center gap-2">
                    {r.ok ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-600" />
                    )}
                    <span className="text-xs text-blue-700">{r.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
