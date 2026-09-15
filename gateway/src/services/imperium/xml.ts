export function escapeXml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlString(name: string, value: string | number | boolean | null | undefined, nil = false): string {
  if ((value === null || value === undefined || value === "") && nil) {
    return `<${name} xsi:nil="true"/>`;
  }
  return `<${name} xsi:type="xsd:string">${escapeXml(value ?? "")}</${name}>`;
}

export function xmlInt(name: string, value: number | string | null | undefined, nil = false): string {
  if (value === null || value === undefined || value === "") {
    return nil ? `<${name} xsi:nil="true"/>` : `<${name} xsi:type="xsd:int">0</${name}>`;
  }
  return `<${name} xsi:type="xsd:int">${escapeXml(String(Math.trunc(Number(value))))}</${name}>`;
}

export function xmlFloat(name: string, value: number | string | null | undefined, nil = false): string {
  if (value === null || value === undefined || value === "") {
    return nil ? `<${name} xsi:nil="true"/>` : `<${name} xsi:type="xsd:float">0</${name}>`;
  }
  return `<${name} xsi:type="xsd:float">${escapeXml(String(value))}</${name}>`;
}

export function formatBrMoney(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function formatBrDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function buildSoapEnvelope(namespace: string, nsPrefix: string, method: string, inner: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:${nsPrefix}="${escapeXml(namespace)}">`,
    `   <soapenv:Header/>`,
    `   <soapenv:Body>`,
    `      <${nsPrefix}:${method} soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">`,
    inner,
    `      </${nsPrefix}:${method}>`,
    `   </soapenv:Body>`,
    `</soapenv:Envelope>`,
  ].join("\n");
}

export function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(re);
  return match ? decodeXml(match[1].trim()) : null;
}

export function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    out.push(decodeXml(match[1].trim()));
  }
  return out;
}

export function extractSoapFault(xml: string): string | null {
  return extractTag(xml, "faultstring") ?? extractTag(xml, "faultcode");
}

export function parseSoapBoolean(xml: string): boolean | null {
  const raw = extractTag(xml, "return");
  if (raw == null) return null;
  const normalized = raw.toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
