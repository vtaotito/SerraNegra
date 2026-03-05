"use client";

export default function EstoquePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Estoque</h1>
        <p className="text-cockpit-muted mt-1">
          Posição por item — disponível, mínimo, unidade. Fonte: abas ESTOQUE / Planilha6.
        </p>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="p-4 border-b border-cockpit-border flex flex-wrap gap-2">
          <span className="text-sm text-cockpit-muted">Filtros:</span>
          <span className="px-2.5 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-sm text-gray-300">
            Todos os itens
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg/50">
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">COD</th>
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">Nº do item</th>
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">Descrição</th>
                <th className="text-right py-3 px-4 font-medium text-cockpit-muted">Em estoque</th>
                <th className="text-right py-3 px-4 font-medium text-cockpit-muted">Disponível</th>
                <th className="text-right py-3 px-4 font-medium text-cockpit-muted">Mínimo</th>
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["AR", "AR00000001", "BARRICA 3,5 LITROS TRA COM TORNEIRA", 68, 68, 30, "UN"],
                ["AR", "AR00000002", "COPINHO 100 ML CAVEIRA - UND", 273, 273, 20, "UN"],
                ["AR", "AR00000003", "GARRAFA ACOPLADA 300 ML TRA ROLHA", 120, 120, 30, "UN"],
              ].map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-cockpit-border/50 hover:bg-white/5"
                >
                  <td className="py-3 px-4 text-gray-200">{row[0]}</td>
                  <td className="py-3 px-4 text-gray-300">{row[1]}</td>
                  <td className="py-3 px-4 text-gray-300">{row[2]}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{row[3]}</td>
                  <td className="py-3 px-4 text-right text-cockpit-accent">{row[4]}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{row[5]}</td>
                  <td className="py-3 px-4 text-gray-400">{row[6]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          Amostra — dados completos via API de métricas (a implementar).
        </div>
      </div>
    </div>
  );
}
