/**
 * Report Service
 * 
 * Serviço para execução de relatórios e análises do WMS.
 * Fornece interface TypeScript para as queries SQL dos relatórios.
 */

export type DateRange = {
  startDate: string; // ISO-8601
  endDate: string;   // ISO-8601
};

export type SLAStatus = 'DENTRO_SLA' | 'ALERTA' | 'FORA_SLA';
export type RiskLevel = 'BAIXO' | 'MÉDIO' | 'ALTO' | 'CRÍTICO';
export type DivergenceType = 'EXCESSO' | 'FALTA' | 'OK';
export type Severity = 'NENHUMA' | 'MÉDIA' | 'ALTA' | 'CRÍTICA';

// ============================================================================
// TIPOS DE RETORNO DOS RELATÓRIOS
// ============================================================================

export type SLAPickingReport = {
  orderId: string;
  externalOrderId?: string;
  customerId: string;
  orderCreatedAt: string;
  pickingStartedAt: string;
  pickingCompletedAt: string;
  pickingDurationMinutes: number;
  waitTimeMinutes: number;
  slaStatus: SLAStatus;
  totalItems: number;
  totalUnits: number;
};

export type SLAEndToEndReport = {
  orderId: string;
  externalOrderId?: string;
  customerId: string;
  orderCreatedAt: string;
  dispatchedAt: string;
  totalDurationHours: number;
  slaStatus: SLAStatus;
  pickingStarted?: string;
  pickingCompleted?: string;
  checked?: string;
  quoteRequested?: string;
  readyForPickup?: string;
  totalItems: number;
  totalUnits: number;
};

export type OrderAtRisk = {
  orderId: string;
  externalOrderId?: string;
  customerId: string;
  status: string;
  createdAt: string;
  hoursSinceCreated: number;
  slaHours: number;
  slaConsumedPercentage: number;
  riskLevel: RiskLevel;
  totalItems: number;
};

export type SLASummary = {
  period: string;
  totalOrders: number;
  withinSla: number;
  withinSlaPercentage: number;
  alertSla: number;
  alertSlaPercentage: number;
  outsideSla: number;
  outsideSlaPercentage: number;
  avgDurationHours: number;
  minDurationHours: number;
  maxDurationHours: number;
};

export type PickerProductivity = {
  pickerId: string;
  workDate: string;
  tasksCompleted: number;
  ordersCompleted: number;
  totalUnitsPicked: number;
  uniqueSkus: number;
  totalHours: number;
  unitsPerHour: number;
  avgMinutesPerTask: number;
  avgMinutesPerOrder: number;
  accuracyPercentage: number;
};

export type PickerRanking = {
  ranking: number;
  pickerId: string;
  totalOrders: number;
  totalUnits: number;
  totalHours: number;
  unitsPerHour: number;
  avgAccuracy: number;
  performanceScore: number;
};

export type ScanDivergence = {
  taskId: string;
  orderId: string;
  externalOrderId?: string;
  taskType: string;
  operatorId?: string;
  sku: string;
  expectedQuantity: number;
  scannedQuantity: number;
  divergence: number;
  divergenceType: DivergenceType;
  divergencePercentage: number;
  severity: Severity;
  occurredAt: string;
  totalScans: number;
};

export type DivergenceBySKU = {
  sku: string;
  totalTasks: number;
  totalExpected: number;
  totalScanned: number;
  totalDivergence: number;
  tasksWithDivergence: number;
  divergenceRate: number;
  excessCount: number;
  shortageCount: number;
  avgDivergence: number;
  lastDivergenceDate: string;
};

export type AccuracyKPI = {
  period: string;
  totalTasks: number;
  perfectTasks: number;
  tasksWithMinorDivergence: number;
  tasksWithMajorDivergence: number;
  overallAccuracy: number;
  perfectRate: number;
  minorDivergenceRate: number;
  majorDivergenceRate: number;
};

// ============================================================================
// INTERFACE DO DATABASE CLIENT (abstração)
// ============================================================================

export interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

// ============================================================================
// REPORT SERVICE
// ============================================================================

export class ReportService {
  constructor(private db: DatabaseClient) {}

  // ==========================================================================
  // RELATÓRIOS DE SLA
  // ==========================================================================

