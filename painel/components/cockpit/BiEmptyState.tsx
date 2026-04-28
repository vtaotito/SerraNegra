"use client";

export function BiEmptyState({
  title = "Sem dados no período",
}: {
  title?: string;
}) {
  return (
    <div className="text-center py-10 px-4 text-sm space-y-3" role="status">
      <p className="font-medium text-gray-700">{title}</p>
      <p className="text-xs text-cockpit-muted max-w-md mx-auto leading-relaxed">
        Tente <strong className="text-gray-800">ampliar o período</strong> no seletor acima ou verifique a
        sincronização com o SAP usando o botão de atualizar na barra do BI.
      </p>
    </div>
  );
}
