"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const GSN_LOGO = "https://garrafariaserranegra.com.br/wp-content/uploads/2021/03/cropped-gsn-logo2021.png";

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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gsn-950 via-gsn-900 to-gsn-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(170,26,27,0.25),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(160,120,40,0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-sm mb-8 ring-1 ring-white/10 shadow-2xl">
            <Image src={GSN_LOGO} alt="Garrafaria Serra Negra" width={64} height={64} className="object-contain" unoptimized />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Garrafaria Serra Negra
          </h1>
          <p className="text-lg text-gsn-200/80 max-w-md mx-auto">
            Painel integrado de gestão — WMS, Cockpit BI e Portal B2B
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-sm mx-auto">
            <div className="text-center p-4 rounded-xl bg-white/5 ring-1 ring-white/10">
              <div className="text-2xl font-bold text-white">WMS</div>
              <div className="text-xs text-gsn-300/60 mt-1">Logística</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5 ring-1 ring-white/10">
              <div className="text-2xl font-bold text-white">BI</div>
              <div className="text-xs text-gsn-300/60 mt-1">Cockpit</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5 ring-1 ring-white/10">
              <div className="text-2xl font-bold text-white">B2B</div>
              <div className="text-xs text-gsn-300/60 mt-1">Portal</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gsn-700 mb-4 shadow-lg">
              <Image src={GSN_LOGO} alt="GSN" width={40} height={40} className="object-contain" unoptimized />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Garrafaria Serra Negra</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {mode === "login"
                ? "Acesse o painel administrativo"
                : "Preencha os dados para se cadastrar"}
            </p>

            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nome completo
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    required
                    value={form.displayName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none transition"
                    placeholder="Ex: Vitor Tito"
                  />
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none transition"
                  placeholder="seu.usuario"
                />
              </div>

              {mode === "register" && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none transition"
                    placeholder="email@exemplo.com"
                  />
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none transition"
                    placeholder={mode === "register" ? "Mín. 8 caracteres, maiúscula e número" : "••••••••"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shadow-gsn-700/25"
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
                className="text-sm text-gray-500 hover:text-gsn-700 transition"
              >
                {mode === "login"
                  ? "Não tem conta? Cadastre-se"
                  : "Já tem conta? Faça login"}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            painel.garrafariaserranegra.com.br
          </p>
        </div>
      </div>
    </div>
  );
}
