import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { query, queryOne } from "@/lib/db";

/**
 * Settings as a Service (painel).
 *
 * - Persiste pares chave/valor em `panel_settings` (Postgres).
 * - Secrets (passwords, tokens) são cifrados com AES-256-GCM e gravados como
 *   `enc:v1:<iv-base64>:<tag-base64>:<cipher-base64>`. Plaintext nunca
 *   trafega no banco.
 * - A chave simétrica é derivada (SHA-256) do env `PANEL_SETTINGS_KEY`. Se
 *   ausente, derivamos de `PANEL_JWT_SECRET` (já obrigatório). Em produção
 *   recomenda-se setar `PANEL_SETTINGS_KEY` com um segredo dedicado, longo
 *   e estável — trocá-lo invalida secrets já gravados.
 * - Lookup de cada chave: DB primeiro, fallback para `process.env.<KEY>`.
 *   Isso preserva 100% de compat com o setup atual (envs no .env do VPS).
 *
 * Cache em memória (TTL 30s) evita uma query a cada request.
 */

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: string | null; ts: number }>();

const ENC_PREFIX = "enc:v1:";

/* ─────────────────────── crypto helpers ─────────────────────── */

function getKey(): Buffer {
  const raw =
    process.env.PANEL_SETTINGS_KEY?.trim() ||
    process.env.PANEL_JWT_SECRET?.trim() ||
    "panel-default-dev-key-change-me";
  return createHash("sha256").update(raw).digest();
}

function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function decryptSecret(payload: string): string {
  if (!payload.startsWith(ENC_PREFIX)) return payload;
  const [, , ivB64, tagB64, encB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error("Settings: payload cifrado inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/* ─────────────────────── DB primitives ─────────────────────── */

interface SettingRow {
  key: string;
  value: string | null;
  is_secret: boolean;
  updated_at: Date;
}

async function readFromDb(key: string): Promise<string | null> {
  try {
    const row = await queryOne<SettingRow>(
      `SELECT key, value, is_secret FROM panel_settings WHERE key = $1`,
      [key],
    );
    if (!row || row.value == null || row.value === "") return null;
    return row.is_secret ? decryptSecret(row.value) : row.value;
  } catch (err) {
    // Ex.: tabela ainda não criada — degrade silencioso para env.
    console.warn(
      `[settings] Falha ao ler '${key}' do DB; caindo para env.`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/* ─────────────────────── public API ─────────────────────── */

export async function getSetting(
  key: string,
  envFallback?: string | null,
): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.value;

  let value = await readFromDb(key);
  if (value == null || value === "") {
    const env = envFallback ?? process.env[key]?.trim();
    value = env && env.length > 0 ? env : null;
  }
  cache.set(key, { value, ts: now });
  return value;
}

/**
 * Lê várias chaves em paralelo (uma única query no DB).
 * Mantém o fallback para env por chave individualmente.
 */
export async function getSettings(
  keys: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (keys.length === 0) return out;

  let dbRows: SettingRow[] = [];
  try {
    dbRows = await query<SettingRow>(
      `SELECT key, value, is_secret FROM panel_settings WHERE key = ANY($1::text[])`,
      [keys],
    );
  } catch {
    // tabela ainda não migrada — segue só com env
  }
  const dbMap = new Map<string, SettingRow>();
  for (const r of dbRows) dbMap.set(r.key, r);

  for (const k of keys) {
    const row = dbMap.get(k);
    let v: string | null = null;
    if (row && row.value != null && row.value !== "") {
      try {
        v = row.is_secret ? decryptSecret(row.value) : row.value;
      } catch {
        v = null;
      }
    }
    if (v == null || v === "") {
      const env = process.env[k]?.trim();
      v = env && env.length > 0 ? env : null;
    }
    out[k] = v;
    cache.set(k, { value: v, ts: Date.now() });
  }
  return out;
}

export interface SetSettingInput {
  key: string;
  value: string | null;
  isSecret: boolean;
  updatedBy?: string | null;
}

/**
 * Persiste uma chave. Passa `value=null` ou string vazia para apagar (volta
 * ao fallback de env). Secrets são automaticamente cifrados antes de gravar.
 */
export async function setSetting(input: SetSettingInput): Promise<void> {
  const { key, isSecret, updatedBy } = input;
  const raw = (input.value ?? "").trim();
  if (!raw) {
    await query(`DELETE FROM panel_settings WHERE key = $1`, [key]);
    cache.delete(key);
    return;
  }
  const stored = isSecret ? encryptSecret(raw) : raw;
  await query(
    `INSERT INTO panel_settings (key, value, is_secret, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value      = EXCLUDED.value,
       is_secret  = EXCLUDED.is_secret,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, stored, isSecret, updatedBy ?? null],
  );
  cache.delete(key);
}

/**
 * Atualiza várias chaves em uma transação implícita (um INSERT por chave).
 * Útil para os formulários de SMTP/RD que mandam vários campos juntos.
 *
 * Convenção para secrets: passar `value === null` significa "manter o valor
 * atual" (não sobrescrever). Passar string vazia significa "apagar".
 * Passar string não-vazia substitui.
 */
export async function setSettings(
  inputs: Array<SetSettingInput>,
  options?: { skipNullSecrets?: boolean },
): Promise<void> {
  const skip = options?.skipNullSecrets ?? true;
  for (const i of inputs) {
    if (skip && i.isSecret && i.value === null) continue;
    await setSetting(i);
  }
}

export function clearSettingsCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

/**
 * Indica de onde veio o valor atual — útil para a UI (badge "via env" vs "via DB").
 */
export async function getSettingSources(
  keys: string[],
): Promise<Record<string, "db" | "env" | "none">> {
  const out: Record<string, "db" | "env" | "none"> = {};
  let rows: SettingRow[] = [];
  try {
    rows = await query<SettingRow>(
      `SELECT key, value FROM panel_settings WHERE key = ANY($1::text[])`,
      [keys],
    );
  } catch {
    // sem tabela ainda
  }
  const dbKeys = new Set(
    rows.filter((r) => r.value != null && r.value !== "").map((r) => r.key),
  );
  for (const k of keys) {
    if (dbKeys.has(k)) out[k] = "db";
    else if (process.env[k] && process.env[k]!.trim().length > 0) out[k] = "env";
    else out[k] = "none";
  }
  return out;
}

/**
 * Mascara um secret para exibição segura (preview).
 * Ex.: "sk_live_abcdef1234567890" -> "sk_live_a***7890"
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value);
  if (v.length <= 4) return "•".repeat(v.length);
  if (v.length <= 12) return `${v.slice(0, 2)}${"•".repeat(Math.max(3, v.length - 4))}${v.slice(-2)}`;
  return `${v.slice(0, 4)}${"•".repeat(8)}${v.slice(-4)}`;
}
