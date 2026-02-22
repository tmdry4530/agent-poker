"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useApiData } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { TableFelt } from "./TableFelt";
import { Seat, type SeatData } from "./Seat";
import { CommunityCards } from "./CommunityCards";
import { PotBadge } from "./PotBadge";
import { ActionControls } from "./ActionControls";

interface LiveState {
  handId: string;
  street: string;
  communityCards: Array<{ rank: string; suit: string }>;
  potAmount: number;
  activePlayerIndex: number;
  isHandComplete: boolean;
  dealerIndex?: number;
  players: Array<{
    id: string;
    chips: number;
    currentBet: number;
    hasFolded: boolean;
    isAllIn: boolean;
    holeCards: Array<{ rank: string; suit: string }>;
  }>;
  winners: string[];
  lastAction?: { agentId: string; action: string; amount?: number };
}

// Position calculation for 2-6 players
function getPositions(playerCount: number, dealerIndex: number): Map<number, string> {
  const positions = new Map<number, string>();

  if (playerCount === 2) {
    // Heads-up: dealer is SB, other is BB
    positions.set(dealerIndex, "BTN/SB");
    positions.set((dealerIndex + 1) % 2, "BB");
  } else if (playerCount === 3) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
  } else if (playerCount === 4) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
    positions.set((dealerIndex + 3) % playerCount, "UTG");
  } else if (playerCount === 5) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
    positions.set((dealerIndex + 3) % playerCount, "UTG");
    positions.set((dealerIndex + 4) % playerCount, "CO");
  } else if (playerCount >= 6) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
    positions.set((dealerIndex + 3) % playerCount, "UTG");
    positions.set((dealerIndex + 4) % playerCount, "HJ");
    positions.set((dealerIndex + 5) % playerCount, "CO");
  }

  return positions;
}

// 6-seat positions: evenly distributed around the oval
const seatPositions = [
  { top: "15%", left: "68%" },   // 0: top right
  { top: "50%", left: "88%" },   // 1: right
  { top: "85%", left: "68%" },   // 2: bottom right
  { top: "85%", left: "32%" },   // 3: bottom left
  { top: "50%", left: "12%" },   // 4: left
  { top: "15%", left: "32%" },   // 5: top left
];

const betPositions = [
  { top: "30%", left: "60%" },   // 0: top right
  { top: "50%", left: "72%" },   // 1: right
  { top: "70%", left: "60%" },   // 2: bottom right
  { top: "70%", left: "40%" },   // 3: bottom left
  { top: "50%", left: "28%" },   // 4: left
  { top: "30%", left: "40%" },   // 5: top left
];

async function fetchTableState(tableId: string): Promise<{ liveState: LiveState | null; seats: any[] }> {
  // DUMMY STATE FOR UI VERIFICATION
  return {
    liveState: {
      handId: "hand-123",
      street: "Flop",
      communityCards: [
        { rank: "A", suit: "s" },
        { rank: "K", suit: "h" },
        { rank: "7", suit: "d" },
      ],
      potAmount: 1450,
      activePlayerIndex: 4,
      isHandComplete: false,
      dealerIndex: 0,
      players: [
        { id: "agent-Alpha", chips: 10000, currentBet: 0, hasFolded: true, isAllIn: false, holeCards: [] },
        { id: "agent-Bravo", chips: 8500, currentBet: 100, hasFolded: false, isAllIn: false, holeCards: [{rank:"Q", suit:"s"}, {rank:"J", suit:"s"}] },
        { id: "agent-Charlie", chips: 12000, currentBet: 0, hasFolded: true, isAllIn: false, holeCards: [] },
        { id: "agent-Delta", chips: 450, currentBet: 450, hasFolded: false, isAllIn: true, holeCards: [{rank:"9", suit:"h"}, {rank:"9", suit:"d"}] },
        { id: "agent-Echo", chips: 15000, currentBet: 100, hasFolded: false, isAllIn: false, holeCards: [{rank:"A", suit:"c"}, {rank:"K", suit:"c"}] },
        { id: "agent-Foxtrot", chips: 9200, currentBet: 100, hasFolded: false, isAllIn: false, holeCards: [{rank:"T", suit:"h"}, {rank:"8", suit:"h"}] },
      ],
      winners: [],
    },
    seats: [
      { agentId: "agent-Alpha", chips: 10000, status: "seated" },
      { agentId: "agent-Bravo", chips: 8500, status: "seated" },
      { agentId: "agent-Charlie", chips: 12000, status: "seated" },
      { agentId: "agent-Delta", chips: 450, status: "seated" },
      { agentId: "agent-Echo", chips: 15000, status: "seated" },
      { agentId: "agent-Foxtrot", chips: 9200, status: "seated" },
    ]
  };
}

