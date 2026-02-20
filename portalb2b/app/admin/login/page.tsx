"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/admin/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck, LogIn } from "lucide-react";
import Image from "next/image";
import { GSN_LOGO_URL } from "@/lib/product-images";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdmin, isAuthenticated } = useAdmin();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) {
    router.replace("/admin");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
      const res = await fetch(`${baseURL}/b2b/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Credenciais invalidas");
        return;
      }

      setAdmin(data.token, data.user);
      router.push("/admin");
    } catch {
      setError("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-700/50">
            <Image
              src={GSN_LOGO_URL}
              alt="Logo"
              width={60}
              height={60}
              className="rounded-full"
            />
          </div>
          <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Painel Comercial
          </CardTitle>
          <CardDescription className="text-slate-400">
            Acesso restrito a equipe comercial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Usuario
              </label>
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="admin"
                className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Senha
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
