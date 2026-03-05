"use client";

export default function CarteiraPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Carteira Geral</h1>
        <p className="text-cockpit-muted mt-1">
          Pipeline por vendedor e segmento — totais, ticket médio, previsão. Fonte: aba CARTEIRA GERAL.
        </p>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Carteira por mês e segmento</h2>
        <p className="text-sm text-cockpit-muted">
          Gráficos e tabela de oportunidades (cliente, valor, data prevista, status) — dados via API em breve.
        </p>
      </div>
    </div>
  );
}
