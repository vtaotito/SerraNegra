"use client";

export default function ComercialDadosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Documentos / Vendas</h1>
        <p className="text-cockpit-muted mt-1">
          Linhas de documentos — filtros por período, cliente, produto, forma de pagamento
        </p>
      </div>

      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface overflow-hidden">
        <div className="p-4 border-b border-cockpit-border flex flex-wrap gap-2">
          <span className="text-sm text-cockpit-muted">Filtros:</span>
          <span className="px-2.5 py-1 rounded-md bg-cockpit-accent/20 text-cockpit-accent text-sm">
            Nov 2025
          </span>
          <span className="px-2.5 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-sm text-gray-300">
            Todos clientes
          </span>
          <span className="px-2.5 py-1 rounded-md bg-cockpit-bg border border-cockpit-border text-sm text-gray-300">
            Todos produtos
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border bg-cockpit-bg/50">
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">
                  Nº doc
                </th>
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">
                  Data doc
                </th>
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">
                  Cliente
                </th>
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">
                  Item
                </th>
                <th className="text-right py-3 px-4 font-medium text-cockpit-muted">
                  Qtd
                </th>
                <th className="text-right py-3 px-4 font-medium text-cockpit-muted">
                  Total (R$)
                </th>
                <th className="text-left py-3 px-4 font-medium text-cockpit-muted">
                  Forma pgto
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                [448, "01/03/2023", "C00700", "GN0000116", 96, "371,75", "Cartão"],
                [449, "01/03/2023", "C00527", "GN0000116", 120, "464,59", "Transf."],
                [450, "02/03/2023", "C00100", "TA0000010", 100, "50,00", "Boleto"],
              ].map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-cockpit-border/50 hover:bg-white/5"
                >
                  <td className="py-3 px-4 text-gray-200">{row[0]}</td>
                  <td className="py-3 px-4 text-gray-300">{row[1]}</td>
                  <td className="py-3 px-4 text-gray-300">{row[2]}</td>
                  <td className="py-3 px-4 text-gray-300">{row[3]}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{row[4]}</td>
                  <td className="py-3 px-4 text-right text-cockpit-accent">
                    {row[5]}
                  </td>
                  <td className="py-3 px-4 text-gray-400">{row[6]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-cockpit-border text-xs text-cockpit-muted">
          Amostra — dados completos via API de métricas (a implementar). Fonte: aba DADOS.
        </div>
      </div>
    </div>
  );
}
