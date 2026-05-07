import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findUserByEmail,
  createPasswordResetToken,
  isPasswordResetRateLimited,
  logActivity,
} from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

/**
 * Resposta genérica para evitar enumeração de e-mails: independente do e-mail
 * existir ou não, devolvemos a mesma mensagem em caso de sucesso parcial.
 */
const GENERIC_OK = {
  success: true,
  message:
    "Se o e-mail informado estiver cadastrado, enviaremos as instruções de redefinição em instantes.",
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getOrigin(request: NextRequest): string {
  const envOrigin = process.env.PANEL_PUBLIC_URL?.replace(/\/$/, "");
  if (envOrigin) return envOrigin;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const email = parsed.data.email.trim().toLowerCase();
    const user = await findUserByEmail(email);

    // Sempre logamos a tentativa, mesmo sem usuário, para auditoria.
    if (!user) {
      await logActivity(
        null,
        "PASSWORD_RESET_REQUESTED",
        { email, found: false },
        ip
      );
      return NextResponse.json(GENERIC_OK);
    }

    if (!user.isActive) {
      await logActivity(
        user.id,
        "PASSWORD_RESET_REQUESTED",
        { email, blocked: "inactive" },
        ip
      );
      return NextResponse.json(GENERIC_OK);
    }

    if (await isPasswordResetRateLimited(user.id)) {
      await logActivity(
        user.id,
        "PASSWORD_RESET_RATE_LIMITED",
        { email },
        ip
      );
      return NextResponse.json(GENERIC_OK);
    }

    const { token, expiresAt } = await createPasswordResetToken(user.id, ip);
    const origin = getOrigin(request);
    const resetUrl = `${origin}/redefinir-senha?token=${encodeURIComponent(token)}`;

    const sent = await sendPasswordResetEmail({
      to: user.email,
      displayName: user.displayName,
      resetUrl,
      expiresAt,
    });

    await logActivity(
      user.id,
      "PASSWORD_RESET_REQUESTED",
      { email, found: true, emailSent: sent },
      ip
    );

    return NextResponse.json(GENERIC_OK);
  } catch (error) {
    console.error("[FORGOT_PASSWORD]", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
