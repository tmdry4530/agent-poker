"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { CardGroup } from "@/components/playing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/lib/hooks";
import { formatChips } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface HandEvent {
  type: string;
  seq: number;
  handId: string;
  payload: Record<string, any>;
}

interface PlayerInfo {
  id: string;
  chips: number;
  holeCards: Array<{ rank: string; suit: string }>;
}

interface HandDetail {
  handId: string;
  events: HandEvent[];
  players: PlayerInfo[];
  communityCards: Array<{ rank: string; suit: string }>;
  winners: string[];
  potTotal: number;
  completedAt: number;
}

// Replay step state computed from events up to a given index
interface ReplayStep {
  eventIndex: number;
  event: HandEvent;
  board: Array<{ rank: string; suit: string }>;
  pot: number;
  playerBets: Record<string, number>;
  playerChips: Record<string, number>;
  playerCards: Record<string, Array<{ rank: string; suit: string }>>;
  actingPlayer: string | null;
  actionLabel: string;
  street: string;
}

function computeSteps(hand: HandDetail): ReplayStep[] {
  const steps: ReplayStep[] = [];
  let board: Array<{ rank: string; suit: string }> = [];
  let pot = 0;
  let playerBets: Record<string, number> = {};
  let playerChips: Record<string, number> = {};
  const playerCards: Record<string, Array<{ rank: string; suit: string }>> = {};
  let street = "preflop";

  // Initialize player chips
  for (const p of hand.players) {
    playerChips[p.id] = p.chips;
    playerBets[p.id] = 0;
    playerCards[p.id] = [];
  }

  for (let i = 0; i < hand.events.length; i++) {
    const event = hand.events[i]!;
    const p = event.payload;
    let actingPlayer: string | null = null;
    let actionLabel = "";

    switch (event.type) {
      case "HAND_START":
        actionLabel = "Hand started";
        break;
      case "BLINDS_POSTED": {
        const pid = String(p.playerId ?? "");
        const amount = Number(p.amount ?? 0);
        actingPlayer = pid;
        actionLabel = `${String(p.blindType ?? "blind")} ${amount}`;
        playerBets[pid] = (playerBets[pid] ?? 0) + amount;
        playerChips[pid] = (playerChips[pid] ?? 0) - amount;
        pot += amount;
        break;
      }
      case "HOLE_CARDS_DEALT": {
        const pid = String(p.playerId ?? "");
        actingPlayer = pid;
        actionLabel = "dealt cards";
        if (Array.isArray(p.cards)) {
          playerCards[pid] = p.cards as Array<{ rank: string; suit: string }>;
        }
        break;
      }
      case "COMMUNITY_CARDS_DEALT": {
        actionLabel = "Board dealt";
        if (Array.isArray(p.cards)) {
          board = [...board, ...(p.cards as Array<{ rank: string; suit: string }>)];
        }
        break;
      }
      case "PLAYER_ACTION": {
        const pid = String(p.playerId ?? "");
        const action = String(p.action ?? "");
        const amount = Number(p.amount ?? 0);
        actingPlayer = pid;
        actionLabel = amount > 0 ? `${action} ${amount}` : action;
        if (amount > 0) {
          playerBets[pid] = (playerBets[pid] ?? 0) + amount;
          playerChips[pid] = (playerChips[pid] ?? 0) - amount;
          pot += amount;
        }
        break;
      }
      case "STREET_CHANGED": {
        street = String(p.street ?? street);
        actionLabel = `Street: ${street}`;
        // Reset per-street bets
        playerBets = Object.fromEntries(Object.keys(playerBets).map((k) => [k, 0]));
        break;
      }
      case "SHOWDOWN":
        actionLabel = "Showdown";
        break;
      case "POT_DISTRIBUTED": {
        const winnerId = String(p.winnerId ?? "");
        const amount = Number(p.amount ?? 0);
        actingPlayer = winnerId;
        actionLabel = `wins ${amount}`;
        playerChips[winnerId] = (playerChips[winnerId] ?? 0) + amount;
        break;
      }
      case "HAND_END":
        actionLabel = "Hand complete";
        break;
      default:
        actionLabel = event.type;
    }

    steps.push({
      eventIndex: i,
      event,
      board: [...board],
      pot,
      playerBets: { ...playerBets },
      playerChips: { ...playerChips },
      playerCards: Object.fromEntries(
        Object.entries(playerCards).map(([k, v]) => [k, [...v]]),
      ),
      actingPlayer,
      actionLabel,
      street,
    });
  }

  return steps;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5] as const;

