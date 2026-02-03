import { useMemo, useState } from "react";
import { OrdersDashboard } from "./pages/OrdersDashboard";
import { AuthContext, type AuthState, type Role } from "./auth/auth";

const ROLES: Array<{ id: Role; label: string }> = [
  { id: "LOGISTICA", label: "Logística" },
  { id: "COMERCIAL", label: "Comercial" },
  { id: "ADMIN", label: "Admin" }
];

export function App() {
  const [role, setRole] = useState<Role>("LOGISTICA");

  const auth = useMemo<AuthState>(() => {
    return {
      user: {
        id: "user-demo",
        name: "Usuário Demo",
        role
      }
    };
  }, [role]);

  return (
    <AuthContext.Provider value={auth}>
      <div className="topbar">
        <div className="container topbar-inner">
          <div className="brand">
            <h1>Painel de pedidos</h1>
            <span className="muted">Logística + Comercial</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Perfil
            </span>
            <select
              className="control"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              aria-label="Selecionar perfil"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: "18px 0 30px" }}>
        <OrdersDashboard />
      </div>
    </AuthContext.Provider>
  );
}

