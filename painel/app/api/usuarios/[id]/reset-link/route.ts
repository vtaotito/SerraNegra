import { NextRequest, NextResponse } from "next/server";
import {
  requireRole,
  findUserById,
  createPasswordResetToken,
  logActivity,
} from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

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

/**
 * POST /api/usuarios/:id/reset-link
 * Apenas admin. Gera um token de redefinição de senha para o usuário-alvo
 * e retorna o link diretamente (não dispara e-mail). Útil para o admin
 * compartilhar o link manualmente com o usuário.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin");
    const { id } = await params;

    const target = await findUserById(id);
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Usuário não encontrado" },
        { status: 404 }
      );
    }
    if (!target.isActive) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Usuário inativo. Reative-o antes de gerar o link de redefinição.",
        },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const { token, expiresAt } = await createPasswordResetToken(target.id, ip);
    const origin = getOrigin(request);
    const resetUrl = `${origin}/redefinir-senha?token=${encodeURIComponent(
      token
    )}`;

    await logActivity(
      session.sub,
      "PASSWORD_RESET_LINK_GENERATED_BY_ADMIN",
      {
        targetUser: target.id,
        targetEmail: target.email,
        actorRole: session.role,
      },
      ip
    );

    return NextResponse.json({
      success: true,
      data: {
        resetUrl,
        expiresAt,
        target: {
          id: target.id,
          username: target.username,
          email: target.email,
          displayName: target.displayName,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return NextResponse.json(
          { success: false, error: "Não autenticado" },
          { status: 401 }
        );
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          { success: false, error: "Sem permissão" },
          { status: 403 }
        );
      }
    }
    console.error("[ADMIN_RESET_LINK]", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
