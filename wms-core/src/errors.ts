export type WmsErrorCode =
  | "WMS-VAL-001"
  | "WMS-VAL-002"
  | "WMS-SM-001"
  | "WMS-SM-002"
  | "WMS-SM-003"
  | "WMS-AUTH-001"
  | "WMS-IDEM-001"
  | "WMS-CONC-001"
  | "WMS-DC-001"
  | "WMS-DC-002";

export class WmsError extends Error {
  readonly code: WmsErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: WmsErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "WmsError";
    this.code = code;
    this.details = details;
  }
}

export const createWmsError = (
  code: WmsErrorCode,
  message: string,
  details?: Record<string, unknown>
): WmsError => new WmsError(code, message, details);
