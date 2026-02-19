import { cn } from "@/lib/utils";
import type { WsStatus } from "@/lib/use-websocket";

const statusConfig: Record<WsStatus, { label: string; dotClass: string }> = {
  connected: { label: "Live", dotClass: "bg-green-500" },
  connecting: { label: "Connecting", dotClass: "bg-yellow-500 animate-pulse" },
  disconnected: { label: "Disconnected", dotClass: "bg-red-500" },
};

interface WsStatusIndicatorProps {
  status: WsStatus;
  className?: string;
}

export function WsStatusIndicator({ status, className }: WsStatusIndicatorProps) {
  const config = statusConfig[status];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}
