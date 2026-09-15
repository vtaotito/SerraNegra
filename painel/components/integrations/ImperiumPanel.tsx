"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, Send, Warehouse } from "lucide-react";
import {
  IntegrationCard,
  type IntegrationStatus,
} from "@/components/integrations/IntegrationCard";
import {
  cancelImperiumPedido,
  fetchImperiumCargas,
  fetchImperiumHealth,
  pollImperiumCargas,
  sendOrdersToImperium,
  smokeTestImperium,
  syncImperiumProducts,
  type ImperiumCargaRow,
  type ImperiumHealth,
} from "@/lib/cockpit-api";

function badge(health: ImperiumHealth | null, loading: boolean): IntegrationStatus {
  if (loading && !health) return "unknown";
  if (!health) return "unknown";
  if (!health.configured) return "not_configured";
  if (health.healthy) return "ok";
  return "error";
}

export function ImperiumPanel({
  allowed,
  initial,
  loading,
}: {
  allowed: boolean;
  initial: ImperiumHealth | null;
  loading: boolean;
}) {
  const [health, setHealth] = useState<ImperiumHealth | null>(initial);
  const [cargas, setCargas] = useState<ImperiumCargaRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [docNums, setDocNums] = useState("");
  const [placa, setPlaca] = useState("");

  useEffect(() => {
    setHealth(initial);
  }, [initial]);

  const reloadCargas = useCallback(async () => {
    try {
      const res = await fetchImperiumCargas();
      setCargas(res.items ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (initial?.configured) reloadCargas();
  }, [initial?.configured, reloadCargas]);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, okText: string) => {
      setBusy(key);
      setMessage(null);
      try {
        const res = await fn();
        setMessage({ kind: "ok", text: okText });
        if (key === "health" || key === "smoke") {
          const h = await fetchImperiumHealth();
          setHealth(h);
        }
        await reloadCargas();
        return res;
      } catch (err) {
        setMessage({
          kind: "error",
          text: err instanceof Error ? err.message : "Falha na operação",
        });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [reloadCargas],
  );

  return (
    <IntegrationCard
      span={2}
      icon={Warehouse}
      iconColor="text-amber-700"
      iconBg="bg-amber-50"
      title="WMS Imperium"
      subtitle="Envio SOAP de produtos, cargas e NF de saída"
      status={badge(health, loading)}
      details={[
        { label: "Host", value: health?.baseUrl ?? "—", mono: true },
        { label: "Usuário", value: health?.username ?? "—" },
        { label: "Placa padrão", value: health?.defaultPlaca ?? "—" },
        { label: "Grade", value: health?.defaultGrade ?? "UNICA" },
        {
          label: "Latência",
          value: health?.responseTimeMs != null ? `${health.responseTimeMs} ms` : "—",
        },
      ]}
      message={
        message
          ? { kind: message.kind, text: message.text }
          : health?.message
            ? { kind: health.healthy ? "ok" : "warn", text: health.message }
            : null
      }
      envHints={[
        { key: "IMPERIUM_BASE_URL", required: true },
        { key: "IMPERIUM_USERNAME", required: true },
        { key: "IMPERIUM_PASSWORD", required: true },
        { key: "IMPERIUM_CNPJ_EMITENTE", note: "necessário para informar NF" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!allowed || busy !== null}
            onClick={() => run("health", fetchImperiumHealth, "Health atualizado")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "health" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Testar conexão
          </button>
          <button
            type="button"
            disabled={!allowed || busy !== null || !health?.configured}
            onClick={() => run("smoke", smokeTestImperium, "Smoke test executado no homolog")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "smoke" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Smoke test
          </button>
          <button
            type="button"
            disabled={!allowed || busy !== null || !health?.configured}
            onClick={() => run("produtos", () => syncImperiumProducts(200), "Produtos enviados ao Imperium")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "produtos" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Sync produtos
          </button>
          <button
            type="button"
            disabled={!allowed || busy !== null || !health?.configured}
            onClick={() => run("poll", pollImperiumCargas, "Cargas atualizadas")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "poll" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar cargas
          </button>
        </div>
      }
    >
      <div className="mt-4 space-y-3">
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const nums = docNums
              .split(/[,\s]+/)
              .map((n) => Number(n.trim()))
              .filter((n) => Number.isFinite(n) && n > 0);
            if (nums.length === 0) {
              setMessage({ kind: "error", text: "Informe ao menos um número de pedido SAP" });
              return;
            }
            void run(
              "enviar",
              () => sendOrdersToImperium({ docNums: nums, placa: placa || undefined }),
              `Carga enviada (${nums.join(", ")})`,
            );
          }}
        >
          <input
            value={docNums}
            onChange={(e) => setDocNums(e.target.value)}
            placeholder="Nº pedidos SAP (ex: 12345, 12346)"
            className="flex-1 min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm"
            disabled={!allowed}
          />
          <input
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            placeholder="Placa (opcional)"
            className="w-full sm:w-36 min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm uppercase"
            disabled={!allowed}
          />
          <button
            type="submit"
            disabled={!allowed || busy !== null || !health?.configured}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 min-h-[40px]"
          >
            {busy === "enviar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar carga
          </button>
        </form>

        {cargas.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Carga</th>
                  <th className="text-left px-3 py-2 font-medium">Pedidos</th>
                  <th className="text-left px-3 py-2 font-medium">Placa</th>
                  <th className="text-left px-3 py-2 font-medium">Situação</th>
                  <th className="text-left px-3 py-2 font-medium">Erro</th>
                </tr>
              </thead>
              <tbody>
                {cargas.slice(0, 8).map((c) => (
                  <tr key={c.cod_carga} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono">{c.cod_carga}</td>
                    <td className="px-3 py-2">{(c.doc_nums ?? []).join(", ")}</td>
                    <td className="px-3 py-2">{c.placa ?? "—"}</td>
                    <td className="px-3 py-2">{c.situacao ?? "—"}</td>
                    <td className="px-3 py-2 text-red-600 max-w-[220px] truncate">{c.last_error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Também é possível enviar um pedido pela lista em Pedidos → Análise (botão WMS). Cancelar:{" "}
          <button
            type="button"
            className="underline"
            disabled={!allowed || !docNums.trim()}
            onClick={() => {
              const n = Number(docNums.split(/[,\s]+/)[0]);
              if (!n) return;
              void run("cancelar", () => cancelImperiumPedido(n), `Pedido ${n} cancelado no Imperium`);
            }}
          >
            cancelar primeiro nº informado
          </button>
        </p>
      </div>
    </IntegrationCard>
  );
}
