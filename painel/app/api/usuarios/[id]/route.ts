import { NextRequest, NextResponse } from "next/server";
import {
  requireRole,
  requireAuth,
  findUserById,
  updateUser,
  deleteUser,
  hashPassword,
  updatePassword,
  logActivity,
} from "@/lib/auth";
import { z } from "zod";
import type { UserRole, PanelModule } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  displayName: z.string().min(2).max(200).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "supervisor", "operador", "comercial", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  allowedModules: z.array(z.enum(["wms", "cockpit", "b2b"])).min(1).optional(),
  password: z.string().min(8).optional(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("admin", "supervisor");
    const { id } = await params;
    const user = await findUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const isSelfUpdate = session.sub === id;
    const isAdmin = session.role === "admin";

    if (!isSelfUpdate && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para editar este usuário" },
        { status: 403 }
      );
    }

    const { password, ...updateData } = parsed.data;

    if (!isAdmin) {
      delete updateData.role;
      delete updateData.isActive;
      delete updateData.allowedModules;
    }

    if (password) {
      const newHash = await hashPassword(password);
      await updatePassword(id, newHash);
    }

    const user = await updateUser(id, {
      ...updateData,
      role: updateData.role as UserRole | undefined,
      allowedModules: updateData.allowedModules as PanelModule[] | undefined,
      updatedBy: session.sub,
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    await logActivity(session.sub, "USER_UPDATED", {
      targetUser: id,
      changes: Object.keys(parsed.data),
    });

    return NextResponse.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("admin");
    const { id } = await params;

    if (session.sub === id) {
      return NextResponse.json(
        { success: false, error: "Não é possível excluir a própria conta" },
        { status: 400 }
      );
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    await logActivity(session.sub, "USER_DELETED", { targetUser: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED")
        return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ success: false, error: "Sem permissão" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}
