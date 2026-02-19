"use client";

import { useCallback } from "react";
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

// 6-seat positions (percentages): top, top-right, bottom-right, bottom, bottom-left, top-left
const seatPositions = [
  { top: "8%", left: "50%" },   // top center
  { top: "25%", left: "88%" },  // top right
  { top: "70%", left: "88%" },  // bottom right
  { top: "88%", left: "50%" },  // bottom center
  { top: "70%", left: "12%" },  // bottom left
  { top: "25%", left: "12%" },  // top left
];

const betPositions = [
  { top: "25%", left: "50%" },
  { top: "35%", left: "72%" },
  { top: "60%", left: "72%" },
  { top: "72%", left: "50%" },
  { top: "60%", left: "28%" },
  { top: "35%", left: "28%" },
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

  // Build 6 seat slots (HU uses 2, rest are empty)
  const seats: SeatData[] = Array.from({ length: 6 }, (_, i): SeatData => {
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
        ? liveState.players[liveState.activePlayerIndex]?.id === raw.agentId && !liveState.isHandComplete
        : false,
      isWinner: liveState?.winners.includes(raw.agentId) ?? false,
      status: raw.status ?? "seated",
    };
  });

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
