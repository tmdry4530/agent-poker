"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { getAgent, banAgent, unbanAgent } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { PnlChartCard } from "@/components/pnl-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp, formatChips } from "@/lib/utils";

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fetcher = useCallback(() => getAgent(id), [id]);
  const { data: agent, loading, error, refresh } = useApiData(fetcher, 5000);
  const [actionPending, setActionPending] = useState(false);

  async function handleBanToggle() {
    if (!agent) return;
    setActionPending(true);
    try {
      if (agent.status === "banned") {
        await unbanAgent(id);
      } else {
        await banAgent(id);
      }
      refresh();
    } catch {
      // error handled by polling
    } finally {
      setActionPending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/agents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Button>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {error ?? "Agent not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            <p className="text-xs font-mono text-muted-foreground">{agent.id}</p>
          </div>
          <Badge
            variant={agent.status === "online" ? "default" : agent.status === "banned" ? "destructive" : "secondary"}
          >
            {agent.status}
          </Badge>
        </div>
        <Button
          variant={agent.status === "banned" ? "default" : "destructive"}
          size="sm"
          onClick={handleBanToggle}
          disabled={actionPending}
        >
          {agent.status === "banned" ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              {actionPending ? "Unbanning..." : "Unban"}
            </>
          ) : (
            <>
              <Ban className="mr-2 h-4 w-4" />
              {actionPending ? "Banning..." : "Ban Agent"}
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Balance" value={formatChips(agent.balance)} description="Current chips" />
        <StatCard title="Total Hands" value={agent.totalHands} description="All time" />
        <StatCard title="Win Rate" value={`${(agent.winRate * 100).toFixed(1)}%`} description="Showdown wins" />
        <StatCard title="Joined" value={formatTimestamp(agent.joinedAt)} description="Registration date" />
      </div>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">P/L Chart</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="hands">Hand History</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl" className="mt-4">
          <PnlChartCard pnlHistory={agent.pnlHistory ?? []} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>{agent.sessions?.length ?? 0} sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {agent.sessions && agent.sessions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead className="text-right">Hands</TableHead>
                      <TableHead className="text-right">P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agent.sessions.map((session) => (
                      <TableRow key={session.sessionId}>
                        <TableCell className="font-mono text-xs">
                          {session.tableId.slice(0, 12)}...
                        </TableCell>
                        <TableCell className="text-xs">{formatTimestamp(session.startedAt)}</TableCell>
                        <TableCell className="text-xs">
                          {session.endedAt ? formatTimestamp(session.endedAt) : "Active"}
                        </TableCell>
                        <TableCell className="text-right font-mono">{session.handsPlayed}</TableCell>
                        <TableCell className={`text-right font-mono ${session.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {session.pnl >= 0 ? "+" : ""}{formatChips(session.pnl)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No sessions yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hands" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hand History</CardTitle>
              <CardDescription>Filtered by this agent</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-4 text-center">
                Hand history for this agent will be shown here once available from the API.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
