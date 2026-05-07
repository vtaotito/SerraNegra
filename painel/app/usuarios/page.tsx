"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import type { PanelUser, UserRole, PanelModule } from "@/lib/types";
import { ROLE_LABELS, MODULE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Users,
  Plus,
  Search,
  Shield,
  Check,
  X,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Share2,
  ExternalLink,
  Mail,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function UsuariosPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PanelUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [resetTarget, setResetTarget] = useState<PanelUser | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetData, setResetData] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    displayName: "",
    role: "viewer" as UserRole,
    allowedModules: ["wms", "cockpit", "b2b"] as PanelModule[],
    isActive: true,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/usuarios");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data.users);
      }
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!user || !["admin", "supervisor"].includes(user.role)) {
    return (
      <ProtectedLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Sem permissão para acessar esta página.</p>
        </div>
      </ProtectedLayout>
    );
  }

  const isAdmin = user.role === "admin";

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreate = () => {
    setEditingUser(null);
    setForm({
      username: "",
      email: "",
      password: "",
      displayName: "",
      role: "viewer",
      allowedModules: ["wms", "cockpit", "b2b"],
      isActive: true,
    });
    setShowModal(true);
  };

  const openEdit = (u: PanelUser) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      email: u.email,
      password: "",
      displayName: u.displayName,
      role: u.role,
      allowedModules: [...u.allowedModules],
      isActive: u.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          displayName: form.displayName,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          allowedModules: form.allowedModules,
        };
        if (form.password) body.password = form.password;

        const res = await fetch(`/api/usuarios/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Usuário atualizado!");
      } else {
        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Usuário criado!");
      }
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    }
  };

  const handleDelete = async (u: PanelUser) => {
    if (!confirm(`Excluir o usuário "${u.displayName}"?`)) return;
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Usuário excluído");
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir");
    }
  };

  const toggleModule = (mod: PanelModule) => {
    setForm((prev) => ({
      ...prev,
      allowedModules: prev.allowedModules.includes(mod)
        ? prev.allowedModules.filter((m) => m !== mod)
        : [...prev.allowedModules, mod],
    }));
  };

  const openResetLink = (u: PanelUser) => {
    setResetTarget(u);
    setResetData(null);
    setCopied(false);
  };

  const closeResetLink = () => {
    setResetTarget(null);
    setResetData(null);
    setCopied(false);
  };

  const generateResetLink = async (u: PanelUser) => {
    setResetLoading(true);
    try {
      const res = await fetch(`/api/usuarios/${u.id}/reset-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Não foi possível gerar o link.");
      }
      setResetData({ url: data.data.resetUrl, expiresAt: data.data.expiresAt });
      setCopied(false);
      toast.success("Link de redefinição gerado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao gerar link."
      );
    } finally {
      setResetLoading(false);
    }
  };

  const copyResetLink = async () => {
    if (!resetData) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resetData.url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = resetData.url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const shareResetLink = async () => {
    if (!resetData || !resetTarget) return;
    const expiresLabel = new Date(resetData.expiresAt).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const text =
      `Olá, ${resetTarget.displayName}.\n\n` +
      `Use o link abaixo para definir uma nova senha no Painel GSN ` +
      `(válido até ${expiresLabel} e de uso único):\n\n${resetData.url}`;

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: "Redefinição de senha — Painel GSN",
          text,
          url: resetData.url,
        });
      } catch {
        // usuário cancelou ou navegador bloqueou — sem feedback negativo
      }
      return;
    }
    await copyResetLink();
  };

  const openMailto = () => {
    if (!resetData || !resetTarget) return;
    const expiresLabel = new Date(resetData.expiresAt).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const subject = "Redefinição de senha — Painel GSN";
    const body =
      `Olá, ${resetTarget.displayName}.\n\n` +
      `Use o link abaixo para definir uma nova senha no Painel GSN ` +
      `(válido até ${expiresLabel} e de uso único):\n\n` +
      `${resetData.url}\n\n` +
      `Se você não solicitou essa alteração, ignore este e-mail.`;
    const href = `mailto:${encodeURIComponent(resetTarget.email)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  const roleBadgeColor: Record<UserRole, string> = {
    admin: "bg-gsn-100 text-gsn-800",
    supervisor: "bg-purple-100 text-purple-700",
    operador: "bg-blue-100 text-blue-700",
    comercial: "bg-emerald-100 text-emerald-700",
    viewer: "bg-gray-100 text-gray-700",
  };

  return (
    <ProtectedLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-6 h-6 text-gsn-400" />
              Usuários
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition shadow-sm shadow-gsn-700/25"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
            </button>
          )}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, usuário ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none bg-white"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-gsn-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Usuário
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Perfil
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Módulos
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Último acesso
                    </th>
                    {isAdmin && (
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gsn-50/30 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gsn-100 flex items-center justify-center text-xs font-medium text-gsn-700">
                            {u.displayName
                              .split(" ")
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u.displayName}</p>
                            <p className="text-xs text-gray-500">{u.username} &middot; {u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
                            roleBadgeColor[u.role]
                          )}
                        >
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {u.allowedModules.map((m) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-gsn-50 text-gsn-700 uppercase"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium",
                            u.isActive ? "text-emerald-600" : "text-red-500"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              u.isActive ? "bg-emerald-500" : "bg-red-400"
                            )}
                          />
                          {u.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openResetLink(u)}
                              disabled={!u.isActive}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={
                                u.isActive
                                  ? "Gerar link de redefinição de senha"
                                  : "Usuário inativo"
                              }
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gsn-700 hover:bg-gsn-50 transition"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {u.id !== user.id && (
                              <button
                                onClick={() => handleDelete(u)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  value={form.displayName}
                  onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nome de usuário
                  </label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                    placeholder="nome.sobrenome"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {editingUser ? "Nova senha (deixe vazio para manter)" : "Senha"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingUser}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                    placeholder="Mín. 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Perfil</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none bg-white"
                >
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Módulos permitidos
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(MODULE_LABELS) as [PanelModule, string][]).map(
                    ([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleModule(key)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition",
                          form.allowedModules.includes(key)
                            ? "bg-gsn-700 text-white border-gsn-700"
                            : "bg-white text-gray-600 border-gray-300 hover:border-gsn-300"
                        )}
                      >
                        {form.allowedModules.includes(key) && <Check className="w-3 h-3" />}
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {editingUser && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition",
                      form.isActive ? "bg-emerald-500" : "bg-gray-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition",
                        form.isActive ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                  <span className="text-sm text-gray-500">
                    {form.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition shadow-sm shadow-gsn-700/25"
                >
                  {editingUser ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-link-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeResetLink();
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex-shrink-0">
                  <KeyRound className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3
                    id="reset-link-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    Link de redefinição de senha
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {resetTarget.displayName} · {resetTarget.email}
                  </p>
                </div>
              </div>
              <button
                onClick={closeResetLink}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {!resetData ? (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-medium">Atenção</p>
                    <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-amber-800">
                      <li>O link gerado é de <strong>uso único</strong>.</li>
                      <li>Validade de <strong>1 hora</strong> a partir da geração.</li>
                      <li>
                        Tokens anteriores ainda pendentes deste usuário serão
                        invalidados ao consumir o novo.
                      </li>
                      <li>
                        Compartilhe apenas por canal seguro com o próprio usuário.
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeResetLink}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => generateResetLink(resetTarget)}
                      disabled={resetLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shadow-gsn-700/25"
                    >
                      {resetLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                      )}
                      {resetLoading ? "Gerando..." : "Gerar link"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="reset-link-url"
                      className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5"
                    >
                      Link gerado
                    </label>
                    <div className="flex items-stretch gap-2">
                      <input
                        id="reset-link-url"
                        type="text"
                        readOnly
                        value={resetData.url}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-xs font-mono bg-gray-50 text-gray-800 focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                      />
                      <button
                        type="button"
                        onClick={copyResetLink}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition flex-shrink-0",
                          copied
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        )}
                        title="Copiar link"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Copy className="w-4 h-4" aria-hidden="true" />
                        )}
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 flex items-center justify-between gap-3">
                    <span>
                      Expira em:{" "}
                      <strong className="text-gray-900">
                        {new Date(resetData.expiresAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Shield className="w-3 h-3" aria-hidden="true" />
                      Uso único
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={shareResetLink}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
                      title="Compartilhar"
                    >
                      <Share2 className="w-4 h-4" aria-hidden="true" />
                      Compartilhar
                    </button>
                    <button
                      type="button"
                      onClick={openMailto}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
                      title="Enviar por e-mail"
                    >
                      <Mail className="w-4 h-4" aria-hidden="true" />
                      E-mail
                    </button>
                    <a
                      href={resetData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition"
                      title="Abrir link"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      Abrir
                    </a>
                    <button
                      type="button"
                      onClick={() => generateResetLink(resetTarget)}
                      disabled={resetLoading}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      title="Gerar novo link (invalida o anterior)"
                    >
                      {resetLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="w-4 h-4" aria-hidden="true" />
                      )}
                      Novo
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={closeResetLink}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
