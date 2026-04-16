"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "./session";

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Preencha usuário e senha" };
  }

  const result = await createSession(username, password);
  if (!result.success) {
    return { error: result.error ?? "Erro ao fazer login" };
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
