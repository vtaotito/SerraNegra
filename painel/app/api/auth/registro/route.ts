import { NextRequest, NextResponse } from "next/server";
import {
  findUserByUsername,
  findUserByEmail,
  createUser,
  hashPassword,
  logActivity,
} from "@/lib/auth";
import { z } from "zod";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9._-]+$/, "Apenas letras, números, ponto, hífen e underscore"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
    .regex(/[a-z]/, "Deve conter ao menos uma letra minúscula")
    .regex(/[0-9]/, "Deve conter ao menos um número"),
  displayName: z.string().min(2, "Mínimo 2 caracteres").max(200),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const { username, email, password, displayName } = parsed.data;

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Nome de usuário já está em uso" },
        { status: 409 }
      );
    }

    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: "Email já está cadastrado" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await createUser({
      username,
      email,
      passwordHash,
      displayName,
      role: "viewer",
      allowedModules: ["wms", "cockpit", "b2b"],
    });

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    await logActivity(user.id, "USER_REGISTERED", { username, email }, ip);

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Cadastro realizado com sucesso. Faça login para continuar.",
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER]", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
