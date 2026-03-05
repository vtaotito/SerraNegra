"use client";

export default function MargensPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CMV / Margens</h1>
        <p className="text-cockpit-muted mt-1">
          Drivers (preço, volume, mix, custo), heatmap mês × categoria. Fontes: CMV, ESTUDO DE MARGENS.
        </p>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        <p className="text-sm text-cockpit-muted">
          Waterfall de drivers e heatmap (dados via API em breve).
        </p>
      </div>
    </div>
  );
}
