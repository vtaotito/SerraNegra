export enum OrderStatus {
  A_SEPARAR = "A_SEPARAR",
  EM_SEPARACAO = "EM_SEPARACAO",
  CONFERIDO = "CONFERIDO",
  AGUARDANDO_COTACAO = "AGUARDANDO_COTACAO",
  AGUARDANDO_COLETA = "AGUARDANDO_COLETA",
  DESPACHADO = "DESPACHADO",
}

export enum SyncStatus {
  SYNCED = "SYNCED",
  PENDING = "PENDING",
  ERROR = "ERROR",
}

export const ORDER_STATUS_CONFIG = {
  [OrderStatus.A_SEPARAR]: {
    label: "A Separar",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: "PackageOpen",
  },
  [OrderStatus.EM_SEPARACAO]: {
    label: "Em Separação",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    icon: "PackageSearch",
  },
  [OrderStatus.CONFERIDO]: {
    label: "Conferido",
    color: "bg-violet-100 text-violet-800 border-violet-300",
    icon: "PackageCheck",
  },
  [OrderStatus.AGUARDANDO_COTACAO]: {
    label: "Aguardando Cotação",
    color: "bg-pink-100 text-pink-800 border-pink-300",
    icon: "DollarSign",
  },
  [OrderStatus.AGUARDANDO_COLETA]: {
    label: "Aguardando Coleta",
    color: "bg-green-100 text-green-800 border-green-300",
    icon: "Truck",
  },
  [OrderStatus.DESPACHADO]: {
    label: "Despachado",
    color: "bg-cyan-100 text-cyan-800 border-cyan-300",
    icon: "CheckCircle2",
  },
};

export const SYNC_STATUS_CONFIG = {
  [SyncStatus.SYNCED]: {
    label: "Sincronizado",
    color: "bg-green-100 text-green-800",
    icon: "CheckCircle",
  },
  [SyncStatus.PENDING]: {
    label: "Pendente",
    color: "bg-amber-100 text-amber-800",
    icon: "Clock",
  },
  [SyncStatus.ERROR]: {
    label: "Erro",
    color: "bg-red-100 text-red-800",
    icon: "AlertCircle",
  },
};

export const PRIORITY_CONFIG = {
  1: {
    label: "Urgente (P1)",
    color: "bg-red-100 text-red-800",
    icon: "AlertTriangle",
  },
  2: {
    label: "Alta",
    color: "bg-orange-100 text-orange-800",
    icon: "ArrowUp",
  },
  3: {
    label: "Normal (P2)",
    color: "bg-blue-100 text-blue-800",
    icon: "Minus",
  },
  4: {
    label: "Baixa",
    color: "bg-gray-100 text-gray-800",
    icon: "ArrowDown",
  },
  5: {
    label: "Muito Baixa (P3)",
    color: "bg-gray-100 text-gray-600",
    icon: "ArrowDown",
  },
};
