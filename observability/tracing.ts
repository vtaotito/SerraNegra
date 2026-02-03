import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { trace, context as otelContext, type Span, type SpanOptions, type Tracer } from "@opentelemetry/api";

export type TracingOptions = {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string; // ex.: http://localhost:4318
};

let sdk: NodeSDK | null = null;

export async function initTracing(opts: TracingOptions): Promise<void> {
  if (sdk) return;
  const endpoint = opts.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const exporter = new OTLPTraceExporter(endpoint ? { url: `${endpoint.replace(/\/$/, "")}/v1/traces` } : undefined);

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: opts.serviceName,
      [ATTR_SERVICE_VERSION]: opts.serviceVersion
    }),
    traceExporter: exporter
  });
  await sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  const current = sdk;
  sdk = null;
  await current.shutdown();
}

export function getTracer(name = "wms"): Tracer {
  return trace.getTracer(name);
}

export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  fn: (span: Span) => Promise<T>,
  opts?: SpanOptions
): Promise<T> {
  return await tracer.startActiveSpan(name, opts ?? {}, otelContext.active(), async (span) => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2 }); // ERROR
      span.end();
      throw err;
    }
  });
}

