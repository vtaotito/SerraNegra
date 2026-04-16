"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, type AuthUser } from "./types";

const VALID_USERS: Record<string, { password: string; user: AuthUser }> = {
  [process.env.WMS_ADMIN_USER ?? "admin"]: {
    password: process.env.WMS_ADMIN_PASSWORD ?? "serra2026",
    user: { id: "admin-1", name: "Administrador", role: "ADMIN" },
  },
  [process.env.WMS_SUPERVISOR_USER ?? "supervisor"]: {
    password: process.env.WMS_SUPERVISOR_PASSWORD ?? "supervisor2026",
    user: { id: "sup-1", name: "Supervisor", role: "SUPERVISOR" },
  },
  [process.env.WMS_OPERADOR_USER ?? "operador"]: {
    password: process.env.WMS_OPERADOR_PASSWORD ?? "operador2026",
    user: { id: "op-1", name: "Operador", role: "OPERADOR" },
  },
};

function encodeSession(user: AuthUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64");
}

function decodeSession(token: string): AuthUser | null {
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function createSession(
  username: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const entry = VALID_USERS[username];
  if (!entry || entry.password !== password) {
    return { success: false, error: "Usuário ou senha inválidos" };
  }

  const token = encodeSession(entry.user);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });

  return { success: true };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}
