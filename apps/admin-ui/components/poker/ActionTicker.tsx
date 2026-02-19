"use client";

import { cn } from "@/lib/utils";

interface ActionTickerProps {
  lastAction?: {
    agentId: string;
    action: string;
    amount?: number;
  } | null;
}

const actionColors: Record<string, string> = {
  FOLD: "text-red-400",
  CHECK: "text-zinc-300",
  CALL: "text-blue-400",
  BET: "text-yellow-400",
  RAISE: "text-orange-400",
};

export function ActionTicker({ lastAction }: ActionTickerProps) {
  if (!lastAction) return null;

  return (
    <div className="rounded-md bg-black/40 px-3 py-1 backdrop-blur-sm border border-zinc-700/50">
      <span className="text-[11px] text-zinc-400">
        <span className="font-mono font-medium text-zinc-200">
          {lastAction.agentId.replace("agent-", "")}
        </span>{" "}
        <span className={cn("font-bold uppercase", actionColors[lastAction.action] ?? "text-zinc-300")}>
          {lastAction.action}
        </span>
        {lastAction.amount !== undefined && lastAction.amount > 0 && (
          <span className="font-mono text-yellow-300 ml-1">{lastAction.amount}</span>
        )}
      </span>
    </div>
  );
}