const eventIcons: Record<string, { color: string; label: string }> = {
  HAND_START: { color: "bg-blue-500", label: "Start" },
  BLINDS_POSTED: { color: "bg-yellow-500", label: "Blinds" },
  HOLE_CARDS_DEALT: { color: "bg-purple-500", label: "Deal" },
  COMMUNITY_CARDS_DEALT: { color: "bg-cyan-500", label: "Board" },
  PLAYER_ACTION: { color: "bg-primary", label: "Action" },
  STREET_CHANGED: { color: "bg-orange-500", label: "Street" },
  SHOWDOWN: { color: "bg-pink-500", label: "Showdown" },
  POT_DISTRIBUTED: { color: "bg-primary", label: "Pot" },
  HAND_END: { color: "bg-muted-foreground", label: "End" },
};

export default function HandDetailPage({
  params,
}: {
  params: Promise<{ id: string; handId: string }>;
}) {
  const { id, handId } = use(params);
  const fetcher = useCallback(async (): Promise<HandDetail | null> => {
    const API_BASE = (process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080").trim();
    const res = await fetch(`${API_BASE}/api/tables/${id}/hands/${encodeURIComponent(handId)}`);
    if (!res.ok) return null;
    return res.json();
  }, [id, handId]);
  const { data: hand, loading } = useApiData(fetcher, 0);

  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = hand ? computeSteps(hand) : [];
  const step = steps[currentStep] ?? null;
  const totalSteps = steps.length;

  // Auto-play logic
  useEffect(() => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    if (playing && totalSteps > 0) {
      const intervalMs = 1000 / speed;
      playTimerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= totalSteps - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [playing, speed, totalSteps]);

  function goToStart() {
    setCurrentStep(0);
    setPlaying(false);
  }
  function goToEnd() {
    setCurrentStep(Math.max(0, totalSteps - 1));
    setPlaying(false);
  }
  function goPrev() {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }
  function goNext() {
    setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
  }
  function togglePlay() {
    if (currentStep >= totalSteps - 1) {
      setCurrentStep(0);
      setPlaying(true);
    } else {
      setPlaying((prev) => !prev);
    }
  }

  function exportJson() {
    if (!hand) return;
    const blob = new Blob([JSON.stringify(hand, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hand-${hand.handId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/tables/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hand Replay</h1>
            <p className="text-muted-foreground font-mono text-sm">{handId}</p>
          </div>
        </div>
        {hand && (
          <Button variant="outline" size="sm" onClick={exportJson}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        )}
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
          {/* Main replay area */}
          <div className="md:col-span-2 space-y-4">
            {/* Board + Pot display */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{step?.street ?? "preflop"}</Badge>
                    <span className="text-sm text-muted-foreground">
                      Step {currentStep + 1} / {totalSteps}
                    </span>
                  </div>

                  {/* Community cards */}
                  <div className="flex items-center gap-1 min-h-[48px]">
                    {step && step.board.length > 0 ? (
                      <CardGroup cards={step.board} size="md" />
                    ) : (
                      <span className="text-sm text-muted-foreground">No board cards yet</span>
                    )}
                  </div>

                  {/* Pot */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Pot</p>
                    <p className="text-xl font-bold font-mono">{formatChips(step?.pot ?? 0)}</p>
                  </div>

                  {/* Current action */}
                  {step && (
                    <div className="flex items-center gap-2 rounded-md border px-4 py-2">
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          eventIcons[step.event.type]?.color ?? "bg-muted-foreground",
                        )}
                      />
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {eventIcons[step.event.type]?.label ?? step.event.type}
                      </span>
                      {step.actingPlayer && (
                        <span className="font-mono text-sm">
                          {step.actingPlayer.replace("agent-", "")}
                        </span>
                      )}
                      <span className="text-sm font-semibold">{step.actionLabel}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Player states */}
            <div className="grid gap-3 grid-cols-2">
              {hand.players.map((player) => {
                const isActing = step?.actingPlayer === player.id;
                const chips = step?.playerChips[player.id] ?? player.chips;
                const bet = step?.playerBets[player.id] ?? 0;
                const cards = step?.playerCards[player.id] ?? [];
                return (
                  <Card
                    key={player.id}
                    className={cn(
                      "transition-all",
                      isActing && "ring-2 ring-primary",
                    )}
                  >
                    <CardContent className="pt-4 pb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">
                          {player.id.replace("agent-", "")}
                        </span>
                        {isActing && <Badge variant="default">Acting</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {cards.length > 0 ? (
                          <CardGroup cards={cards} size="sm" />
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Chips: <span className="font-mono">{formatChips(chips)}</span>
                        </span>
                        {bet > 0 && (
                          <span className="text-muted-foreground">
                            Bet: <span className="font-mono text-primary">{formatChips(bet)}</span>
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Playback controls */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-center gap-2">
                  <Button variant="ghost" size="icon" onClick={goToStart} disabled={currentStep === 0}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={goPrev} disabled={currentStep === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="default" size="icon" onClick={togglePlay}>
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={goNext} disabled={currentStep >= totalSteps - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={goToEnd} disabled={currentStep >= totalSteps - 1}>
                    <SkipForward className="h-4 w-4" />
                  </Button>

                  <div className="ml-4 flex items-center gap-1 border-l pl-4">
                    <span className="text-xs text-muted-foreground mr-1">Speed:</span>
                    {SPEED_OPTIONS.map((s) => (
                      <Button
                        key={s}
                        variant={speed === s ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSpeed(s)}
                      >
                        {s}x
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all rounded-full"
                    style={{ width: totalSteps > 1 ? `${(currentStep / (totalSteps - 1)) * 100}%` : "0%" }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side panel: result + event timeline */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Winner</p>
                  <p className="font-mono font-semibold text-primary">
                    {hand.winners.map((w) => w.replace("agent-", "")).join(", ")}
                  </p>
                  <p className="font-mono text-lg font-bold mt-1">{formatChips(hand.potTotal)} pot</p>
                </div>
                {hand.communityCards.length > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-xs text-muted-foreground">Final Board</p>
                    <CardGroup cards={hand.communityCards} size="sm" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
                <CardDescription>{hand.events.length} total</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-2 pl-5 max-h-[400px] overflow-y-auto">
                  <div className="absolute left-2 top-1 h-[calc(100%-0.5rem)] w-px bg-border" />
                  {hand.events.map((event, i) => {
                    const info = eventIcons[event.type] ?? {
                      color: "bg-muted-foreground",
                      label: event.type,
                    };
                    const isCurrentEvent = i === currentStep;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={cn(
                          "relative flex items-start gap-2 w-full text-left rounded px-1 py-0.5 transition-colors",
                          isCurrentEvent
                            ? "bg-accent"
                            : "hover:bg-accent/50",
                          i > currentStep && "opacity-40",
                        )}
                        onClick={() => {
                          setCurrentStep(i);
                          setPlaying(false);
                        }}
                      >
                        <div
                          className={cn(
                            "absolute left-[-14px] top-2 h-2 w-2 rounded-full",
                            info.color,
                          )}
                        />
                        <div>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {info.label}
                          </span>
                          {event.type === "PLAYER_ACTION" && (
                            <span className="text-xs ml-1">
                              {String(event.payload.playerId ?? "").replace("agent-", "")}{" "}
                              {String(event.payload.action ?? "")}
                              {event.payload.amount ? ` ${event.payload.amount}` : ""}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
