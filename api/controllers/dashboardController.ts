import { WmsError } from "../../wms-core/src/errors.js";
import {
  DashboardMetricsResponse,
  DashboardOrderQuery,
  DashboardOrderSummary,
  DashboardTaskQuery,
  DashboardTaskSummary
} from "../dtos/dashboard.js";
import { ApiHandler } from "../http.js";
import { optionalNumber, optionalString } from "../utils/validation.js";

export type DashboardService = {
  listOrders: (query: DashboardOrderQuery) => Promise<{ data: DashboardOrderSummary[]; nextCursor?: string }>;
  listTasks: (query: DashboardTaskQuery) => Promise<{ data: DashboardTaskSummary[]; nextCursor?: string }>;
  getMetrics: () => Promise<DashboardMetricsResponse>;
};

export const createDashboardController = (service: DashboardService): {
  listOrders: ApiHandler;
  listTasks: ApiHandler;
  getMetrics: ApiHandler;
} => {
  const listOrders: ApiHandler = async (req) => {
    if (!req.query) {
      throw new WmsError("WMS-VAL-001", "Parametros de consulta ausentes.");
    }
    const query: DashboardOrderQuery = {
      status: req.query.status as DashboardOrderQuery["status"],
      customerId: optionalString(req.query.customerId),
      from: optionalString(req.query.from),
      to: optionalString(req.query.to),
      limit: optionalNumber(req.query.limit),
      cursor: optionalString(req.query.cursor)
    };
    const result = await service.listOrders(query);
    return {
      status: 200,
      body: result
    };
  };

  const listTasks: ApiHandler = async (req) => {
    if (!req.query) {
      throw new WmsError("WMS-VAL-001", "Parametros de consulta ausentes.");
    }
    const query: DashboardTaskQuery = {
      status: req.query.status as DashboardTaskQuery["status"],
      type: req.query.type as DashboardTaskQuery["type"],
      assignedTo: optionalString(req.query.assignedTo),
      limit: optionalNumber(req.query.limit),
      cursor: optionalString(req.query.cursor)
    };
    const result = await service.listTasks(query);
    return {
      status: 200,
      body: result
    };
  };

  const getMetrics: ApiHandler = async () => {
    const result = await service.getMetrics();
    return {
      status: 200,
      body: result
    };
  };

  return { listOrders, listTasks, getMetrics };
};
