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
}) {
  const v = props.value;

  return (
    <div className="filters">
      <div className="filters-left">
        <div className="field">
          <div className="label">Busca</div>
          <input
            className="control"
            placeholder="orderId, externalOrderId, customerId…"
            value={v.search}
            onChange={(e) => props.onChange({ ...v, search: e.target.value })}
          />
        </div>

        <div className="field">
          <div className="label">SLA</div>
          <select
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
          <div className="label">Transportadora</div>
          <select
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
          <div className="label">Prioridade</div>
          <select
            className="control"
            value={v.priority}
            onChange={(e) => props.onChange({ ...v, priority: e.target.value as any })}
          >
            <option value="">Todas</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </div>
      </div>

      <div className="filters-right">
        <button
          className="btn"
          onClick={() =>
            props.onChange({ search: "", carrier: "", priority: "", sla: "ALL" })
          }
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}

