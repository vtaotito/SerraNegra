"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle, Loader2 } from "lucide-react";
import { useSapHealth, useSapSyncStatus, useSyncSap } from "../hooks/useSapIntegration";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function SapStatusCard() {
  const { data: health, isLoading: isLoadingHealth } = useSapHealth();
  const { data: syncStatus, isLoading: isLoadingSyncStatus } = useSapSyncStatus();
  const syncMutation = useSyncSap();

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync({ force: false });
      toast.success("Sincronização concluída!", {
        description: `${result.synced_count} pedido(s) sincronizado(s) em ${result.duration_ms}ms`,
      });
    } catch (error: any) {
      toast.error("Erro na sincronização", {
        description: error.message || "Falha ao sincronizar com SAP",
      });
    }
  };

  const getStatusColor = (connected: boolean | undefined) => {
    if (connected === undefined) return "bg-gray-500";
    return connected ? "bg-green-500" : "bg-red-500";
  };

  const getStatusText = (connected: boolean | undefined) => {
    if (connected === undefined) return "Desconhecido";
    return connected ? "Conectado" : "Desconectado";
  };

  const getSyncStatusVariant = (status: string | null | undefined) => {
    if (!status) return "secondary";
    if (status === "SUCCESS") return "default";
    if (status === "FAILED") return "destructive";
    return "secondary";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Status da Integração SAP</CardTitle>
            <CardDescription>
              Status da conexão e sincronização com SAP Business One
            </CardDescription>
          </div>
          <Button
            onClick={handleSync}
            disabled={syncMutation.isPending || !health?.sap_connected}
            size="sm"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar Agora
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status de Conexão */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Conexão SAP</span>
            {isLoadingHealth ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Badge variant={health?.sap_connected ? "default" : "destructive"}>
                <div
                  className={`mr-2 h-2 w-2 rounded-full ${getStatusColor(health?.sap_connected)}`}
                />
                {getStatusText(health?.sap_connected)}
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
                  Sessão: {health.session_valid ? "Válida" : "Inválida"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">
                  Latência: {health.response_time_ms || "N/A"}ms
                </span>
              </div>
            </div>
          )}

          {health?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Erro de Conexão</p>
                  <p className="mt-1">{health.error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="border-t" />

        {/* Status de Sincronização */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status de Sincronização</span>
            {isLoadingSyncStatus ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              syncStatus?.last_sync_status && (
                <Badge variant={getSyncStatusVariant(syncStatus.last_sync_status)}>
                  {syncStatus.last_sync_status}
                </Badge>
              )
            )}
          </div>

          {syncStatus && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última sincronização:</span>
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
                <span className="text-muted-foreground">Pedidos sincronizados:</span>
                <span className="font-medium">{syncStatus.last_sync_count || 0}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedidos abertos no SAP:</span>
                <span className="font-medium text-blue-600">
                  {syncStatus.sap_open_orders || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Próxima sincronização:</span>
                <span className="font-medium">{syncStatus.next_sync_estimate || "N/A"}</span>
              </div>
            </div>
          )}

          {syncStatus?.error && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Aviso</p>
                  <p className="mt-1">{syncStatus.error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info sobre Worker */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
          <p className="font-medium mb-1">ℹ️ Sincronização Automática</p>
          <p>
            O Worker sincroniza pedidos automaticamente a cada 30 segundos. Use o botão
            "Sincronizar Agora" para forçar uma sincronização manual imediata.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
