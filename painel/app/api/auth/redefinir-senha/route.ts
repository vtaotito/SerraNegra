import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findUserById,
  findValidPasswordResetToken,
  consumePasswordResetToken,
  hashPassword,
  updatePassword,
  logActivity,
} from "@/lib/auth";

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
  .regex(/[a-z]/, "Deve conter ao menos uma letra minúscula")
  .regex(/[0-9]/, "Deve conter ao menos um número");

const resetSchema = z.object({
  token: z.string().min(16, "Token inválido"),
  password: passwordSchema,
});

const tokenOnlySchema = z.object({
  token: z.string().min(16, "Token inválido"),
});

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${user.length > 2 ? "***" : ""}@${domain}`;
}

/**
 * GET /api/auth/redefinir-senha?token=...
 * Valida o token sem consumi-lo. Retorna { valid: boolean, maskedEmail? }.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const parsed = tokenOnlySchema.safeParse({ token });
  if (!parsed.success) {
    return NextResponse.json({ valid: false, error: "Token inválido" }, { status: 400 });
  }

  const found = await findValidPasswordResetToken(parsed.data.token);
  if (!found) {
    return NextResponse.json(
      { valid: false, error: "Link expirado ou inválido" },
      { status: 404 }
    );
  }

  const user = await findUserById(found.userId);
  if (!user || !user.isActive) {
    return NextResponse.json(
      { valid: false, error: "Conta indisponível" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    valid: true,
    maskedEmail: maskEmail(user.email),
    expiresAt: found.expiresAt,
  });
}

/**
 * POST /api/auth/redefinir-senha
 * body: { token, password }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const { token, password } = parsed.data;

    const found = await findValidPasswordResetToken(token);
    if (!found) {
      return NextResponse.json(
        { success: false, error: "Link expirado ou inválido. Solicite um novo." },
        { status: 400 }
      );
    }

    const user = await findUserById(found.userId);
    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "Conta indisponível. Contate o administrador." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    await updatePassword(user.id, passwordHash);
    await consumePasswordResetToken(found.id, user.id, ip);

    await logActivity(
      user.id,
      "PASSWORD_RESET_COMPLETED",
      { email: user.email },
      ip
    );

    return NextResponse.json({
      success: true,
      message: "Senha redefinida com sucesso. Você já pode entrar com a nova senha.",
    });
  } catch (error) {
    console.error("[RESET_PASSWORD]", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
