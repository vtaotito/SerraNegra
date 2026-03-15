import { NextRequest, NextResponse } from "next/server";
import {
  findUserByUsername,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  updateLoginSuccess,
  incrementFailedLogin,
  logActivity,
} from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const user = await findUserByUsername(username);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuário ou senha inválidos" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Conta desativada. Contate o administrador." },
        { status: 403 }
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      await incrementFailedLogin(user.id);
      await logActivity(user.id, "LOGIN_FAILED", { username, reason: "invalid_password" }, ip);
      return NextResponse.json(
        { success: false, error: "Usuário ou senha inválidos" },
        { status: 401 }
      );
    }

    await updateLoginSuccess(user.id, ip);

    const token = await createSessionToken(user);
    await setSessionCookie(token);

    await logActivity(user.id, "LOGIN_SUCCESS", { username }, ip);

    const { passwordHash: _, ...safeUser } = user;

    return NextResponse.json({
      success: true,
      data: { user: safeUser },
    });
  } catch (error) {
    console.error("[LOGIN]", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
