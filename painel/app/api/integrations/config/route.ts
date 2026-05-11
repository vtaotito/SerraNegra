import { NextRequest, NextResponse } from "next/server";
import { requireRole, logActivity } from "@/lib/auth";
import {
  setSettings,
  getSettings,
  getSettingSources,
  maskSecret,
  type SetSettingInput,
} from "@/lib/settings";
import {
  invalidateMailerCache,
  SMTP_KEYS,
  SMTP_SECRET_KEYS,
  type SmtpKey,
} from "@/lib/mailer";
import {
  invalidateRdCache,
  RD_CRM_KEYS,
  RD_MARKETING_KEYS,
  RD_SECRET_KEYS,
} from "@/lib/rd-station-server";

type Group = "smtp" | "rd-crm" | "rd-marketing";

const GROUP_KEYS: Record<Group, readonly string[]> = {
  smtp: SMTP_KEYS,
  "rd-crm": RD_CRM_KEYS,
  "rd-marketing": RD_MARKETING_KEYS,
};

const SECRET_BY_KEY: Record<string, boolean> = {};
for (const k of SMTP_SECRET_KEYS) SECRET_BY_KEY[k] = true;
for (const k of RD_SECRET_KEYS) SECRET_BY_KEY[k] = true;

function isGroup(g: string | null): g is Group {
  return g === "smtp" || g === "rd-crm" || g === "rd-marketing";
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * GET /api/integrations/config?group=smtp|rd-crm|rd-marketing
 *
 * Retorna o snapshot da config: valores não-secretos em claro,
 * secrets apenas com `hasValue` + `preview` mascarado, nunca o valor real.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("admin", "supervisor");
  } catch (err) {
    const code = err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      { success: false, error: code === 403 ? "Sem permissão" : "Não autenticado" },
      { status: code },
    );
  }

  const groupParam = request.nextUrl.searchParams.get("group");
  if (!isGroup(groupParam)) {
    return NextResponse.json(
      { success: false, error: "Parâmetro group inválido (smtp | rd-crm | rd-marketing)" },
      { status: 400 },
    );
  }

  const keys = GROUP_KEYS[groupParam] as readonly string[];
  const [values, sources] = await Promise.all([
    getSettings([...keys]),
    getSettingSources([...keys]),
  ]);

  const fields = keys.map((k) => {
    const isSecret = Boolean(SECRET_BY_KEY[k]);
    const v = values[k] ?? null;
    return {
      key: k,
      isSecret,
      hasValue: Boolean(v),
      value: isSecret ? null : v,
      preview: isSecret ? maskSecret(v) : null,
      source: sources[k] ?? "none",
    };
  });

  return NextResponse.json({ success: true, data: { group: groupParam, fields } });
}

/**
 * PUT /api/integrations/config?group=...
 * Body: { values: Record<key, string|null> }
 *
 * Convenção:
 *   - string vazia "" => apaga (volta para fallback de env)
 *   - null            => mantém o valor atual (usado pra secrets quando o
 *                        usuário não digitou nada)
 *   - string não-vazia => grava (cifrado se isSecret=true)
 */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await requireRole("admin", "supervisor");
  } catch (err) {
    const code = err instanceof Error && err.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      { success: false, error: code === 403 ? "Sem permissão" : "Não autenticado" },
      { status: code },
    );
  }

  const groupParam = request.nextUrl.searchParams.get("group");
  if (!isGroup(groupParam)) {
    return NextResponse.json(
      { success: false, error: "Parâmetro group inválido (smtp | rd-crm | rd-marketing)" },
      { status: 400 },
    );
  }

  let body: { values?: Record<string, string | null> };
  try {
    body = (await request.json()) as { values?: Record<string, string | null> };
  } catch {
    return NextResponse.json(
      { success: false, error: "Corpo inválido (JSON)" },
      { status: 400 },
    );
  }

  const allowedKeys = new Set(GROUP_KEYS[groupParam]);
  const incoming = body.values ?? {};

  // Validações por grupo
  if (groupParam === "smtp") {
    const port = incoming.SMTP_PORT;
    if (typeof port === "string" && port.length > 0) {
      const n = Number(port);
      if (!Number.isFinite(n) || n <= 0 || n > 65535) {
        return NextResponse.json(
          { success: false, error: "SMTP_PORT inválida (1–65535)." },
          { status: 400 },
        );
      }
    }
    const host = incoming.SMTP_HOST;
    if (typeof host === "string" && host.length > 0 && /\s/.test(host)) {
      return NextResponse.json(
        { success: false, error: "SMTP_HOST não pode ter espaços." },
        { status: 400 },
      );
    }
  }

  const inputs: SetSettingInput[] = [];
  const changedKeys: string[] = [];
  for (const [key, value] of Object.entries(incoming)) {
    if (!allowedKeys.has(key as SmtpKey)) {
      return NextResponse.json(
        { success: false, error: `Chave não permitida: ${key}` },
        { status: 400 },
      );
    }
    const isSecret = Boolean(SECRET_BY_KEY[key]);
    if (isSecret && value === null) continue; // mantém atual
    inputs.push({ key, value, isSecret, updatedBy: session.sub });
    changedKeys.push(key);
  }

  if (inputs.length === 0) {
    return NextResponse.json({
      success: true,
      data: { group: groupParam, changedKeys: [], message: "Nada a alterar." },
    });
  }

  try {
    await setSettings(inputs, { skipNullSecrets: true });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Falha ao gravar configuração";
    return NextResponse.json({ success: false, error: reason }, { status: 500 });
  }

  if (groupParam === "smtp") invalidateMailerCache();
  else invalidateRdCache();

  await logActivity(
    session.sub,
    `INTEGRATION_${groupParam.toUpperCase().replace("-", "_")}_CONFIG_SAVED`,
    { changedKeys },
    clientIp(request),
  );

  return NextResponse.json({
    success: true,
    data: { group: groupParam, changedKeys },
  });
}
