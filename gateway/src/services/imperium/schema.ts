import type pg from "pg";

let schemaReady = false;

export async function ensureImperiumSchema(db: pg.Pool): Promise<void> {
  if (schemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS imperium_outbox (
      id              SERIAL PRIMARY KEY,
      entity_type     TEXT NOT NULL,
      entity_id       TEXT NOT NULL,
      method          TEXT NOT NULL,
      payload_xml     TEXT,
      response_xml    TEXT,
      status          TEXT NOT NULL DEFAULT 'PENDING',
      attempts        INTEGER DEFAULT 0,
      idempotency_key TEXT UNIQUE,
      error_message   TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_imperium_outbox_status
      ON imperium_outbox (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_imperium_outbox_entity
      ON imperium_outbox (entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS imperium_cargas (
      cod_carga       TEXT PRIMARY KEY,
      doc_nums        INTEGER[] NOT NULL DEFAULT '{}',
      placa           TEXT,
      situacao        TEXT,
      liberado        BOOLEAN,
      last_polled_at  TIMESTAMPTZ,
      last_error      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS imperium_sync_state (
      key         TEXT PRIMARY KEY,
      value       TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS imperium_stock (
      cod_produto         TEXT NOT NULL,
      grade               TEXT NOT NULL DEFAULT 'UNICA',
      area_armazenagem    TEXT NOT NULL DEFAULT '',
      estoque_armazenado  NUMERIC,
      estoque_disponivel  NUMERIC,
      synced_at           TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (cod_produto, grade, area_armazenagem)
    );

    CREATE TABLE IF NOT EXISTS imperium_stock_movements (
      ponteiro          TEXT PRIMARY KEY,
      dth_movimentacao  TEXT,
      cod_produto       TEXT,
      grade             TEXT,
      motivo            TEXT,
      quantidade        NUMERIC,
      tipo              TEXT,
      id_area_origem    TEXT,
      area_origem       TEXT,
      id_area_destino   TEXT,
      area_destino      TEXT,
      synced_at         TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  schemaReady = true;
}

export function resetImperiumSchemaCache(): void {
  schemaReady = false;
}
