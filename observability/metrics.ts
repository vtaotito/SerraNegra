import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { metrics, type Counter, type Histogram, type Meter } from "@opentelemetry/api";

export type ObservabilityMeter = {
  meter: Meter;
  apiRequestDurationMs: Histogram;
  apiRequestsTotal: Counter;
  scanEventsTotal: Counter;
  sapRequestDurationMs: Histogram;
  sapRequestsTotal: Counter;
};

let provider: MeterProvider | null = null;
let promExporter: PrometheusExporter | null = null;
let obs: ObservabilityMeter | null = null;

export type MetricsOptions = {
  prometheusPort?: number;
  prometheusEndpoint?: string; // default /metrics
};

export function initMetrics(opts: MetricsOptions = {}): void {
  if (provider) return;

  // Prometheus exporter (pull) para ambientes simples/local.
  promExporter = new PrometheusExporter(
    {
      port: opts.prometheusPort ?? Number(process.env.METRICS_PORT ?? 9464),
      endpoint: opts.prometheusEndpoint ?? "/metrics"
    },
    () => {
      // callback opcional quando o endpoint fica pronto (silencioso por padrão)
    }
  );

  provider = new MeterProvider({ readers: [promExporter] });
  metrics.setGlobalMeterProvider(provider);

  // Se o usuário quiser OTLP metrics no futuro, dá pra adicionar um reader/exporter adicional aqui.
}

export function getMeter(): ObservabilityMeter {
  if (obs) return obs;

  if (!provider) {
    // Inicializa preguiçosamente para não exigir bootstrap explícito.
    initMetrics();
  }

  const meter = metrics.getMeter("wms");

  const apiRequestsTotal = meter.createCounter("wms_api_requests_total", {
    description: "Total de requests na API (custom)."
  });
  const apiRequestDurationMs = meter.createHistogram("wms_api_request_duration_ms", {
    description: "Duração do request da API em ms."
  });

  const scanEventsTotal = meter.createCounter("wms_scan_events_total", {
    description: "Total de eventos de scan registrados."
  });

  const sapRequestsTotal = meter.createCounter("wms_sap_requests_total", {
    description: "Total de requests ao SAP Service Layer."
  });
  const sapRequestDurationMs = meter.createHistogram("wms_sap_request_duration_ms", {
    description: "Duração de requests ao SAP Service Layer em ms."
  });

  obs = {
    meter,
    apiRequestDurationMs,
    apiRequestsTotal,
    scanEventsTotal,
    sapRequestDurationMs,
    sapRequestsTotal
  };

  return obs;
}

