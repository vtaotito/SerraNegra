"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";
import { ROLE_LABELS, MODULE_LABELS } from "@/lib/types";
import type { PanelModule } from "@/lib/types";
import {
  UserCircle,
  Mail,
  Shield,
  Clock,
  Key,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export default function PerfilPage() {
  const { user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"info" | "password">("info");
  const [showPassword, setShowPassword] = useState(false);

  const [infoForm, setInfoForm] = useState({
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
  });

  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  if (!user) return null;

  const handleInfoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infoForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Perfil atualizado!");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (passwordForm.password.length < 8) {
      toast.error("Mínimo 8 caracteres");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordForm.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Senha alterada com sucesso!");
      setPasswordForm({ password: "", confirmPassword: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3 mb-6">
          <UserCircle className="w-6 h-6 text-slate-400" />
          Meu Perfil
        </h1>

        {/* Profile header card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-semibold text-slate-600">
              {user.displayName
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{user.displayName}</h2>
              <p className="text-sm text-slate-500">@{user.username}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  <Shield className="w-3 h-3" />
                  {ROLE_LABELS[user.role]}
                </span>
                {user.allowedModules.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 uppercase"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Mail className="w-4 h-4 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Email</p>
            <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Clock className="w-4 h-4 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Último acesso</p>
            <p className="text-sm font-medium text-slate-900">
              {user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Shield className="w-4 h-4 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Membro desde</p>
            <p className="text-sm font-medium text-slate-900">
              {new Date(user.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab("info")}
              className={`flex-1 py-3 text-sm font-medium text-center transition ${
                tab === "info"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Informações
            </button>
            <button
              onClick={() => setTab("password")}
              className={`flex-1 py-3 text-sm font-medium text-center transition ${
                tab === "password"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Alterar Senha
            </button>
          </div>

          <div className="p-6">
            {tab === "info" ? (
              <form onSubmit={handleInfoSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    required
                    value={infoForm.displayName}
                    onChange={(e) =>
                      setInfoForm((p) => ({ ...p, displayName: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={infoForm.email}
                    onChange={(e) =>
                      setInfoForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={passwordForm.password}
                      onChange={(e) =>
                        setPasswordForm((p) => ({ ...p, password: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                      placeholder="Mín. 8 caracteres, maiúscula e número"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirmar nova senha
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                    placeholder="Repita a nova senha"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  Alterar Senha
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
