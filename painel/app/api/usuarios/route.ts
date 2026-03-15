import { NextRequest, NextResponse } from "next/server";
import {
  requireRole,
  getAllUsers,
  createUser,
  hashPassword,
  findUserByUsername,
  findUserByEmail,
  logActivity,
} from "@/lib/auth";
import { z } from "zod";
import type { UserRole, PanelModule } from "@/lib/types";

const createUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(200),
  role: z.enum(["admin", "supervisor", "operador", "comercial", "viewer"]),
  allowedModules: z.array(z.enum(["wms", "cockpit", "b2b"])).min(1),
});

export async function GET() {
  try {
    await requireRole("admin", "supervisor");
    const users = await getAllUsers();
    return NextResponse.json({ success: true, data: { users } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[USERS GET]", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("admin");
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const { username, email, password, displayName, role, allowedModules } = parsed.data;

    if (await findUserByUsername(username)) {
      return NextResponse.json(
        { success: false, error: "Usuário já existe" },
        { status: 409 }
      );
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Email já cadastrado" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      username,
      email,
      passwordHash,
      displayName,
      role: role as UserRole,
      allowedModules: allowedModules as PanelModule[],
      createdBy: session.sub,
    });

    await logActivity(session.sub, "USER_CREATED", {
      targetUser: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({ success: true, data: { user } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    console.error("[USERS POST]", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}
