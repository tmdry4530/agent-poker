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

const getPositionColor = (pos?: string) => {
  if (!pos) return "text-zinc-500";
  if (pos === "BTN" || pos === "D") return "text-yellow-400";
  if (pos === "SB") return "text-blue-400";
  if (pos === "BB") return "text-red-400";
  return "text-zinc-400";
};

const getAvatarColor = (id?: string | null) => {
  if (!id) return "from-zinc-600 to-zinc-900";
  const num = id.charCodeAt(id.length - 1) % 6;
  const colors = [
    "from-blue-600 to-blue-900",
    "from-purple-600 to-purple-900",
    "from-pink-600 to-pink-900",
    "from-orange-600 to-orange-900",
    "from-cyan-600 to-cyan-900",
    "from-indigo-600 to-indigo-900"
  ];
  return colors[num];
};

export function Seat({ seat, position, betPosition }: SeatProps) {
  const isEmpty = !seat.agentId || seat.status === "empty";

  return (
    <>
      {/* Seat element */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-300 hover:scale-105"
        style={{ top: position.top, left: position.left }}
      >
        <div className={cn(
          "relative flex flex-col items-center p-3 rounded-2xl border border-white/5 backdrop-blur-md overflow-hidden transition-all",
          isEmpty
            ? "w-[100px] bg-black/40 border-dashed border-white/20"
            : seat.isActive
              ? "w-[120px] bg-gradient-to-b from-emerald-900/80 to-black/90 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-900 animate-pulse"
              : seat.isWinner
                ? "w-[120px] bg-gradient-to-b from-yellow-900/80 to-black/90 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)]"
                : seat.hasFolded
                  ? "w-[120px] bg-black/80 opacity-40 border-zinc-800" // Opacity covers the whole seat
                  : "w-[120px] bg-gradient-to-b from-zinc-900/80 to-black/90 border-zinc-700/80 shadow-2xl"
        )}>
          {/* Active Glow Inner */}
          {seat.isActive && (
            <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_20px_rgba(16,185,129,0.4)] pointer-events-none" />
          )}

          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
              <span className="text-xs uppercase font-semibold">Seat {seat.seatIndex + 1}</span>
              <span className="text-[10px]">Empty</span>
            </div>
          ) : (
            <>
              {/* Top Section: Position + Name */}
              <div className="w-full flex justify-between items-center mb-1">
                {seat.position ? (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-black uppercase drop-shadow-md bg-black/80 text-zinc-300 border border-white/20">
                    {seat.position}
                  </span>
                ) : <span/>}
                
                <span className={cn(
                  "text-[11px] font-bold truncate max-w-[70px] drop-shadow-md",
                  seat.isActive ? "text-white" : "text-zinc-300"
                )}>
                  {seat.agentId?.replace("agent-", "")}
                </span>
              </div>

              {/* Middle Section: Avatar/Stack */}
              <div className="relative w-full flex flex-col items-center my-1 z-10">
                {/* Dealer Button Overlay */}
                {seat.hasButton && (
                  <div className="absolute -top-2 -right-3 z-40 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-black border-4 border-zinc-300 ring-1 ring-black shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                    D
                  </div>
                )}
                
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-lg font-black shadow-inner border border-white/10 relative",
                  seat.isActive 
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                    : `bg-gradient-to-br ${getAvatarColor(seat.agentId)} text-white`
                )}>
                  {seat.agentId?.replace("agent-", "").charAt(0).toUpperCase()}
                  {/* Folded Strikethrough Overlay */}
                  {seat.hasFolded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full backdrop-blur-[1px]">
                      <div className="w-full h-1 bg-red-500/80 -rotate-45 shadow-sm" />
                    </div>
                  )}
                </div>
                
                <div className="mt-2 px-3 py-1 bg-black/60 rounded-full border border-white/10 shadow-inner flex items-center justify-center min-w-[80px]">
                  <span className="text-xs font-mono font-bold text-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.8)]">
                    ${seat.chips.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Status Row */}
              <div className="h-5 mt-1 flex items-center justify-center">
                {seat.hasFolded ? (
                  <span aria-label="Player Folded" className="px-2 py-0.5 bg-red-900/80 rounded border border-red-500/50 text-[11px] font-black text-white uppercase tracking-widest drop-shadow-md shadow-md">Fold</span>
                ) : seat.isAllIn ? (
                  <span aria-label="Player All-In" className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse drop-shadow-md">All-In</span>
                ) : seat.isActive ? (
                  <span aria-label="Player Thinking" className="text-[10px] font-black text-emerald-400 uppercase tracking-widest drop-shadow-md">Thinking</span>
                ) : null}
              </div>

              {/* Cards (Inside the seat box explicitly) */}
              {!isEmpty && seat.holeCards && seat.holeCards.length > 0 && (
                <div className="mt-2 w-full flex justify-center origin-top scale-90 transition-transform duration-300 hover:scale-[1.2] hover:z-50 cursor-pointer" title="Hole Cards">
                  <CardHand cards={seat.holeCards} size="lg" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bet Action Wrapper */}
      {seat.currentBet > 0 && betPosition && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center transition-all"
          style={{ top: betPosition.top, left: betPosition.left }}
        >
          <ChipStack amount={seat.currentBet} size="md" />
        </div>
      )}
    </>
  );
}
