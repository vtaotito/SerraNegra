import { AppLayout } from "@/components/layout/AppLayout";

export default function IntegracaoPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integração</h1>
          <p className="text-muted-foreground">
            Status de sincronização com SAP B1
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            🚧 Painel de integração em desenvolvimento (Fase 7)
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
