import type { OrderStatus, Priority } from "../api/types";

export function formatStatusLabel(s: OrderStatus) {
  switch (s) {
    case "A_SEPARAR":
      return "A separar";
    case "EM_SEPARACAO":
      return "Em separação";
    case "CONFERIDO":
      return "Conferido";
    case "AGUARDANDO_COTACAO":
      return "Aguardando cotação";
    case "AGUARDANDO_COLETA":
      return "Aguardando coleta";
    case "DESPACHADO":
      return "Despachado";
    default:
      return s;
  }
}

export function priorityColor(p: Priority) {
  if (p === "P1")
    return { border: "rgba(255,93,122,0.6)", bg: "rgba(255,93,122,0.12)", text: "#ff9fb0" };
  if (p === "P2")
    return { border: "rgba(255,193,93,0.6)", bg: "rgba(255,193,93,0.12)", text: "#ffd39a" };
  return { border: "rgba(93,214,255,0.6)", bg: "rgba(93,214,255,0.12)", text: "#b8efff" };
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const dt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
  return dt.format(d);
}

export function formatSlaBadge(slaDueAtIso: string) {
  const now = Date.now();
  const due = new Date(slaDueAtIso).getTime();
  const hours = (due - now) / 3600000;
  const label =
    hours < 0
      ? `SLA ${Math.abs(hours).toFixed(1)}h atrasado`
      : `SLA ${hours.toFixed(1)}h`;

  const style =
    hours < 0
      ? {
          borderColor: "rgba(255,93,122,0.55)",
          background: "rgba(255,93,122,0.12)",
          color: "#ff9fb0"
        }
      : hours <= 4
        ? {
            borderColor: "rgba(255,193,93,0.55)",
            background: "rgba(255,193,93,0.12)",
            color: "#ffd39a"
          }
        : {
            borderColor: "rgba(105,240,174,0.45)",
            background: "rgba(105,240,174,0.10)",
            color: "#b6ffd5"
          };

  return (
    <span className="badge" style={style} title={`Vence em ${slaDueAtIso}`}>
      {label}
    </span>
  );
}

