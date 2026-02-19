"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { CardGroup } from "@/components/playing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/lib/hooks";
import { formatChips } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface HandDetail {
  handId: string;
  events: Array<{ type: string; seq: number; handId: string; payload: Record<string, any> }>;
  players: Array<{ id: string; chips: number; holeCards: Array<{ rank: string; suit: string }> }>;
  communityCards: Array<{ rank: string; suit: string }>;
  winners: string[];
  potTotal: number;
  completedAt: number;
}

const eventIcons: Record<string, { color: string; label: string }> = {
  HAND_START: { color: "bg-blue-500", label: "Hand Start" },
  BLINDS_POSTED: { color: "bg-yellow-500", label: "Blinds" },
  HOLE_CARDS_DEALT: { color: "bg-purple-500", label: "Deal" },
  COMMUNITY_CARDS_DEALT: { color: "bg-cyan-500", label: "Board" },
  PLAYER_ACTION: { color: "bg-primary", label: "Action" },
  STREET_CHANGED: { color: "bg-orange-500", label: "Street" },
  SHOWDOWN: { color: "bg-pink-500", label: "Showdown" },
  POT_DISTRIBUTED: { color: "bg-primary", label: "Pot" },
  HAND_END: { color: "bg-muted-foreground", label: "End" },
};

function EventDescription({ event }: { event: HandDetail["events"][0] }) {
  const p = event.payload;
  switch (event.type) {
    case "HAND_START":
      return <span>Hand started</span>;
    case "BLINDS_POSTED":
      return <span><span className="font-mono">{String(p.playerId ?? "").replace("agent-","")}</span> posts {String(p.blindType ?? "")} <span className="font-mono">{p.amount}</span></span>;
    case "HOLE_CARDS_DEALT":
      return (
        <span className="flex items-center gap-2">
          <span className="font-mono">{String(p.playerId ?? "").replace("agent-","")}</span> dealt
          {Array.isArray(p.cards) && <CardGroup cards={p.cards as any} size="sm" />}
        </span>
      );
    case "COMMUNITY_CARDS_DEALT":
      return (
        <span className="flex items-center gap-2">
          Board:
          {Array.isArray(p.cards) && <CardGroup cards={p.cards as any} size="sm" />}
        </span>
      );
    case "PLAYER_ACTION":
      return (
        <span>
          <span className="font-mono">{String(p.playerId ?? "").replace("agent-","")}</span>{" "}
          <span className="font-semibold">{String(p.action ?? "")}</span>
          {p.amount ? <span className="font-mono ml-1">{String(p.amount)}</span> : null}
        </span>
      );
    case "STREET_CHANGED":
      return <span>Street: <span className="font-semibold">{String(p.street ?? "")}</span></span>;
    case "SHOWDOWN":
      return <span>Showdown</span>;
    case "POT_DISTRIBUTED":
      return (
        <span>
          <span className="font-mono">{String(p.winnerId ?? "").replace("agent-","")}</span> wins{" "}
          <span className="font-mono font-semibold">{String(p.amount ?? "")}</span>
        </span>
      );
    case "HAND_END":
      return <span>Hand complete</span>;
    default:
      return <span>{event.type}</span>;
  }
}

export default function HandDetailPage({
  params,
}: {
  params: Promise<{ id: string; handId: string }>;
}) {
  const { id, handId } = use(params);
  const fetcher = useCallback(async (): Promise<HandDetail | null> => {
    const API_BASE = process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080";
    const res = await fetch(`${API_BASE}/api/tables/${id}/hands/${encodeURIComponent(handId)}`);
    if (!res.ok) return null;
    return res.json();
  }, [id, handId]);
  const { data: hand, loading } = useApiData(fetcher, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/tables/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hand Detail</h1>
          <p className="text-muted-foreground font-mono text-sm">{handId}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !hand ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Hand not found or event data unavailable.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>{hand.events.length} events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-3 pl-6">
                  <div className="absolute left-2.5 top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
                  {hand.events.map((event, i) => {
                    const info = eventIcons[event.type] ?? { color: "bg-muted-foreground", label: event.type };
                    return (
                      <div key={i} className="relative flex items-start gap-3">
                        <div className={cn("absolute left-[-18px] top-1.5 h-2.5 w-2.5 rounded-full", info.color)} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{info.label}</span>
                          </div>
                          <div className="text-sm mt-0.5">
                            <EventDescription event={event} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Winner</p>
                  <p className="font-mono font-semibold text-primary">{hand.winners.join(", ")}</p>
                  <p className="font-mono text-lg font-bold mt-1">{formatChips(hand.potTotal)} pot</p>
                </div>
                {hand.communityCards.length > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-xs text-muted-foreground">Board</p>
                    <CardGroup cards={hand.communityCards} size="sm" />
                  </div>
                )}
                <div className="space-y-2 pt-2 border-t">
                  {hand.players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{p.id.replace("agent-","")}</span>
                        {p.holeCards.length > 0 && <CardGroup cards={p.holeCards} size="sm" />}
                      </div>
                      <span className="font-mono text-xs">{formatChips(p.chips)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Replay</CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" disabled>
                  <Play className="mr-2 h-4 w-4" />
                  Replay Verification
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Coming in future update
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