  /**
   * Relatório de tempo de separação por pedido
   */
  async getSLAPickingTime(options?: {
    orderId?: string;
    dateRange?: DateRange;
    slaStatus?: SLAStatus;
    limit?: number;
  }): Promise<SLAPickingReport[]> {
    let sql = `
      SELECT 
        order_id as "orderId",
        external_order_id as "externalOrderId",
        customer_id as "customerId",
        order_created_at as "orderCreatedAt",
        picking_started_at as "pickingStartedAt",
        picking_completed_at as "pickingCompletedAt",
        picking_duration_minutes as "pickingDurationMinutes",
        wait_time_minutes as "waitTimeMinutes",
        sla_status as "slaStatus",
        total_items as "totalItems",
        total_units as "totalUnits"
      FROM report_sla_picking_time
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.orderId) {
      sql += ` AND order_id = $${paramIndex++}`;
      params.push(options.orderId);
    }

    if (options?.dateRange) {
      sql += ` AND order_created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(options.dateRange.startDate, options.dateRange.endDate);
    }

    if (options?.slaStatus) {
      sql += ` AND sla_status = $${paramIndex++}`;
      params.push(options.slaStatus);
    }

    sql += ` ORDER BY picking_completed_at DESC`;

    if (options?.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    const result = await this.db.query<SLAPickingReport>(sql, params);
    return result.rows;
  }

  /**
   * Relatório SLA end-to-end (criação até despacho)
   */
  async getSLAEndToEnd(options?: {
    dateRange?: DateRange;
    slaStatus?: SLAStatus;
    customerId?: string;
    limit?: number;
  }): Promise<SLAEndToEndReport[]> {
    let sql = `
      SELECT 
        order_id as "orderId",
        external_order_id as "externalOrderId",
        customer_id as "customerId",
        order_created_at as "orderCreatedAt",
        dispatched_at as "dispatchedAt",
        total_duration_hours as "totalDurationHours",
        sla_status as "slaStatus",
        picking_started as "pickingStarted",
        picking_completed as "pickingCompleted",
        checked,
        quote_requested as "quoteRequested",
        ready_for_pickup as "readyForPickup",
        total_items as "totalItems",
        total_units as "totalUnits"
      FROM report_sla_end_to_end
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.dateRange) {
      sql += ` AND order_created_at BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(options.dateRange.startDate, options.dateRange.endDate);
    }

    if (options?.slaStatus) {
      sql += ` AND sla_status = $${paramIndex++}`;
      params.push(options.slaStatus);
    }

    if (options?.customerId) {
      sql += ` AND customer_id = $${paramIndex++}`;
      params.push(options.customerId);
    }

    sql += ` ORDER BY dispatched_at DESC`;

    if (options?.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    const result = await this.db.query<SLAEndToEndReport>(sql, params);
    return result.rows;
  }

