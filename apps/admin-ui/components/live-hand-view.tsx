"use client";

import { useCallback } from "react";
import { useApiData } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardGroup } from "@/components/playing-card";
import { formatChips } from "@/lib/utils";

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
}

async function fetchState(tableId: string): Promise<LiveState | null> {
  const API_BASE = process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080";
  const res = await fetch(`${API_BASE}/api/tables/${tableId}/state`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.state ?? null;
}

export function LiveHandView({ tableId }: { tableId: string }) {
  const fetcher = useCallback(() => fetchState(tableId), [tableId]);
  const { data: state, loading } = useApiData(fetcher, 2000);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Loading live state...
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No active hand. Waiting for next hand...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Live Hand</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{state.street}</Badge>
            {state.isHandComplete && <Badge variant="default">Complete</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Community Cards */}
        <div className="flex flex-col items-center gap-2 py-3 rounded-lg bg-primary/5 border border-primary/10">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Community</span>
          {state.communityCards.length > 0 ? (
            <CardGroup cards={state.communityCards} />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          <span className="text-sm font-mono font-semibold">
            Pot: {formatChips(state.potAmount)}
          </span>
        </div>

        {/* Players */}
        <div className="grid grid-cols-2 gap-3">
          {state.players.map((player, idx) => {
            const isActive = state.activePlayerIndex === idx && !state.isHandComplete;
            const isWinner = state.winners.includes(player.id);
            return (
              <div
                key={player.id}
                className={`rounded-lg border p-3 space-y-2 transition-colors ${
                  isActive ? "border-primary bg-primary/5" : ""
                } ${isWinner ? "border-primary bg-primary/10" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium truncate">{player.id}</span>
                  {isActive && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                  {isWinner && <Badge variant="default" className="text-[10px] px-1.5 py-0">Win</Badge>}
                  {player.hasFolded && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Fold</Badge>}
                  {player.isAllIn && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">All-in</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  {player.holeCards.length > 0 ? (
                    <CardGroup cards={player.holeCards} size="sm" />
                  ) : (
                    <CardGroup cards={[{rank:"?",suit:"?"},{rank:"?",suit:"?"}]} faceDown size="sm" />
                  )}
                  <div className="text-right">
                    <p className="font-mono text-xs">{formatChips(player.chips)}</p>
                    {player.currentBet > 0 && (
                      <p className="font-mono text-[10px] text-muted-foreground">bet: {player.currentBet}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
