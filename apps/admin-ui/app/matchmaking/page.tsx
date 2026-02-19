"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Layers, Zap } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { getMatchmakingStatus, triggerManualMatch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/utils";

export default function MatchmakingPage() {
  const router = useRouter();
  const fetcher = useCallback(() => getMatchmakingStatus(), []);
  const { data, loading, error, refresh } = useApiData(fetcher, 3000);
  const [matching, setMatching] = useState<string | null>(null);

  async function handleManualMatch(blindLevel: string) {
    setMatching(blindLevel);
    try {
      const result = await triggerManualMatch(blindLevel);
      refresh();
      if (result.tableId) {
        router.push(`/tables/${result.tableId}`);
      }
    } catch {
      // handled by polling
    } finally {
      setMatching(null);
    }
  }

  function formatWaitTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matchmaking</h1>
          <p className="text-muted-foreground">Queue status and manual matching</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      ) : error ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load matchmaking status: {error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure lobby-api is running on localhost:8080
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Queue status */}
          <Card>
            <CardHeader>
              <CardTitle>Current Queue</CardTitle>
              <CardDescription>Agents waiting by blind level</CardDescription>
            </CardHeader>
            <CardContent>
              {data && data.queues.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Blind Level</TableHead>
                      <TableHead className="text-right">In Queue</TableHead>
                      <TableHead className="text-right">Avg Wait</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.queues.map((queue) => (
                      <TableRow key={queue.blindLevel}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{queue.blindLevel}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ({queue.smallBlind}/{queue.bigBlind})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={queue.count >= 2 ? "default" : "secondary"}>
                            {queue.count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-mono">
                              {formatWaitTime(queue.avgWaitTimeSec)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={queue.count < 2 || matching !== null}
                            onClick={() => handleManualMatch(queue.blindLevel)}
                          >
                            <Zap className="mr-1 h-3 w-3" />
                            {matching === queue.blindLevel ? "Matching..." : "Match Now"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No agents in queue</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agents will appear here when they join the matchmaking queue
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent auto-created tables */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
              <CardDescription>Auto-created tables in the last hour</CardDescription>
            </CardHeader>
            <CardContent>
              {data && data.recentMatches.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Blind Level</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentMatches.map((match) => (
                      <TableRow
                        key={match.tableId}
                        className="cursor-pointer"
                        onClick={() => router.push(`/tables/${match.tableId}`)}
                      >
                        <TableCell className="font-mono text-xs">
                          {match.tableId.slice(0, 12)}...
                        </TableCell>
                        <TableCell>{match.blindLevel}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {match.players.map((p) => (
                              <Badge key={p} variant="secondary" className="text-xs font-mono">
                                {p.replace("agent-", "").slice(0, 8)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatTimestamp(match.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No recent matches</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
