"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, XCircle, Loader2, Shield, ShieldOff } from "lucide-react";
import { useSapHealth, useSapSyncStatus, useSyncSap, useRevokeSapAccess, useRefreshSapSession } from "../hooks/useSapIntegration";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function SapStatusCard() {
  const { data: health, isLoading: isLoadingHealth } = useSapHealth();
  const { data: syncStatus, isLoading: isLoadingSyncStatus } = useSapSyncStatus();
  const syncMutation = useSyncSap();
  const revokeMutation = useRevokeSapAccess();
  const refreshMutation = useRefreshSapSession();

  // Auto-refresh sessão SAP a cada 25 minutos (sessão expira em 30)
  useEffect(() => {
    if (!health?.sap_connected) return;

    const interval = setInterval(async () => {
      try {
        await refreshMutation.mutateAsync();
        console.log("Sessão SAP renovada automaticamente");
      } catch (error) {
        console.error("Erro ao renovar sessão SAP:", error);
      }
    }, 25 * 60 * 1000); // 25 minutos

    return () => clearInterval(interval);
  }, [health?.sap_connected]);

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync({ force: false });
      toast.success("Sincronização concluída!", {
        description: `${result.synced_count} pedido(s) sincronizado(s) em ${result.duration_ms}ms`,
      });
    } catch (error: any) {
      const errorMessage = typeof error === 'string'
        ? error
        : error?.message || error?.error || "Falha ao sincronizar com SAP";
      
      toast.error("Erro na sincronização", {
        description: String(errorMessage),
      });
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Tem certeza que deseja revogar o acesso ao SAP? Você precisará configurar novamente.")) {
      return;
    }

    try {
      await revokeMutation.mutateAsync();
      toast.success("Acesso revogado!", {
        description: "Configuração SAP removida com sucesso.",
      });
    } catch (error: any) {
      const errorMessage = typeof error === 'string'
        ? error
        : error?.message || error?.error || "Erro ao revogar acesso";
      
      toast.error("Erro ao revogar acesso", {
        description: String(errorMessage),
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
            <CardTitle className="flex items-center gap-2">
              Status da Integração SAP
              {health?.sap_connected && (
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Sessão Ativa
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Status da conexão e sincronização com SAP Business One
            </CardDescription>
          </div>
          <div className="flex gap-2">
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
            {health?.sap_connected && (
              <Button
                onClick={handleRevoke}
                disabled={revokeMutation.isPending}
                variant="destructive"
                size="sm"
              >
                {revokeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Revogando...
                  </>
                ) : (
                  <>
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Revogar Acesso
                  </>
                )}
              </Button>
            )}
          </div>
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

        {/* Info sobre Worker e Sessão */}
        <div className="space-y-2">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
            <p className="font-medium mb-1">ℹ️ Sincronização Automática</p>
            <p>
              O Worker sincroniza pedidos automaticamente a cada 30 segundos. Use o botão
              "Sincronizar Agora" para forçar uma sincronização manual imediata.
            </p>
          </div>
          
          {health?.sap_connected && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-900">
              <p className="font-medium mb-1 flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Sessão Ativa e Protegida
              </p>
              <p>
                A sessão SAP é renovada automaticamente a cada 25 minutos e permanece 
                ativa até você revogar o acesso. As credenciais estão salvas de forma segura.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
