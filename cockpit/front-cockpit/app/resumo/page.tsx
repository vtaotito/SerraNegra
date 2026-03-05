"use client";

export default function ResumoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Resumo Comercial</h1>
        <p className="text-cockpit-muted mt-1">
          Totais para reconciliação — indicadores de estoque, custo, evolução. Fonte: aba RESUMO COMERCIAL.
        </p>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <p className="text-sm text-cockpit-muted">
          Comparativo DW vs total declarado no Excel (reconciliação) — dados via API em breve.
        </p>
      </div>
    </div>
  );
}