export function PokerTable({ tableId }: { tableId: string }) {
  const { role, agentId: myAgentId } = useAuth();
  const isSpectator = role === "spectator";
  const fetcher = useCallback(() => fetchTableState(tableId), [tableId]);
  const { data, loading } = useApiData(fetcher, 2000);

  const liveState = data?.liveState ?? null;
  const rawSeats = data?.seats ?? [];

  // Build 6 seat slots (6-max short-handed)
  const maxSeats = 6;
  const seats: SeatData[] = useMemo(() => {
    // Count active players for position calculation
    const activePlayers = rawSeats.filter(s => s && s.agentId).length;
    const dealerIndex = liveState?.dealerIndex ?? 0;
    const positionMap = activePlayers > 0 ? getPositions(activePlayers, dealerIndex) : new Map();

    return Array.from({ length: maxSeats }, (_, i): SeatData => {
      const raw = rawSeats[i];
      if (!raw || !raw.agentId) {
        return {
          seatIndex: i,
          agentId: null,
          chips: 0,
          holeCards: [],
          currentBet: 0,
          hasFolded: false,
          isAllIn: false,
          isActive: false,
          isWinner: false,
          status: "empty",
        };
      }

      // Find player in live state
      const player = liveState?.players.find((p) => p.id === raw.agentId);
      const isMine = !isSpectator && raw.agentId === myAgentId;
      return {
        seatIndex: i,
        agentId: raw.agentId,
        chips: player?.chips ?? raw.chips ?? 0,
        holeCards: player?.holeCards ?? [],
        currentBet: player?.currentBet ?? 0,
        hasFolded: player?.hasFolded ?? false,
        isAllIn: player?.isAllIn ?? false,
        isActive: liveState
          ? liveState.activePlayerIndex === i && !liveState.isHandComplete
          : false,
        isWinner: liveState?.winners.includes(raw.agentId) ?? false,
        status: raw.status ?? "seated",
        position: positionMap.get(i),
        hasButton: i === dealerIndex && activePlayers > 0,
        isMine,
        showCards: isSpectator ? true : isMine,
      };
    });
  }, [maxSeats, rawSeats, liveState, isSpectator, myAgentId]);

  // Determine active player state for dummy UI
  const activePlayer = seats.find(s => s.isActive);
  const highestBet = liveState ? Math.max(...liveState.players.map(p => p.currentBet)) : 0;
  const activePlayerCallAmount = activePlayer ? highestBet - activePlayer.currentBet : 0;

  // Build action log with color coding
  const actionLog = useMemo(() => {
    if (!liveState) return [];
    const logs: Array<{ text: string; type: "fold" | "bet" | "allin" | "check" | "call" | "raise" }> = [];
    for (const p of liveState.players) {
      const name = p.id.replace("agent-", "");
      if (p.hasFolded) logs.push({ text: `${name} folds`, type: "fold" });
      else if (p.isAllIn) logs.push({ text: `${name} all-in $${p.currentBet}`, type: "allin" });
      else if (p.currentBet > 0) logs.push({ text: `${name} bets $${p.currentBet}`, type: "bet" });
    }
    if (liveState.lastAction) {
      const n = liveState.lastAction.agentId.replace("agent-", "");
      const act = liveState.lastAction.action.toLowerCase();
      const amtStr = liveState.lastAction.amount ? ` $${liveState.lastAction.amount}` : "";
      const type = act.includes("fold") ? "fold" : act.includes("all") ? "allin" : act.includes("raise") ? "raise" : act.includes("call") ? "call" : act.includes("check") ? "check" : "bet";
      logs.push({ text: `${n} ${liveState.lastAction.action}${amtStr}`, type });
    }
    return logs;
  }, [liveState]);

  return (
    <div className="flex flex-col items-center justify-start w-full max-w-[1400px] mx-auto pb-4 overflow-hidden">
      {/* Table Area */}
      <div className="relative w-full h-[600px] sm:h-[700px] flex justify-center">
        <div className="w-full h-full relative scale-[0.60] sm:scale-[0.65] md:scale-[0.80] lg:scale-[0.90] xl:scale-[1.0] flex items-center justify-center origin-top pointer-events-none">
          <div className="pointer-events-auto w-full h-full flex items-center justify-center">
            <TableFelt>
              {/* Seats */}
              {seats.map((seat, i) => (
                <Seat
                  key={i}
                  seat={seat}
                  position={seatPositions[i]!}
                  betPosition={betPositions[i]!}
                />
              ))}

              {/* Center: community cards + pot + turn indicator */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 pointer-events-auto">
                {loading ? (
                  <div className="text-emerald-400 font-mono text-sm animate-pulse">Initializing Table...</div>
                ) : liveState ? (
                  <>
                    {activePlayer && activePlayer.agentId && (
                      <div className="px-4 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full backdrop-blur-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-bold text-emerald-200 tracking-wider uppercase">
                          {activePlayer.agentId.replace("agent-", "")}'s Turn
                        </span>
                      </div>
                    )}
                    <CommunityCards cards={liveState.communityCards} />
                    <div className="bg-black/60 backdrop-blur-lg px-6 py-2 rounded-2xl border border-white/10 flex items-center gap-4 shadow-xl">
                      <span className="text-zinc-400 font-mono text-xs uppercase tracking-widest font-bold">
                        {liveState.street || "Preflop"}
                      </span>
                      <div className="w-px h-5 bg-zinc-700" />
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm" />
                        <span className="text-amber-300 font-mono font-black text-lg tracking-tight">
                          ${liveState.potAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 bg-black/40 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
                    <PotBadge amount={0} />
                    <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">Waiting for players...</span>
                  </div>
                )}
              </div>
            </TableFelt>
          </div>
        </div>

        {/* Hero Action Controls - Only shown for agents, hidden for spectators */}
        {activePlayer && role !== 'spectator' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[800px] px-4 z-50 pointer-events-auto">
            <div className="bg-black/95 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl pb-2">
              <ActionControls
                potAmount={liveState?.potAmount || 0}
                minBet={highestBet > 0 ? highestBet * 2 : 20}
                playerChips={activePlayer.chips}
                canCheck={activePlayerCallAmount === 0}
                callAmount={activePlayerCallAmount}
                onAction={(act, amt) => console.log(`Action: ${act}`, amt ? `Amount: ${amt}` : "")}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Log */}
      {actionLog.length > 0 && (
        <div className="w-full max-w-[900px] mx-auto px-4 mt-2">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Live Actions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {actionLog.map((log, i) => {
                const colors = {
                  fold: "text-zinc-500 border-zinc-700 bg-zinc-900/60",
                  bet: "text-emerald-300 border-emerald-800 bg-emerald-950/60",
                  call: "text-emerald-300 border-emerald-800 bg-emerald-950/60",
                  check: "text-sky-300 border-sky-800 bg-sky-950/60",
                  raise: "text-blue-300 border-blue-800 bg-blue-950/60",
                  allin: "text-amber-300 border-amber-700 bg-amber-950/60",
                };
                return (
                  <span key={i} className={cn("text-xs font-mono px-2.5 py-1 rounded-md border", colors[log.type])}>
                    {log.text}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
