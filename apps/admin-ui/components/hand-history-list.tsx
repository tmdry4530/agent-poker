"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useApiData } from "@/lib/hooks";
import { CardGroup } from "@/components/playing-card";
import { Badge } from "@/components/ui/badge";
import { formatChips } from "@/lib/utils";

interface HandSummary {
  handId: string;
  winners: string[];
  potTotal: number;
  players: Array<{ id: string; chips: number; holeCards: Array<{ rank: string; suit: string }> }>;
  communityCards: Array<{ rank: string; suit: string }>;
  completedAt: number;
}

async function fetchHands(tableId: string): Promise<HandSummary[]> {
  const API_BASE = process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080";
  const res = await fetch(`${API_BASE}/api/tables/${tableId}/hands`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.hands ?? [];
}

export function HandHistoryList({ tableId }: { tableId: string }) {
  const fetcher = useCallback(() => fetchHands(tableId), [tableId]);
  const { data: hands, loading } = useApiData(fetcher, 5000);

  if (loading) return <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>;
  if (!hands || hands.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No hands played yet.</p>;
  }

  return (
    <div className="space-y-2">
      {[...hands].reverse().map((hand, idx) => (
        <Link
          key={hand.handId}
          href={`/tables/${tableId}/hands/${encodeURIComponent(hand.handId)}`}
          className="block rounded-lg border p-3 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Hand #{hands.length - idx}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Pot: {formatChips(hand.potTotal)}
              </span>
              <Badge variant="default" className="text-[10px]">
                {hand.winners.join(", ")}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hand.communityCards.length > 0 && (
                <CardGroup cards={hand.communityCards} size="sm" />
              )}
            </div>
            <div className="flex gap-3">
              {hand.players.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono">{p.id.replace("agent-", "")}</span>
                  {p.holeCards.length > 0 && <CardGroup cards={p.holeCards} size="sm" />}
                </div>
              ))}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
