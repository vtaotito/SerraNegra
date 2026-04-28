/** Respostas públicas `/api/bi/rd/*` — úteis no frontend e nos hooks. */

export interface RdSapBridge {
  pedidosNoPeriodo: number;
  faturamentoNoPeriodo: number;
  dateFrom: string;
  dateTo: string;
}

export interface RdOverviewResponse {
  configured: boolean;
  error: string | null;
  pipelines: unknown[];
  pipelinesWithCounts: Array<{
    id: string;
    name: string;
    stageCount: number;
    ongoingDealCount: number;
  }>;
  ongoingDealsSample: Array<{
    id: string;
    name: string;
    pipelineId: string | null;
    totalPrice: number | null;
    expectedClose: string | null;
  }>;
  ongoingTotals: {
    pipelineCount: number;
    ongoingDealCount: number;
    dealsTruncated: boolean;
    stageBuckets: Record<string, number>;
  } | null;
  sapBridge: RdSapBridge | null;
}

export interface RdContactResponse {
  configured: boolean;
  found?: boolean;
  contact?: {
    uuid?: string;
    name: string | null;
    email: string | null;
    jobTitle?: string | null;
    city?: string | null;
    state?: string | null;
    lastConversionDate?: string | null;
    tags?: string[];
    lifecycle?: string | null;
    cfCustomFields?: Record<string, string | number | boolean | null>;
  } | null;
  error?: string;
}
