/**
 * Database Configuration
 * Configuração do pool PostgreSQL
 */
import pg from "pg";
const { Pool } = pg;

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
};

/**
 * Cria pool de conexões PostgreSQL
 */
export const createDatabasePool = (config: DatabaseConfig): pg.Pool => {
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    // SSL em produção (opcional)
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  });
};

/**
 * Carrega configuração do banco a partir de variáveis de ambiente
 */
export const loadDatabaseConfig = (): DatabaseConfig => {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "5432", 10);
  const database = process.env.DB_NAME || "wms_db";
  const user = process.env.DB_USER || "wms_user";
  const password = process.env.DB_PASSWORD || "";

  if (!password && process.env.NODE_ENV === "production") {
    throw new Error("DB_PASSWORD é obrigatório em produção");
  }

  return {
    host,
    port,
    database,
    user,
    password
  };
};

/**
 * Testa conexão com o banco
 */
export const testDatabaseConnection = async (pool: pg.Pool): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✓ Conexão com PostgreSQL OK");
    return true;
  } catch (err) {
    console.error("✗ Erro ao conectar com PostgreSQL:", err);
    return false;
  }
};

/**
 * Fecha pool de conexões
 */
export const closeDatabasePool = async (pool: pg.Pool): Promise<void> => {
  await pool.end();
  console.log("✓ Pool PostgreSQL fechado");
};