  /**
   * Pedidos em risco de estouro de SLA
   */
  async getOrdersAtRisk(options?: {
    minRiskLevel?: RiskLevel;
  }): Promise<OrderAtRisk[]> {
    let sql = `
      SELECT 
        order_id as "orderId",
        external_order_id as "externalOrderId",
        customer_id as "customerId",
        status,
        created_at as "createdAt",
        hours_since_created as "hoursSinceCreated",
        sla_hours as "slaHours",
        sla_consumed_percentage as "slaConsumedPercentage",
        risk_level as "riskLevel",
        total_items as "totalItems"
      FROM report_orders_at_risk
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.minRiskLevel) {
      const riskOrder = { BAIXO: 1, MÉDIO: 2, ALTO: 3, CRÍTICO: 4 };
      const minOrder = riskOrder[options.minRiskLevel];
      sql += ` AND CASE risk_level
        WHEN 'BAIXO' THEN 1
        WHEN 'MÉDIO' THEN 2
        WHEN 'ALTO' THEN 3
        WHEN 'CRÍTICO' THEN 4
      END >= $${paramIndex++}`;
      params.push(minOrder);
    }

    sql += ` ORDER BY sla_consumed_percentage DESC`;

    const result = await this.db.query<OrderAtRisk>(sql, params);
    return result.rows;
  }

  /**
   * Resumo de SLA por período
   */
  async getSLASummary(
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<SLASummary[]> {
    const sql = `
      SELECT 
        period,
        total_orders as "totalOrders",
        within_sla as "withinSla",
        within_sla_percentage as "withinSlaPercentage",
        alert_sla as "alertSla",
        alert_sla_percentage as "alertSlaPercentage",
        outside_sla as "outsideSla",
        outside_sla_percentage as "outsideSlaPercentage",
        avg_duration_hours as "avgDurationHours",
        min_duration_hours as "minDurationHours",
        max_duration_hours as "maxDurationHours"
      FROM report_sla_summary($1::timestamptz, $2::timestamptz, $3)
    `;

    const result = await this.db.query<SLASummary>(sql, [
      dateRange.startDate,
      dateRange.endDate,
      groupBy,
    ]);
    return result.rows;
  }

  // ==========================================================================
  // RELATÓRIOS DE PRODUTIVIDADE
  // ==========================================================================

  /**
   * Produtividade individual dos separadores
   */
  async getPickerProductivity(options?: {
    pickerId?: string;
    dateRange?: DateRange;
    minUnitsPerHour?: number;
  }): Promise<PickerProductivity[]> {
    let sql = `
      SELECT 
        picker_id as "pickerId",
        work_date as "workDate",
        tasks_completed as "tasksCompleted",
        orders_completed as "ordersCompleted",
        total_units_picked as "totalUnitsPicked",
        unique_skus as "uniqueSkus",
        total_hours as "totalHours",
        units_per_hour as "unitsPerHour",
        avg_minutes_per_task as "avgMinutesPerTask",
        avg_minutes_per_order as "avgMinutesPerOrder",
        accuracy_percentage as "accuracyPercentage"
      FROM report_picker_productivity
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.pickerId) {
      sql += ` AND picker_id = $${paramIndex++}`;
      params.push(options.pickerId);
    }

    if (options?.dateRange) {
      sql += ` AND work_date BETWEEN $${paramIndex++}::date AND $${paramIndex++}::date`;
      params.push(options.dateRange.startDate, options.dateRange.endDate);
    }

    if (options?.minUnitsPerHour) {
      sql += ` AND units_per_hour >= $${paramIndex++}`;
      params.push(options.minUnitsPerHour);
    }

    sql += ` ORDER BY work_date DESC, units_per_hour DESC`;

