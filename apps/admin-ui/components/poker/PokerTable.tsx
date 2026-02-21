"use client";

import { useCallback, useMemo } from "react";
import { useApiData } from "@/lib/hooks";
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

// 6-seat positions (percentages): top-right, right, bottom-right, bottom-left, left, top-left
const seatPositions = [
  { top: "22%", left: "70%" },   // 0: top right
  { top: "50%", left: "82%" },   // 1: right
  { top: "78%", left: "70%" },   // 2: bottom right
  { top: "78%", left: "30%" },   // 3: bottom left
  { top: "50%", left: "18%" },   // 4: left
  { top: "22%", left: "30%" },   // 5: top left
];

const betPositions = [
  { top: "35%", left: "62%" },   // 0: top right
  { top: "50%", left: "68%" },   // 1: right
  { top: "65%", left: "62%" },   // 2: bottom right
  { top: "65%", left: "38%" },   // 3: bottom left
  { top: "50%", left: "32%" },   // 4: left
  { top: "35%", left: "38%" },   // 5: top left
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
      };
    });
  }, [maxSeats, rawSeats, liveState]);

  // Determine active player state for dummy UI
  const activePlayer = seats.find(s => s.isActive);
  const highestBet = liveState ? Math.max(...liveState.players.map(p => p.currentBet)) : 0;
  const activePlayerCallAmount = activePlayer ? highestBet - activePlayer.currentBet : 0;

  return (
    <div className="flex flex-col items-center justify-start w-full max-w-[1400px] mx-auto min-h-[900px] pb-8 overflow-hidden">
      {/* Table Area */}
      <div className="relative w-full h-[650px] sm:h-[750px] flex justify-center -mt-8">
        {/* Decrease vertical scaling slightly to make room for panel */}
        <div className="w-full h-full relative scale-[0.65] sm:scale-[0.70] md:scale-[0.85] lg:scale-[0.95] xl:scale-[1.0] flex items-center justify-center origin-top pointer-events-none">
          {/* Re-enable pointer events for the table felt content */}
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

              {/* Community Cards */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] pointer-events-auto">
                {liveState && (
                  <div className="flex flex-col items-center gap-4">
                    <CommunityCards cards={liveState.communityCards} />
                    <div className="bg-black/40 backdrop-blur-md px-6 py-1.5 rounded-full border border-white/5 flex items-center gap-3">
                      <span className="text-zinc-400 font-mono text-xs uppercase tracking-widest font-bold">
                        {liveState.street || "Preflop"}
                      </span>
                      <div className="w-1 h-1 rounded-full bg-zinc-600" />
                      <span className="text-white font-mono font-bold">
                        Pot: ${liveState.potAmount}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Center area: community cards + pot */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[40%] z-30 flex flex-col items-center gap-6"
              >
                {loading ? (
                  <div className="text-emerald-400 font-mono text-sm animate-pulse">Initializing Table...</div>
                ) : liveState ? (
                  <>
                    {activePlayer && activePlayer.agentId && (
                      <div className="absolute -top-16 px-4 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-full backdrop-blur-sm animate-pulse flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-bold text-emerald-100 tracking-wider">
                          {activePlayer.agentId.replace("agent-", "").toUpperCase()}'S TURN
                        </span>
                      </div>
                    )}
                    {/* CommunityCards and PotBadge are now handled by the new "Community Cards" block above */}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <PotBadge amount={0} />
                    <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Waiting for players...</span>
                  </div>
                )}
              </div>
            </TableFelt>
          </div>
        </div>

        {/* Hero Action Controls - Integrated flush with bottom of the table area */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[800px] px-4 shrink-0 transition-opacity z-50 pointer-events-auto">
          {activePlayer && (
            <div className="bg-black/95 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl pb-2">
              <ActionControls 
                potAmount={liveState?.potAmount || 0}
                minBet={highestBet > 0 ? highestBet * 2 : 20}   // mock minbet
                playerChips={activePlayer.chips}
                canCheck={activePlayerCallAmount === 0}
                callAmount={activePlayerCallAmount}
                onAction={(act, amt) => console.log(`Action: ${act}`, amt ? `Amount: ${amt}` : "")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
