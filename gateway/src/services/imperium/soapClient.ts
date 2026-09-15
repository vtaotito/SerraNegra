import { request } from "undici";
import {
  basicAuthHeader,
  loadImperiumConfig,
  soapAction,
  serviceUrl,
  wsdlUrl,
  type ImperiumService,
} from "./config.js";
import { buildSoapEnvelope, extractSoapFault, parseSoapBoolean } from "./xml.js";
import type { ImperiumSoapResult } from "./types.js";

export class ImperiumNotConfiguredError extends Error {
  constructor() {
    super("Integração Imperium não configurada (IMPERIUM_BASE_URL / USERNAME / PASSWORD)");
    this.name = "ImperiumNotConfiguredError";
  }
}

export async function callImperiumSoap(
  service: ImperiumService,
  method: string,
  innerXml: string,
): Promise<ImperiumSoapResult> {
  const cfg = loadImperiumConfig();
  if (!cfg.configured) throw new ImperiumNotConfiguredError();

  const namespace = serviceUrl(cfg.baseUrl, service);
  const url = namespace;
  const envelope = buildSoapEnvelope(namespace, "tns", method, innerXml);
  const started = Date.now();

  const res = await request(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(cfg.username, cfg.password),
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction(cfg.baseUrl, service, method),
      Accept: "text/xml, application/xml, */*",
    },
    body: envelope,
    headersTimeout: cfg.timeoutMs,
    bodyTimeout: cfg.timeoutMs,
  });

  const bodyXml = await res.body.text();
  const durationMs = Date.now() - started;
  let fault = extractSoapFault(bodyXml);
  if (fault && /wms\.local/i.test(fault)) {
    fault = `${fault} — o servidor Imperium tenta carregar o WSDL em http://wms.local (hostname interno). É preciso apontar wms.local para 127.0.0.1 no host do WMS ou publicar o WSDL no IP público.`;
  }
  const booleanReturn = parseSoapBoolean(bodyXml);

  return {
    ok: res.statusCode >= 200 && res.statusCode < 300 && !fault,
    statusCode: res.statusCode,
    method,
    service,
    durationMs,
    booleanReturn,
    fault,
    bodyXml,
  };
}

export async function probeImperiumWsdl(service: ImperiumService = "expedicao"): Promise<{
  ok: boolean;
  statusCode: number;
  durationMs: number;
  message: string;
}> {
  const cfg = loadImperiumConfig();
  if (!cfg.configured) {
    return { ok: false, statusCode: 0, durationMs: 0, message: "Não configurado" };
  }

  const started = Date.now();
  try {
    const res = await request(wsdlUrl(cfg.baseUrl, service), {
      method: "GET",
      headers: {
        Authorization: basicAuthHeader(cfg.username, cfg.password),
        Accept: "text/xml, application/xml, */*",
      },
      headersTimeout: cfg.timeoutMs,
      bodyTimeout: cfg.timeoutMs,
    });
    const text = await res.body.text();
    const durationMs = Date.now() - started;
    const looksLikeWsdl = /<definitions[\s>]/i.test(text) || /wsdl/i.test(text);
    if (res.statusCode >= 200 && res.statusCode < 300 && looksLikeWsdl) {
      return {
        ok: true,
        statusCode: res.statusCode,
        durationMs,
        message: `WSDL ${service} acessível`,
      };
    }
    return {
      ok: false,
      statusCode: res.statusCode,
      durationMs,
      message: `WSDL ${service} retornou HTTP ${res.statusCode}`,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 0,
      durationMs: Date.now() - started,
      message: err instanceof Error ? err.message : "Falha de rede",
    };
  }
}
