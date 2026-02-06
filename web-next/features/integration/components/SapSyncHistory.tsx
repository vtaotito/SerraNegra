"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SapSyncHistoryItem } from "../types";

interface SapSyncHistoryProps {
  history: SapSyncHistoryItem[];
  isLoading?: boolean;
}

export function SapSyncHistory({ history, isLoading }: SapSyncHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Sincronizações</CardTitle>
          <CardDescription>Últimas 10 sincronizações realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Sincronizações</CardTitle>
        <CardDescription>Últimas 10 sincronizações realizadas</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma sincronização realizada ainda</p>
            <p className="text-sm mt-1">
              Use o botão "Sincronizar Agora" para iniciar a primeira sincronização
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {item.status === "SUCCESS" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {formatDistanceToNow(new Date(item.sync_date), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    <Badge variant={item.status === "SUCCESS" ? "default" : "destructive"}>
                      {item.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{item.synced_count} pedido(s)</span>
                    <span>{item.duration_ms}ms</span>
                  </div>

                  {item.error_message && (
                    <p className="text-sm text-red-600 mt-2">{item.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
