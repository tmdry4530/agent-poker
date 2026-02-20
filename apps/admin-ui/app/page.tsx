"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Table2, Hash, Bot, Plus, UserPlus, Coins } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { useDashboardWs } from "@/lib/use-dashboard-ws";
import { getTables } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { WsStatusIndicator } from "@/components/ws-status-indicator";
import { TableStatusBadge } from "@/components/table-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp, formatChips } from "@/lib/utils";

export default function DashboardPage() {
  const fetcher = useCallback(() => getTables(), []);
  const { data: tables, loading, error } = useApiData(fetcher, 10000);
  const { stats, wsStatus } = useDashboardWs();

  // Merge: prefer WS live data, fall back to HTTP polling data
  const activeTables =
    wsStatus === "connected"
      ? stats.activeTables
      : (tables?.filter((t) => t.status !== "closed").length ?? 0);
  const connectedAgents =
    wsStatus === "connected"
      ? stats.connectedAgents
      : new Set(
          tables?.flatMap((t) => t.seats.filter((s) => s.agentId).map((s) => s.agentId)) ?? [],
        ).size;
  const handsPerMinute = stats.handsPerMinute;
  const totalChipsInPlay =
    wsStatus === "connected"
      ? stats.totalChipsInPlay
      : (tables?.reduce(
          (sum, t) => sum + t.seats.reduce((s, seat) => s + seat.chips, 0),
          0,
        ) ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Agent Poker platform overview</p>
        </div>
        <WsStatusIndicator status={wsStatus} />
      </div>

      {loading && wsStatus !== "connected" ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : error && wsStatus !== "connected" ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to connect to lobby-api: {error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure lobby-api is running on localhost:8080
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Active Tables"
              value={activeTables}
              icon={Table2}
              description={`${tables?.length ?? 0} total`}
            />
            <StatCard
              title="Connected Agents"
              value={connectedAgents}
              icon={Bot}
              description="Currently seated"
            />
            <StatCard
              title="Hands / Min"
              value={handsPerMinute}
              icon={Hash}
              description="Rolling 5-min avg"
            />
            <StatCard
              title="Chips in Play"
              value={formatChips(totalChipsInPlay)}
              icon={Coins}
              description="Total across tables"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tables</CardTitle>
                <CardDescription>Latest table activity</CardDescription>
              </CardHeader>
              <CardContent>
                {tables && tables.length > 0 ? (
                  <div className="space-y-3">
                    {tables.slice(0, 5).map((table) => (
                      <Link
                        key={table.id}
                        href={`/tables/${table.id}`}
                        className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent/50"
                      >
                        <div>
                          <p className="text-sm font-mono font-medium">{table.id.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {table.variant} &middot; {table.maxSeats ?? 2}-max &middot; {formatTimestamp(table.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            {table.seats.filter((s) => s.agentId).length}/{table.maxSeats ?? 2}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {table.handsPlayed} hands
                          </span>
                          <TableStatusBadge status={table.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No tables yet. Create one to get started.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/tables">
                  <Button className="w-full justify-start gap-2" variant="outline">
                    <Plus className="h-4 w-4" />
                    Create Table
                  </Button>
                </Link>
                <Button className="w-full justify-start gap-2" variant="outline" disabled>
                  <UserPlus className="h-4 w-4" />
                  Register Agent
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
