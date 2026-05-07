import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "./db";
import type { PanelUser, SessionPayload, PanelModule, UserRole } from "./types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.PANEL_JWT_SECRET ?? "painel-secret-change-me-in-production"
);
const COOKIE_NAME = "painel_session";
const SESSION_DURATION_HOURS = 12;

// --- Password ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- JWT ---

export async function createSessionToken(user: PanelUser): Promise<string> {
  const payload: Omit<SessionPayload, "iat" | "exp"> = {
    sub: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    modules: user.allowedModules,
  };

  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .setIssuer("painel-garrafaria")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "painel-garrafaria",
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// --- Cookies ---

export async function setSessionCookie(token: string): Promise<void> {
  const isSecure = process.env.COOKIE_SECURE === "true";
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// --- User DB Queries ---

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  allowed_modules: PanelModule[];
  last_login_at: string | null;
  last_login_ip: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): PanelUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    avatarUrl: row.avatar_url,
    allowedModules: row.allowed_modules,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUserByUsername(
  username: string
): Promise<(PanelUser & { passwordHash: string }) | null> {
  const row = await queryOne<UserRow>(
    "SELECT * FROM panel_users WHERE username = $1",
    [username]
  );
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: row.password_hash };
}

export async function findUserByEmail(
  email: string
): Promise<PanelUser | null> {
  const row = await queryOne<UserRow>(
    "SELECT * FROM panel_users WHERE email = $1",
    [email]
  );
  if (!row) return null;
  return rowToUser(row);
}

export async function findUserById(id: string): Promise<PanelUser | null> {
  const row = await queryOne<UserRow>(
    "SELECT * FROM panel_users WHERE id = $1",
    [id]
  );
  if (!row) return null;
  return rowToUser(row);
}

export async function getAllUsers(): Promise<PanelUser[]> {
  const rows = await query<UserRow>(
    "SELECT * FROM panel_users ORDER BY created_at DESC"
  );
  return rows.map(rowToUser);
}

export async function createUser(data: {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role?: UserRole;
  allowedModules?: PanelModule[];
  createdBy?: string;
}): Promise<PanelUser> {
  const row = await queryOne<UserRow>(
    `INSERT INTO panel_users (username, email, password_hash, display_name, role, allowed_modules, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [
      data.username,
      data.email,
      data.passwordHash,
      data.displayName,
      data.role ?? "viewer",
      JSON.stringify(data.allowedModules ?? ["wms", "cockpit", "b2b"]),
      data.createdBy ?? null,
    ]
  );
  return rowToUser(row!);
}

export async function updateUser(
  id: string,
  data: {
    displayName?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
    allowedModules?: PanelModule[];
    avatarUrl?: string | null;
    updatedBy?: string;
  }
): Promise<PanelUser | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (data.displayName !== undefined) {
    setClauses.push(`display_name = $${paramIdx++}`);
    params.push(data.displayName);
  }
  if (data.email !== undefined) {
    setClauses.push(`email = $${paramIdx++}`);
    params.push(data.email);
  }
  if (data.role !== undefined) {
    setClauses.push(`role = $${paramIdx++}`);
    params.push(data.role);
  }
  if (data.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIdx++}`);
    params.push(data.isActive);
  }
  if (data.allowedModules !== undefined) {
    setClauses.push(`allowed_modules = $${paramIdx++}::jsonb`);
    params.push(JSON.stringify(data.allowedModules));
  }
  if (data.avatarUrl !== undefined) {
    setClauses.push(`avatar_url = $${paramIdx++}`);
    params.push(data.avatarUrl);
  }
  if (data.updatedBy !== undefined) {
    setClauses.push(`updated_by = $${paramIdx++}`);
    params.push(data.updatedBy);
  }

  if (setClauses.length === 0) return findUserById(id);

  params.push(id);
  const row = await queryOne<UserRow>(
    `UPDATE panel_users SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
    params
  );
  if (!row) return null;
  return rowToUser(row);
}

export async function updateLoginSuccess(
  id: string,
  ip: string
): Promise<void> {
  await query(
    `UPDATE panel_users 
     SET last_login_at = NOW(), last_login_ip = $1, failed_login_attempts = 0, locked_until = NULL 
     WHERE id = $2`,
    [ip, id]
  );
}

export async function incrementFailedLogin(id: string): Promise<number> {
  const row = await queryOne<{ failed_login_attempts: number; locked_until: string | null }>(
    `UPDATE panel_users 
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END
     WHERE id = $1
     RETURNING failed_login_attempts, locked_until`,
    [id]
  );
  return row?.failed_login_attempts ?? 0;
}

export async function updatePassword(
  id: string,
  passwordHash: string
): Promise<void> {
  await query(
    `UPDATE panel_users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2`,
    [passwordHash, id]
  );
}

export async function deleteUser(id: string): Promise<boolean> {
  const rows = await query("DELETE FROM panel_users WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}

export async function logActivity(
  userId: string | null,
  action: string,
  details?: Record<string, unknown>,
  ip?: string
): Promise<void> {
  await query(
    `INSERT INTO panel_activity_log (user_id, action, details, ip_address) VALUES ($1, $2, $3::jsonb, $4)`,
    [userId, action, details ? JSON.stringify(details) : null, ip ?? null]
  );
}

// --- Password reset tokens ---

const PASSWORD_RESET_TTL_MINUTES = 60;
const PASSWORD_RESET_REQUEST_WINDOW_MINUTES = 15;
const PASSWORD_RESET_MAX_REQUESTS_PER_USER = 5;

export interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  requested_ip: string | null;
  consumed_ip: string | null;
  created_at: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria um token de reset (32 bytes random, base64url) e persiste apenas o hash.
 * Retorna o token bruto — deve ser entregue ao usuário (ex.: por e-mail) e nunca persistido.
 */
export async function createPasswordResetToken(
  userId: string,
  ip: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000);

  await query(
    `INSERT INTO panel_password_reset_tokens (user_id, token_hash, expires_at, requested_ip)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, expiresAt, ip]
  );

  return { token, expiresAt };
}

/**
 * Valida um token bruto contra a base. Retorna o user_id se válido (não usado e não expirado).
 */
export async function findValidPasswordResetToken(
  rawToken: string
): Promise<{ id: string; userId: string; expiresAt: string } | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashToken(rawToken);
  const row = await queryOne<PasswordResetTokenRow>(
    `SELECT * FROM panel_password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  if (!row) return null;
  return { id: row.id, userId: row.user_id, expiresAt: row.expires_at };
}

/**
 * Marca o token como usado e invalida quaisquer outros tokens pendentes do mesmo usuário.
 */
export async function consumePasswordResetToken(
  tokenId: string,
  userId: string,
  ip: string | null
): Promise<void> {
  await query(
    `UPDATE panel_password_reset_tokens
     SET used_at = NOW(), consumed_ip = $1
     WHERE id = $2`,
    [ip, tokenId]
  );
  await query(
    `UPDATE panel_password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}

/**
 * Limita pedidos de reset por usuário (anti-abuso simples).
 * Retorna true se o limite foi atingido na janela recente.
 */
export async function isPasswordResetRateLimited(
  userId: string
): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM panel_password_reset_tokens
     WHERE user_id = $1 AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [userId, PASSWORD_RESET_REQUEST_WINDOW_MINUTES]
  );
  const count = Number(row?.count ?? 0);
  return count >= PASSWORD_RESET_MAX_REQUESTS_PER_USER;
}

// --- Auth Guard (server-side) ---

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSessionFromCookie();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireRole(
  ...roles: UserRole[]
): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!roles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
