"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { Wine, Eye, EyeOff, LogIn, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    displayName: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      toast.success("Login realizado com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          displayName: form.displayName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao cadastrar");
      }

      toast.success("Cadastro realizado! Faça login para continuar.");
      setMode("login");
      setForm((prev) => ({ ...prev, email: "", displayName: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.1),transparent_50%)]" />
        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm mb-8">
            <Wine className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Garrafaria Serra Negra
          </h1>
          <p className="text-lg text-slate-300 max-w-md mx-auto">
            Painel integrado de gestão — WMS, Cockpit BI e Portal B2B
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-sm mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">WMS</div>
              <div className="text-xs text-slate-400 mt-1">Logística</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">BI</div>
              <div className="text-xs text-slate-400 mt-1">Cockpit</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">B2B</div>
              <div className="text-xs text-slate-400 mt-1">Portal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 mb-4">
              <Wine className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Garrafaria Serra Negra</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-1">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {mode === "login"
                ? "Acesse o painel administrativo"
                : "Preencha os dados para se cadastrar"}
            </p>

            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nome completo
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    required
                    value={form.displayName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                    placeholder="Ex: Vitor Tito"
                  />
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Usuário
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={form.username}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                  placeholder="seu.usuario"
                />
              </div>

              {mode === "register" && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                    placeholder="email@exemplo.com"
                  />
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={form.password}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition"
                    placeholder={mode === "register" ? "Mín. 8 caracteres, maiúscula e número" : "••••••••"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === "login" ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {loading
                  ? "Aguarde..."
                  : mode === "login"
                  ? "Entrar"
                  : "Cadastrar"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-sm text-slate-500 hover:text-slate-900 transition"
              >
                {mode === "login"
                  ? "Não tem conta? Cadastre-se"
                  : "Já tem conta? Faça login"}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            painel.garrafariaserranegra.com.br
          </p>
        </div>
      </div>
    </div>
  );
}
