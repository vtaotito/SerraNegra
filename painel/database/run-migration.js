const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://wms:wms_prod_password_2026@31.97.174.120:5432/wms",
});

async function run() {
  console.log("Conectando ao banco de dados...");

  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log("[OK] Funcao update_updated_at_column criada");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS panel_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(200) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'viewer',
      is_active BOOLEAN NOT NULL DEFAULT true,
      avatar_url TEXT,
      allowed_modules JSONB NOT NULL DEFAULT '["wms","cockpit","b2b"]'::jsonb,
      last_login_at TIMESTAMP,
      last_login_ip VARCHAR(50),
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMP,
      password_changed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_by UUID,
      updated_by UUID
    );
  `);
  console.log("[OK] Tabela panel_users");

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_users_username ON panel_users(username)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_users_email ON panel_users(email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_users_role ON panel_users(role)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_users_is_active ON panel_users(is_active)`);
  console.log("[OK] Indices panel_users");

  try {
    await pool.query(`CREATE TRIGGER trigger_panel_users_updated_at BEFORE UPDATE ON panel_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    console.log("[OK] Trigger updated_at");
  } catch (e) {
    console.log("[SKIP] Trigger ja existe");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS panel_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("[OK] Tabela panel_sessions");

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_sessions_user_id ON panel_sessions(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_sessions_token_hash ON panel_sessions(token_hash)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_sessions_expires_at ON panel_sessions(expires_at)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS panel_activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES panel_users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("[OK] Tabela panel_activity_log");

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_activity_log_user_id ON panel_activity_log(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_activity_log_action ON panel_activity_log(action)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_activity_log_created_at ON panel_activity_log(created_at)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS panel_password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      requested_ip VARCHAR(50),
      consumed_ip VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("[OK] Tabela panel_password_reset_tokens");

  // Migra colunas existentes para TIMESTAMPTZ caso a tabela tenha sido criada
  // antes da correção de timezone (banco em UTC, driver pg-node converte Date
  // para hora local quando a coluna é TIMESTAMP sem zona).
  await pool.query(`
    ALTER TABLE panel_password_reset_tokens
      ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
      ALTER COLUMN used_at    TYPE TIMESTAMPTZ USING used_at    AT TIME ZONE 'UTC',
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'
  `);
  console.log("[OK] Colunas de panel_password_reset_tokens migradas para TIMESTAMPTZ");

  // Apaga tokens potencialmente inconsistentes gerados antes da correção.
  const cleanup = await pool.query(
    `DELETE FROM panel_password_reset_tokens
     WHERE expires_at < NOW() - INTERVAL '2 hours'
        OR (used_at IS NULL AND created_at < NOW() - INTERVAL '2 hours')
     RETURNING id`
  );
  if (cleanup.rowCount > 0) {
    console.log(`[OK] ${cleanup.rowCount} token(s) antigo(s)/inconsistente(s) removido(s)`);
  }

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_password_reset_user_id ON panel_password_reset_tokens(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_password_reset_token_hash ON panel_password_reset_tokens(token_hash)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_panel_password_reset_expires_at ON panel_password_reset_tokens(expires_at)`);

  // Seed admin user
  const bcrypt = require("bcryptjs");
  const password = "Admin@2026";
  const hash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO panel_users (username, email, password_hash, display_name, role, allowed_modules, is_active)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, true)
     ON CONFLICT (username) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role,
       allowed_modules = EXCLUDED.allowed_modules
     RETURNING id, username, role`,
    [
      "vitor.tito",
      "vtao.tito@gmail.com",
      hash,
      "Vitor Tito",
      "admin",
      JSON.stringify(["wms", "cockpit", "b2b"]),
    ]
  );

  const user = result.rows[0];
  console.log(`[OK] Admin criado: ${user.username} (${user.id})`);
  console.log(`     Senha: ${password}`);
  console.log("");
  console.log("Migration e seed completos!");

  await pool.end();
}

run().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
