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

export function priorityBadgeClass(p: Priority) {
  return `badge-priority-${p}`;
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const dt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
  return dt.format(d);
}

export function formatCurrency(value: number, currency?: string | null) {
  // SAP B1 retorna moedas como "R$", "US$" etc - precisamos mapear para códigos ISO
  const currencyMap: Record<string, string> = {
    "R$": "BRL",
    "US$": "USD",
    "€": "EUR",
    "$": "USD"
  };

  const currencyCode = currency ? (currencyMap[currency] || currency) : "BRL";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode
  }).format(value);
}

export function formatSlaBadge(slaDueAtIso: string) {
  const now = Date.now();
  const due = new Date(slaDueAtIso).getTime();
  const hours = (due - now) / 3600000;

  let label: string;
  let className: string;

  if (hours < 0) {
    label = `${Math.abs(hours).toFixed(1)}h atrasado`;
    className = "badge badge-sla-late";
  } else if (hours <= 4) {
    label = `${hours.toFixed(1)}h restante`;
    className = "badge badge-sla-soon";
  } else {
    label = `${hours.toFixed(1)}h`;
    className = "badge badge-sla-ok";
  }

  return (
    <span className={className} title={`SLA: ${slaDueAtIso}`}>
      {label}
    </span>
  );
}

