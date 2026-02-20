"use client";

import { useCallback, useMemo } from "react";
import { useApiData } from "@/lib/hooks";
import { TableFelt } from "./TableFelt";
import { Seat, type SeatData } from "./Seat";
import { CommunityCards } from "./CommunityCards";
import { PotBadge } from "./PotBadge";
import { ActionTicker } from "./ActionTicker";

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

// Position calculation for 2-8 players
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
    positions.set((dealerIndex + 3) % playerCount, "CO");
  } else if (playerCount === 5) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
    positions.set((dealerIndex + 3) % playerCount, "UTG");
    positions.set((dealerIndex + 4) % playerCount, "CO");
  } else if (playerCount === 6) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
    positions.set((dealerIndex + 3) % playerCount, "UTG");
    positions.set((dealerIndex + 4) % playerCount, "HJ");
    positions.set((dealerIndex + 5) % playerCount, "CO");
  } else if (playerCount === 7) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
    positions.set((dealerIndex + 3) % playerCount, "UTG");
    positions.set((dealerIndex + 4) % playerCount, "UTG1");
    positions.set((dealerIndex + 5) % playerCount, "HJ");
    positions.set((dealerIndex + 6) % playerCount, "CO");
  } else if (playerCount >= 8) {
    positions.set(dealerIndex, "BTN");
    positions.set((dealerIndex + 1) % playerCount, "SB");
    positions.set((dealerIndex + 2) % playerCount, "BB");
    positions.set((dealerIndex + 3) % playerCount, "UTG");
    positions.set((dealerIndex + 4) % playerCount, "UTG1");
    positions.set((dealerIndex + 5) % playerCount, "MP");
    positions.set((dealerIndex + 6) % playerCount, "HJ");
    positions.set((dealerIndex + 7) % playerCount, "CO");
  }

  return positions;
}

// 8-seat positions (percentages): top, top-right, right, bottom-right, bottom, bottom-left, left, top-left
const seatPositions = [
  { top: "8%", left: "50%" },    // 0: top center
  { top: "20%", left: "82%" },   // 1: top right
  { top: "50%", left: "92%" },   // 2: right
  { top: "80%", left: "82%" },   // 3: bottom right
  { top: "92%", left: "50%" },   // 4: bottom center
  { top: "80%", left: "18%" },   // 5: bottom left
  { top: "50%", left: "8%" },    // 6: left
  { top: "20%", left: "18%" },   // 7: top left
];

const betPositions = [
  { top: "22%", left: "50%" },   // 0
  { top: "30%", left: "68%" },   // 1
  { top: "50%", left: "76%" },   // 2
  { top: "70%", left: "68%" },   // 3
  { top: "78%", left: "50%" },   // 4
  { top: "70%", left: "32%" },   // 5
  { top: "50%", left: "24%" },   // 6
  { top: "30%", left: "32%" },   // 7
];

async function fetchTableState(tableId: string): Promise<{ liveState: LiveState | null; seats: any[] }> {
  const API_BASE = process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080";

  const [stateRes, tableRes] = await Promise.all([
    fetch(`${API_BASE}/api/tables/${tableId}/state`).then(r => r.ok ? r.json() : { state: null }),
    fetch(`${API_BASE}/api/tables/${tableId}`).then(r => r.ok ? r.json() : { seats: [] }),
  ]);

  return {
    liveState: stateRes.state ?? null,
    seats: tableRes.seats ?? [],
  };
}

export function PokerTable({ tableId }: { tableId: string }) {
  const fetcher = useCallback(() => fetchTableState(tableId), [tableId]);
  const { data, loading } = useApiData(fetcher, 2000);

  const liveState = data?.liveState ?? null;
  const rawSeats = data?.seats ?? [];

  // Build 8 seat slots (dynamically from table config)
  const maxSeats = 8;
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

  // Extract last action from live state events (if we had them)
  const lastAction = liveState?.lastAction ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <TableFelt>
        {/* Seats */}
        {seats.map((seat, i) => (
          <Seat
            key={i}
            seat={seat}
            position={seatPositions[i]!}
            betPosition={betPositions[i]}
          />
        ))}

        {/* Center area: community cards + pot */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2"
        >
          {loading ? (
            <div className="text-zinc-400 text-sm">Loading...</div>
          ) : liveState ? (
            <>
              <CommunityCards cards={liveState.communityCards} />
              <PotBadge amount={liveState.potAmount} street={liveState.street} />
              <ActionTicker lastAction={lastAction} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <PotBadge amount={0} />
              <span className="text-[11px] text-zinc-500">Waiting for hand...</span>
            </div>
          )}
        </div>
      </TableFelt>
    </div>
  );
}
