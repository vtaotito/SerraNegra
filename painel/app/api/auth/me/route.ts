import { NextResponse } from "next/server";
import { getSessionFromCookie, findUserById } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionFromCookie();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const user = await findUserById(session.sub);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "Usuário não encontrado ou desativado" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("[ME]", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
