import { cn } from "@/lib/utils";
import { CardHand } from "./PokerCard";
import { ChipStack } from "./ChipStack";

export interface SeatData {
  seatIndex: number;
  agentId: string | null;
  chips: number;
  holeCards: Array<{ rank: string; suit: string }>;
  currentBet: number;
  hasFolded: boolean;
  isAllIn: boolean;
  isActive: boolean;
  isWinner: boolean;
  status: "seated" | "empty" | "left";
  position?: string; // BTN, SB, BB, UTG, etc.
  hasButton?: boolean; // Dealer button indicator
}

interface SeatProps {
  seat: SeatData;
  position: { top: string; left: string };
  betPosition?: { top: string; left: string };
}

export function Seat({ seat, position, betPosition }: SeatProps) {
  const isEmpty = !seat.agentId || seat.status === "empty";

  return (
    <>
      {/* Seat element */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ top: position.top, left: position.left }}
      >
        <div className={cn(
          "flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2 backdrop-blur-sm transition-all",
          isEmpty
            ? "border-zinc-700/50 bg-zinc-900/40"
            : seat.isActive
              ? "border-emerald-400 bg-zinc-900/80 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
              : seat.isWinner
                ? "border-yellow-400 bg-zinc-900/80 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                : seat.hasFolded
                  ? "border-zinc-600/50 bg-zinc-900/60 opacity-50"
                  : "border-zinc-500/50 bg-zinc-900/70",
        )}>
          {/* Avatar */}
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
            isEmpty ? "bg-zinc-800 text-zinc-600" :
            seat.isActive ? "bg-emerald-600 text-white" :
            seat.hasFolded ? "bg-zinc-700 text-zinc-500" :
            "bg-zinc-700 text-zinc-200",
          )}>
            {isEmpty ? "?" : seat.agentId!.replace("agent-", "").charAt(0).toUpperCase()}
          </div>

          {/* Position Label */}
          {seat.position && (
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">
              {seat.position}
            </span>
          )}

          {/* Dealer Button */}
          {seat.hasButton && (
            <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-zinc-900 border-2 border-zinc-700 shadow-lg">
              D
            </div>
          )}

          {/* Name */}
          <span className={cn(
            "text-[10px] font-medium truncate max-w-[80px]",
            isEmpty ? "text-zinc-600" : "text-zinc-200",
          )}>
            {isEmpty ? `Seat ${seat.seatIndex + 1}` : seat.agentId!.replace("agent-", "")}
          </span>

          {/* Chips */}
          {!isEmpty && (
            <span className="text-[10px] font-mono font-semibold text-yellow-300">
              {seat.chips.toLocaleString()}
            </span>
          )}

          {/* Status badges */}
          {seat.hasFolded && (
            <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider">Fold</span>
          )}
          {seat.isAllIn && (
            <span className="text-[8px] font-bold text-yellow-400 uppercase tracking-wider animate-pulse">All-In</span>
          )}
          {seat.isActive && !isEmpty && (
            <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Acting</span>
          )}

          {/* Hole cards */}
          {!isEmpty && seat.holeCards.length > 0 && !seat.hasFolded && (
            <div className="mt-0.5">
              <CardHand cards={seat.holeCards} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Bet chips (positioned between seat and center) */}
      {seat.currentBet > 0 && betPosition && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
          style={{ top: betPosition.top, left: betPosition.left }}
        >
          <ChipStack amount={seat.currentBet} size="sm" />
        </div>
      )}
    </>
  );
}
