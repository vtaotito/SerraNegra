"use client";

export default function VendedoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mapa de Vendedores</h1>
        <p className="text-cockpit-muted mt-1">
          Volume de vendas e métricas por vendedor. Fonte: aba MAPA VENDEDORES.
        </p>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <p className="text-sm text-cockpit-muted">
          Tabela e gráficos por vendedor (dados via API em breve).
        </p>
      </div>
    </div>
  );
}
