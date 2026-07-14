// Serviço do Google Search Console (GSC) — ranqueamento real do site PÚBLICO.
//
// O catálogo do Portal B2B é privado (atrás de login), então NÃO se mede o
// portal: mede-se o site público (gsnonline.com.br / garrafariaserranegra.com.br)
// para o qual cada produto é mapeado por slug. As métricas por página (position,
// clicks, impressions, ctr) vêm da Search Analytics API e são persistidas em
// b2b_seo_metrics (cache + histórico) para não bater na API a cada request.
//
// Degrada graciosamente sem credenciais: isConfigured() = false e as rotas
// respondem 503 "GSC não configurado".

import pg from "pg";
import { google } from "googleapis";

const { Pool } = pg;

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export class GscNotConfiguredError extends Error {
  constructor(message = "Google Search Console não configurado. Defina GSC_SITE_URL e as credenciais da service account.") {
    super(message);
    this.name = "GscNotConfiguredError";
  }
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export type SeoMetricScope = "product" | "category";

export interface SeoMetricRow {
  scope: SeoMetricScope;
  ref_key: string;
  url: string | null;
  period_start: string;
  period_end: string;
  position: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
  fetched_at: string;
}

function loadCredentials(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/** ISO YYYY-MM-DD para `daysAgo` dias atrás (UTC). */
export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export class SearchConsoleService {
  private pool: pg.Pool;
  private siteUrl: string | null;
  private credentials: Record<string, unknown> | null;
  private keyFile: string | null;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.siteUrl = process.env.GSC_SITE_URL?.trim() || null;
    this.credentials = loadCredentials();
    this.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || null;
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_seo_metrics (
        id SERIAL PRIMARY KEY,
        scope VARCHAR(16) NOT NULL,
        ref_key VARCHAR(255) NOT NULL,
        url TEXT,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        position NUMERIC(6,2),
        clicks INTEGER NOT NULL DEFAULT 0,
        impressions INTEGER NOT NULL DEFAULT 0,
        ctr NUMERIC(6,4) NOT NULL DEFAULT 0,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (scope, ref_key, period_start, period_end)
      )
    `);
    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS idx_b2b_seo_metrics_scope_ref ON b2b_seo_metrics (scope, ref_key, fetched_at DESC)",
    );
  }

  /** True quando há site + credenciais suficientes para consultar a API. */
  isConfigured(): boolean {
    return !!this.siteUrl && (!!this.credentials || !!this.keyFile);
  }

  getSiteUrl(): string | null {
    return this.siteUrl;
  }

  private getClient() {
    if (!this.isConfigured()) throw new GscNotConfiguredError();
    const auth = new google.auth.GoogleAuth({
      scopes: [GSC_SCOPE],
      ...(this.credentials ? { credentials: this.credentials as any } : {}),
      ...(this.keyFile && !this.credentials ? { keyFile: this.keyFile } : {}),
    });
    return google.searchconsole({ version: "v1", auth });
  }

  /** Métricas por página no intervalo. Uma chamada cobre todo o site. */
  async queryPages(
    startDate: string,
    endDate: string,
    rowLimit = 25000,
  ): Promise<GscPageRow[]> {
    const client = this.getClient();
    const res = await client.searchanalytics.query({
      siteUrl: this.siteUrl as string,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit,
        dataState: "all",
      },
    });
    const rows = res.data.rows ?? [];
    return rows.map((r) => ({
      page: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));
  }

  /** Top queries de uma página específica. */
  async queryQueriesForPage(
    page: string,
    startDate: string,
    endDate: string,
    rowLimit = 10,
  ): Promise<GscQueryRow[]> {
    const client = this.getClient();
    const res = await client.searchanalytics.query({
      siteUrl: this.siteUrl as string,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit,
        dataState: "all",
        dimensionFilterGroups: [
          {
            filters: [{ dimension: "page", operator: "equals", expression: page }],
          },
        ],
      },
    });
    const rows = res.data.rows ?? [];
    return rows.map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));
  }

  // ─── Persistência (cache/histórico) ────────────────────────────────

  async saveMetric(row: Omit<SeoMetricRow, "fetched_at">): Promise<void> {
    await this.pool.query(
      `INSERT INTO b2b_seo_metrics
         (scope, ref_key, url, period_start, period_end, position, clicks, impressions, ctr, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (scope, ref_key, period_start, period_end) DO UPDATE SET
         url = EXCLUDED.url,
         position = EXCLUDED.position,
         clicks = EXCLUDED.clicks,
         impressions = EXCLUDED.impressions,
         ctr = EXCLUDED.ctr,
         fetched_at = NOW()`,
      [
        row.scope,
        row.ref_key,
        row.url,
        row.period_start,
        row.period_end,
        row.position,
        row.clicks,
        row.impressions,
        row.ctr,
      ],
    );
  }

  /** Métrica mais recente por escopo (mapa ref_key → linha). */
  async getLatestMetrics(scope: SeoMetricScope): Promise<Map<string, SeoMetricRow>> {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (ref_key) scope, ref_key, url, period_start, period_end,
              position, clicks, impressions, ctr, fetched_at
         FROM b2b_seo_metrics
        WHERE scope = $1
        ORDER BY ref_key, fetched_at DESC`,
      [scope],
    );
    const map = new Map<string, SeoMetricRow>();
    for (const r of rows) {
      map.set(r.ref_key, {
        scope: r.scope,
        ref_key: r.ref_key,
        url: r.url,
        period_start: r.period_start,
        period_end: r.period_end,
        position: r.position != null ? Number(r.position) : null,
        clicks: Number(r.clicks),
        impressions: Number(r.impressions),
        ctr: Number(r.ctr),
        fetched_at: r.fetched_at,
      });
    }
    return map;
  }

  /** Métrica mais recente de um único ref (produto/categoria). */
  async getLatestMetric(
    scope: SeoMetricScope,
    refKey: string,
  ): Promise<SeoMetricRow | null> {
    const { rows } = await this.pool.query(
      `SELECT scope, ref_key, url, period_start, period_end, position, clicks,
              impressions, ctr, fetched_at
         FROM b2b_seo_metrics
        WHERE scope = $1 AND ref_key = $2
        ORDER BY fetched_at DESC
        LIMIT 1`,
      [scope, refKey],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      scope: r.scope,
      ref_key: r.ref_key,
      url: r.url,
      period_start: r.period_start,
      period_end: r.period_end,
      position: r.position != null ? Number(r.position) : null,
      clicks: Number(r.clicks),
      impressions: Number(r.impressions),
      ctr: Number(r.ctr),
      fetched_at: r.fetched_at,
    };
  }

  /** Histórico (mais antigo → mais novo) de um ref, para mini-tendência. */
  async getMetricHistory(
    scope: SeoMetricScope,
    refKey: string,
    limit = 12,
  ): Promise<SeoMetricRow[]> {
    const { rows } = await this.pool.query(
      `SELECT scope, ref_key, url, period_start, period_end, position, clicks,
              impressions, ctr, fetched_at
         FROM b2b_seo_metrics
        WHERE scope = $1 AND ref_key = $2
        ORDER BY fetched_at DESC
        LIMIT $3`,
      [scope, refKey, limit],
    );
    return rows
      .map((r) => ({
        scope: r.scope,
        ref_key: r.ref_key,
        url: r.url,
        period_start: r.period_start,
        period_end: r.period_end,
        position: r.position != null ? Number(r.position) : null,
        clicks: Number(r.clicks),
        impressions: Number(r.impressions),
        ctr: Number(r.ctr),
        fetched_at: r.fetched_at,
      }))
      .reverse();
  }
}