    const result = await this.db.query<PickerProductivity>(sql, params);
    return result.rows;
  }

  /**
   * Ranking de performance dos separadores
   */
  async getPickerRanking(dateRange: DateRange): Promise<PickerRanking[]> {
    const sql = `
      SELECT 
        ranking,
        picker_id as "pickerId",
        total_orders as "totalOrders",
        total_units as "totalUnits",
        total_hours as "totalHours",
        units_per_hour as "unitsPerHour",
        avg_accuracy as "avgAccuracy",
        performance_score as "performanceScore"
      FROM report_picker_ranking($1::timestamptz, $2::timestamptz)
    `;

    const result = await this.db.query<PickerRanking>(sql, [
      dateRange.startDate,
      dateRange.endDate,
    ]);
    return result.rows;
  }

  // ==========================================================================
  // RELATÓRIOS DE DIVERGÊNCIAS
  // ==========================================================================

  /**
   * Divergências de contagem (scan vs esperado)
   */
  async getScanDivergences(options?: {
    minSeverity?: Severity;
    dateRange?: DateRange;
    sku?: string;
    operatorId?: string;
  }): Promise<ScanDivergence[]> {
    let sql = `
      SELECT 
        task_id as "taskId",
        order_id as "orderId",
        external_order_id as "externalOrderId",
        task_type as "taskType",
        operator_id as "operatorId",
        sku,
        expected_quantity as "expectedQuantity",
        scanned_quantity as "scannedQuantity",
        divergence,
        divergence_type as "divergenceType",
        divergence_percentage as "divergencePercentage",
        severity,
        occurred_at as "occurredAt",
        total_scans as "totalScans"
      FROM report_scan_divergences
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.minSeverity) {
      const severityOrder = { NENHUMA: 1, MÉDIA: 2, ALTA: 3, CRÍTICA: 4 };
      const minOrder = severityOrder[options.minSeverity];
      sql += ` AND CASE severity
        WHEN 'NENHUMA' THEN 1
        WHEN 'MÉDIA' THEN 2
        WHEN 'ALTA' THEN 3
        WHEN 'CRÍTICA' THEN 4
      END >= $${paramIndex++}`;
      params.push(minOrder);
    }

    if (options?.dateRange) {
      sql += ` AND occurred_at BETWEEN $${paramIndex++}::timestamptz AND $${paramIndex++}::timestamptz`;
      params.push(options.dateRange.startDate, options.dateRange.endDate);
    }

    if (options?.sku) {
      sql += ` AND sku = $${paramIndex++}`;
      params.push(options.sku);
    }

    if (options?.operatorId) {
      sql += ` AND operator_id = $${paramIndex++}`;
      params.push(options.operatorId);
    }

    sql += ` ORDER BY divergence_percentage DESC, occurred_at DESC`;

    const result = await this.db.query<ScanDivergence>(sql, params);
    return result.rows;
  }

  /**
   * Análise de divergências por SKU
   */
  async getDivergenceBySKU(options?: {
    minDivergenceRate?: number;
    minTasks?: number;
  }): Promise<DivergenceBySKU[]> {
    let sql = `
      SELECT 
        sku,
        total_tasks as "totalTasks",
        total_expected as "totalExpected",
        total_scanned as "totalScanned",
        total_divergence as "totalDivergence",
        tasks_with_divergence as "tasksWithDivergence",
        divergence_rate as "divergenceRate",
        excess_count as "excessCount",
        shortage_count as "shortageCount",
        avg_divergence as "avgDivergence",
        last_divergence_date as "lastDivergenceDate"
      FROM report_divergence_by_sku
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.minDivergenceRate) {
      sql += ` AND divergence_rate >= $${paramIndex++}`;
      params.push(options.minDivergenceRate);
    }

    if (options?.minTasks) {
      sql += ` AND total_tasks >= $${paramIndex++}`;
      params.push(options.minTasks);
    }

    sql += ` ORDER BY divergence_rate DESC`;

    const result = await this.db.query<DivergenceBySKU>(sql, params);
    return result.rows;
  }

  /**
   * KPI de acurácia operacional
   */
  async getAccuracyKPI(dateRange: DateRange): Promise<AccuracyKPI> {
    const sql = `
      SELECT 
        period,
        total_tasks as "totalTasks",
        perfect_tasks as "perfectTasks",
        tasks_with_minor_divergence as "tasksWithMinorDivergence",
        tasks_with_major_divergence as "tasksWithMajorDivergence",
        overall_accuracy as "overallAccuracy",
        perfect_rate as "perfectRate",
        minor_divergence_rate as "minorDivergenceRate",
        major_divergence_rate as "majorDivergenceRate"
      FROM report_accuracy_kpi($1::timestamptz, $2::timestamptz)
    `;

    const result = await this.db.query<AccuracyKPI>(sql, [
      dateRange.startDate,
      dateRange.endDate,
    ]);
    const row = result.rows[0];
    if (!row) {
      throw new Error("Sem dados para KPI de acurácia no período informado.");
    }
    return row;
  }
}

// ============================================================================
// EXEMPLO DE USO
// ============================================================================

/*
// Configurar o serviço
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const reportService = new ReportService(pool);

// Usar os relatórios
async function exemplo() {
  // Pedidos em risco crítico
  const atRisk = await reportService.getOrdersAtRisk({
    minRiskLevel: 'ALTO'
  });
  console.log('Pedidos em risco:', atRisk);

  // Performance da última semana
  const productivity = await reportService.getPickerProductivity({
    dateRange: {
      startDate: '2026-01-27T00:00:00Z',
      endDate: '2026-02-03T23:59:59Z'
    },
    minUnitsPerHour: 50
  });
  console.log('Produtividade:', productivity);

  // KPI de acurácia do mês
  const accuracy = await reportService.getAccuracyKPI({
    startDate: '2026-02-01T00:00:00Z',
    endDate: '2026-02-28T23:59:59Z'
  });
  console.log('Acurácia:', accuracy);
}
*/
