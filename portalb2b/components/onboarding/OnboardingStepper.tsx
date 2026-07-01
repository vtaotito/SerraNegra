import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PendingKind, Step } from "./types";

interface FlowConfig {
  labels: string[];
  activeIndex: number;
}

/**
 * Deriva os passos visíveis e o passo ativo a partir do estado da máquina de
 * onboarding. Retorna null quando não faz sentido exibir o stepper (tela de
 * CNPJ inicial ou login por senha de cliente recorrente).
 */
function resolveFlow(step: Step, pendingKind: PendingKind): FlowConfig | null {
  switch (step) {
    // Primeiro acesso de cliente já existente no SAP (com e-mail cadastrado).
    case "email":
      return { labels: ["CNPJ", "Confirmar e-mail", "Código", "Criar senha"], activeIndex: 1 };
    case "otp":
      return { labels: ["CNPJ", "Confirmar e-mail", "Código", "Criar senha"], activeIndex: 2 };
    case "set-password":
      return { labels: ["CNPJ", "Confirmar e-mail", "Código", "Criar senha"], activeIndex: 3 };

    // Cliente já existente no SAP, porém sem e-mail: enriquecimento.
    case "request-email":
      return { labels: ["CNPJ", "E-mail de acesso", "Análise GSN"], activeIndex: 1 };

    // Cliente novo (não existe no SAP).
    case "register":
      return { labels: ["CNPJ", "Dados da empresa", "Análise GSN"], activeIndex: 1 };

    // Conclusão: depende da jornada que trouxe até aqui.
    case "pending-approval":
      return pendingKind === "email-access"
        ? { labels: ["CNPJ", "E-mail de acesso", "Análise GSN"], activeIndex: 2 }
        : { labels: ["CNPJ", "Dados da empresa", "Análise GSN"], activeIndex: 2 };

    default:
      return null;
  }
}

export function OnboardingStepper({
  step,
  pendingKind,
}: {
  step: Step;
  pendingKind: PendingKind;
}) {
  const flow = resolveFlow(step, pendingKind);
  if (!flow) return null;

  return (
    <ol className="mb-5 flex items-center gap-1">
      {flow.labels.map((label, index) => {
        const done = index < flow.activeIndex;
        const active = index === flow.activeIndex;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-gsn-brand bg-gsn-brand text-white",
                  active && "border-gsn-brand bg-white text-gsn-brand ring-2 ring-gsn-brand/20",
                  !done && !active && "border-muted-foreground/30 bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              {index < flow.labels.length - 1 && (
                <span
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded transition-colors",
                    index < flow.activeIndex ? "bg-gsn-brand" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "text-center text-[10px] leading-tight",
                active ? "font-medium text-gsn-text" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
