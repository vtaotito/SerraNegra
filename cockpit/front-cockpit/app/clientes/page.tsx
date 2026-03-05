"use client";

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <p className="text-cockpit-muted mt-1">
          Análise por cliente — faturamento, concentração 80/20, clientes em risco. Fonte: aba CLIENTE (pivot).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ranking — faturamento</h2>
          <p className="text-sm text-cockpit-muted">
            Tabela e sparklines por mês (dados da API em breve).
          </p>
        </div>
        <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Concentração 80/20</h2>
          <p className="text-sm text-cockpit-muted">
            Pareto clientes (dados da API em breve).
          </p>
        </div>
      </div>
    </div>
  );
}
