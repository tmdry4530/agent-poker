"use client";

import { useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Hash, Clock, Layers, Spade } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { getTable } from "@/lib/api";
import { TableStatusBadge } from "@/components/table-status-badge";
import { SeatsDisplay } from "@/components/seats-display";
import { LiveHandView } from "@/components/live-hand-view";
import { HandHistoryList } from "@/components/hand-history-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/utils";

export default function TableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const fetcher = useCallback(() => getTable(id), [id]);
  const { data: table, loading, error } = useApiData(fetcher, 3000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tables">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Table Detail</h1>
            <p className="text-muted-foreground font-mono text-sm">{id}</p>
          </div>
        </div>
        <Link href={`/table/${id}`}>
          <Button variant="outline" size="sm">
            <Spade className="mr-2 h-4 w-4" />
            Table View
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : error ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load table: {error}</p>
          </CardContent>
        </Card>
      ) : table ? (
        <Tabs defaultValue="live">
          <TabsList>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="seats">Seats</TabsTrigger>
            <TabsTrigger value="hands">Hands</TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <LiveHandView tableId={id} />
          </TabsContent>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Table Info
                  <TableStatusBadge status={table.status} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Variant
                    </dt>
                    <dd className="text-sm font-medium mt-1">{table.variant}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Created
                    </dt>
                    <dd className="text-sm font-medium mt-1">{formatTimestamp(table.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Hands Played
                    </dt>
                    <dd className="text-sm font-mono font-medium mt-1">{table.handsPlayed}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Current Hand</dt>
                    <dd className="text-sm font-mono font-medium mt-1">
                      {table.currentHandId ? (
                        <Link
                          href={`/tables/${table.id}/hands/${table.currentHandId}`}
                          className="text-primary hover:underline"
                        >
                          {table.currentHandId.slice(0, 12)}...
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seats">
            <Card>
              <CardHeader>
                <CardTitle>Seats</CardTitle>
                <CardDescription>
                  {table.seats.filter((s) => s.agentId).length}/2 occupied
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SeatsDisplay seats={table.seats} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hands">
            <Card>
              <CardHeader>
                <CardTitle>Hands</CardTitle>
                <CardDescription>
                  {table.handsPlayed} hand{table.handsPlayed !== 1 ? "s" : ""} played
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HandHistoryList tableId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
