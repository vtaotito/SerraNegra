import { Badge } from "@/components/ui/badge";
import { SYNC_STATUS_CONFIG, SyncStatus } from "@/lib/constants/status";
import { cn } from "@/lib/utils/cn";

interface SyncStatusBadgeProps {
  status: SyncStatus | null | undefined;
  className?: string;
}

export function SyncStatusBadge({ status, className }: SyncStatusBadgeProps) {
  if (!status) {
    return null;
  }

  const config = SYNC_STATUS_CONFIG[status];

  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }

  return (
    <Badge variant="outline" className={cn(config.color, "text-xs", className)}>
      {config.label}
    </Badge>
  );
}
