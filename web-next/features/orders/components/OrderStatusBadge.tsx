import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_CONFIG, OrderStatus } from "@/lib/constants/status";
import { cn } from "@/lib/utils/cn";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = ORDER_STATUS_CONFIG[status];

  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }

  return (
    <Badge variant="outline" className={cn(config.color, className)}>
      {config.label}
    </Badge>
  );
}
