import type { Priority } from "../api/types";

export type OrdersUiFilters = {
  search: string;
  sla: "ALL" | "LATE" | "DUE_SOON" | "OK";
  carrier: string;
  priority: "" | Priority;
};

export function FiltersBar(props: {
  value: OrdersUiFilters;
  carriers: string[];
  loadingCarriers?: boolean;
  onChange: (next: OrdersUiFilters) => void;
  onImportFromSap?: () => void;
  importingSap?: boolean;
}) {
  const v = props.value;

  const hasActiveFilters =
    v.search.trim() !== "" || v.carrier !== "" || v.priority !== "" || v.sla !== "ALL";

  return (
    <div className="filters">
      <div className="filters-left">
        <div className="field field-search">
          <label className="label" htmlFor="filter-search">
            Busca
          </label>
          <input
            id="filter-search"
            className="control"
            placeholder="ID do pedido, cliente…"
            value={v.search}
            onChange={(e) => props.onChange({ ...v, search: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="filter-sla">
            SLA
          </label>
          <select
            id="filter-sla"
            className="control"
            value={v.sla}
            onChange={(e) =>
              props.onChange({ ...v, sla: e.target.value as OrdersUiFilters["sla"] })
            }
          >
            <option value="ALL">Todos</option>
            <option value="LATE">Atrasado</option>
            <option value="DUE_SOON">Vence em até 4h</option>
            <option value="OK">OK</option>
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="filter-carrier">
            Transportadora
          </label>
          <select
            id="filter-carrier"
            className="control"
            value={v.carrier}
            onChange={(e) => props.onChange({ ...v, carrier: e.target.value })}
          >
            <option value="">
              {props.loadingCarriers ? "Carregando…" : "Todas"}
            </option>
            {props.carriers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="filter-priority">
            Prioridade
          </label>
          <select
            id="filter-priority"
            className="control"
            value={v.priority}
            onChange={(e) => props.onChange({ ...v, priority: e.target.value as any })}
          >
            <option value="">Todas</option>
            <option value="P1">P1 (Alta)</option>
            <option value="P2">P2 (Média)</option>
            <option value="P3">P3 (Baixa)</option>
          </select>
        </div>
      </div>

      <div className="filters-right" style={{ display: "flex", gap: "8px" }}>
        {props.onImportFromSap && (
          <button
            className="btn btn-sm btn-primary"
            onClick={props.onImportFromSap}
            disabled={props.importingSap}
            title="Sincroniza pedidos do SAP para o WMS e atualiza a lista"
          >
            {props.importingSap ? (
              <>
                <span className="spinner" style={{ marginRight: 6 }} />
                Importando…
              </>
            ) : (
              "Importar do SAP"
            )}
          </button>
        )}
        {hasActiveFilters && (
          <button
            className="btn btn-sm"
            onClick={() =>
              props.onChange({ search: "", carrier: "", priority: "", sla: "ALL" })
            }
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

