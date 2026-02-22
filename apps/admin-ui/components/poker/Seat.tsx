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
  position?: string;
  hasButton?: boolean;
  isMine?: boolean;
  showCards?: boolean;
}

interface SeatProps {
  seat: SeatData;
  position: { top: string; left: string };
  betPosition?: { top: string; left: string };
}

const positionFullNames: Record<string, string> = {
  BTN: "Button (Dealer)",
  "BTN/SB": "Button / Small Blind",
  SB: "Small Blind",
  BB: "Big Blind",
  UTG: "Under the Gun",
  HJ: "Hijack",
  CO: "Cut Off",
};

const getAvatarColor = (id?: string | null) => {
  if (!id) return "from-zinc-600 to-zinc-800";
  const num = id.charCodeAt(id.length - 1) % 6;
  const colors = [
    "from-blue-500 to-blue-700",
    "from-purple-500 to-purple-700",
    "from-pink-500 to-pink-700",
    "from-orange-500 to-orange-700",
    "from-cyan-500 to-cyan-700",
    "from-indigo-500 to-indigo-700",
  ];
  return colors[num]!;
};

export function Seat({ seat, position, betPosition }: SeatProps) {
  const isEmpty = !seat.agentId || seat.status === "empty";
  const name = seat.agentId?.replace("agent-", "") ?? "";

  return (
    <>
      {/* Seat */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ top: position.top, left: position.left }}
      >
        <div
          className={cn(
            "relative flex flex-col items-center rounded-xl border backdrop-blur-sm transition-all",
            isEmpty
              ? "w-[90px] bg-white/[0.03] border-dashed border-white/10 py-4"
              : seat.isMine
                ? "w-[120px] bg-cyan-950/80 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.4)] py-2.5"
                : seat.isWinner
                  ? "w-[120px] bg-yellow-950/80 border-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.4)] py-2.5"
                  : seat.hasFolded
                    ? "w-[120px] bg-black/80 border-zinc-800/40 py-2.5 opacity-45 grayscale"
                    : seat.isActive
                      ? "w-[120px] bg-zinc-900/80 border-emerald-500/60 py-2.5"
                      : "w-[120px] bg-zinc-900/80 border-zinc-700/50 py-2.5"
          )}
        >
          {/* My agent glow ring */}
          {seat.isMine && (
            <div className="absolute -inset-0.5 rounded-xl border-2 border-cyan-400/70 pointer-events-none" />
          )}
          {/* Active turn pulse */}
          {seat.isActive && !seat.isMine && (
            <div className="absolute -inset-0.5 rounded-xl border border-emerald-500/50 animate-pulse pointer-events-none" />
          )}

          {isEmpty ? (
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
              Empty
            </span>
          ) : (
            <>
              {/* Position + Name */}
              <div className="w-full flex items-center justify-between px-2.5 mb-1.5">
                {seat.position ? (
                  <span
                    className="text-[10px] font-bold uppercase text-zinc-400 bg-black/50 px-1.5 py-0.5 rounded cursor-help"
                    title={positionFullNames[seat.position] ?? seat.position}
                  >
                    {seat.position}
                  </span>
                ) : (
                  <span />
                )}
                <span className="text-[11px] font-semibold text-zinc-200 truncate max-w-[65px]">
                  {name}
                </span>
              </div>

              {/* Avatar */}
              <div className="relative">
                {seat.hasButton && (
                  <div className="absolute -top-1.5 -right-3 z-20 w-5 h-5 rounded-full bg-white text-[10px] font-black text-black flex items-center justify-center border-2 border-zinc-400 shadow-md">
                    D
                  </div>
                )}
                <div
                  className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center text-base font-black text-white shadow-md border-2 border-white/20 relative",
                    seat.isMine
                      ? "bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                      : `bg-gradient-to-br ${getAvatarColor(seat.agentId)}`
                  )}
                >
                  {name.charAt(0).toUpperCase()}
                  {seat.hasFolded && (
                    <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-red-500 -rotate-45" />
                    </div>
                  )}
                </div>
              </div>

              {/* Chips */}
              <div className="mt-1.5 px-3 py-0.5 bg-black/40 rounded-full">
                <span
                  className={cn(
                    "text-xs font-mono font-bold",
                    seat.hasFolded ? "text-zinc-500" : "text-amber-400"
                  )}
                >
                  ${seat.chips.toLocaleString()}
                </span>
              </div>

              {/* Status badge */}
              <div className="h-5 mt-0.5 flex items-center justify-center gap-1">
                {seat.isMine && (
                  <span className="px-1.5 py-0.5 bg-cyan-900/60 border border-cyan-500/40 rounded text-[9px] font-black text-cyan-300 uppercase tracking-widest">
                    You
                  </span>
                )}
                {seat.hasFolded ? (
                  <span className="px-2 py-0.5 bg-zinc-800 rounded text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                    Fold
                  </span>
                ) : seat.isAllIn ? (
                  <span className="px-2 py-0.5 bg-amber-900/80 border border-amber-500/50 rounded text-[9px] font-black text-amber-300 uppercase tracking-widest animate-pulse">
                    All-In
                  </span>
                ) : seat.isActive ? (
                  <span className="px-2 py-0.5 bg-emerald-900/60 border border-emerald-500/40 rounded text-[9px] font-bold text-emerald-300 uppercase tracking-widest">
                    Thinking
                  </span>
                ) : null}
              </div>

              {/* Hole Cards */}
              {seat.holeCards.length > 0 && (
                <div className="mt-1.5 flex justify-center">
                  <CardHand
                    cards={seat.holeCards}
                    size="md"
                    faceDown={seat.showCards === false}
                    dimmed={seat.hasFolded}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bet chip */}
      {seat.currentBet > 0 && betPosition && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
          style={{ top: betPosition.top, left: betPosition.left }}
        >
          <ChipStack amount={seat.currentBet} size="md" />
        </div>
      )}
    </>
  );
}
