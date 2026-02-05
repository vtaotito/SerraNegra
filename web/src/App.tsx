import { useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { OrdersDashboard } from "./pages/OrdersDashboard";
import { IntegrationPage } from "./pages/IntegrationPage";
import { AuthContext, type AuthState, type Role } from "./auth/auth";

const ROLES: Array<{ id: Role; label: string }> = [
  { id: "LOGISTICA", label: "Logística" },
  { id: "COMERCIAL", label: "Comercial" },
  { id: "ADMIN", label: "Admin" }
];

type Page = "dashboard" | "integration";

export function App() {
  const [role, setRole] = useState<Role>("LOGISTICA");
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

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
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#ffffff",
            color: "#172b4d",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(9, 30, 66, 0.15)",
            fontSize: "14px",
            fontWeight: 500
          },
          success: {
            iconTheme: {
              primary: "#61bd4f",
              secondary: "#ffffff"
            }
          },
          error: {
            iconTheme: {
              primary: "#eb5a46",
              secondary: "#ffffff"
            }
          }
        }}
      />

      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <h1>WMS/OMS</h1>
            <span>Sistema de Gestão de Pedidos</span>
          </div>
          <div className="topbar-right">
            {/* Navigation */}
            <nav className="mr-6 flex gap-4">
              <button
                onClick={() => setCurrentPage("dashboard")}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  currentPage === "dashboard"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentPage("integration")}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  currentPage === "integration"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                Integração
              </button>
            </nav>

            <span className="topbar-label">Perfil</span>
            <select
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

      {currentPage === "dashboard" && <OrdersDashboard />}
      {currentPage === "integration" && <IntegrationPage />}
    </AuthContext.Provider>
  );
}

