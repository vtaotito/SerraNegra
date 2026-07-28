import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Estado vazio ilustrado e acionável do portal cliente (tema claro). */
export function ClientEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: ClientEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center sm:py-16",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted sm:h-20 sm:w-20">
          <Icon className="h-8 w-8 text-muted-foreground/40 sm:h-10 sm:w-10" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gsn-text sm:text-xl">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
