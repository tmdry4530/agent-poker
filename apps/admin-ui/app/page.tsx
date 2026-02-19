"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Table2, Hash, Bot, Plus, UserPlus } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { getTables } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { TableStatusBadge } from "@/components/table-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/utils";

export default function DashboardPage() {
  const fetcher = useCallback(() => getTables(), []);
  const { data: tables, loading, error } = useApiData(fetcher, 5000);

  const activeTables = tables?.filter((t) => t.status !== "closed").length ?? 0;
  const totalHands = tables?.reduce((sum, t) => sum + t.handsPlayed, 0) ?? 0;
  const uniqueAgents = new Set(
    tables?.flatMap((t) => t.seats.filter((s) => s.agentId).map((s) => s.agentId)) ?? [],
  ).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Agent Poker platform overview</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : error ? (
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
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="Active Tables" value={activeTables} icon={Table2} description={`${tables?.length ?? 0} total`} />
            <StatCard title="Total Hands" value={totalHands} icon={Hash} description="Across all tables" />
            <StatCard title="Agents" value={uniqueAgents} icon={Bot} description="Unique agents seated" />
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
                            {table.variant} &middot; {formatTimestamp(table.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
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
