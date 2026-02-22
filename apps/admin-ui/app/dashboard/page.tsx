"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Coins, Hash, TrendingUp, Table2, Users, Timer, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApiData } from "@/lib/hooks";
import { getAgent, getAgents, getTables, getStats } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { PnlChartCard } from "@/components/pnl-chart";
import { TableStatusBadge } from "@/components/table-status-badge";
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
import { formatChips, formatTimestamp } from "@/lib/utils";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px]" />
        ))}
      </div>
      <Skeleton className="h-[300px]" />
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/* ── Spectator Dashboard ── */
function SpectatorDashboard() {
  const tablesFetcher = useCallback(() => getTables(), []);
  const statsFetcher = useCallback(() => getStats(), []);
  const agentsFetcher = useCallback(() => getAgents(), []);

  const { data: tables, loading: tablesLoading } = useApiData(tablesFetcher, 5000);
  const { data: stats, loading: statsLoading } = useApiData(statsFetcher, 5000);
  const { data: agents, loading: agentsLoading } = useApiData(agentsFetcher, 10000);

  if (tablesLoading || statsLoading || agentsLoading) return <LoadingSkeleton />;

  const allTables = tables ?? [];
  const runningTables = allTables.filter((t) => t.status === "running");
  const activeTables = (stats as any)?.activeTables ?? runningTables.length;
  const totalTables = (stats as any)?.totalTables ?? allTables.length;
  const connectedAgents = (stats as any)?.connectedAgents ?? 0;
  const handsPerMinute = (stats as any)?.handsPerMinute ?? 0;
  const uptime = (stats as any)?.uptime ?? 0;
  const totalHandsPlayed = (stats as any)?.totalHandsPlayed ?? 0;

  const sortedAgents = [...(agents ?? [])].sort((a, b) => b.balance - a.balance);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>

      {/* Platform Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Active Tables"
          value={`${activeTables} / ${totalTables}`}
          description="Running / Total"
          icon={Table2}
        />
        <StatCard
          title="Connected Agents"
          value={connectedAgents}
          description="Currently seated"
          icon={Users}
        />
        <StatCard
          title="Hands / min"
          value={handsPerMinute}
          description={`${totalHandsPlayed} total`}
          icon={Activity}
        />
        <StatCard
          title="Uptime"
          value={formatUptime(uptime)}
          description="Server uptime"
          icon={Timer}
        />
      </div>

      {/* Running Tables */}
      <Card>
        <CardHeader>
          <CardTitle>Running Tables</CardTitle>
          <CardDescription>{allTables.filter((t) => t.status !== "closed").length} table(s) in play</CardDescription>
        </CardHeader>
        <CardContent>
          {allTables.filter((t) => t.status !== "closed").length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table ID</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Players</TableHead>
                  <TableHead className="text-right">Hands</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTables.filter((t) => t.status !== "closed").map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/table/${t.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {t.id.slice(0, 12)}...
                      </Link>
                    </TableCell>
                    <TableCell>{t.variant}</TableCell>
                    <TableCell><TableStatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-right font-mono">
                      {t.seats.filter((s) => s.status === "seated").length}/{t.maxSeats ?? t.seats.length}
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.handsPlayed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No running tables</p>
          )}
        </CardContent>
      </Card>

      {/* Closed Tables */}
      {allTables.filter((t) => t.status === "closed").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Closed Tables</CardTitle>
            <CardDescription>{allTables.filter((t) => t.status === "closed").length} table(s) finished</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table ID</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Players</TableHead>
                  <TableHead className="text-right">Hands</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTables.filter((t) => t.status === "closed").map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/table/${t.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {t.id.slice(0, 12)}...
                      </Link>
                    </TableCell>
                    <TableCell>{t.variant}</TableCell>
                    <TableCell><TableStatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-right font-mono">
                      {t.seats.filter((s) => s.status === "seated").length}/{t.maxSeats ?? t.seats.length}
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.handsPlayed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Agent Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Leaderboard</CardTitle>
          <CardDescription>{sortedAgents.length} registered agent(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedAgents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Hands</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAgents.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{a.name || a.id}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        a.status === "online" ? "text-emerald-500" :
                        a.status === "banned" ? "text-red-500" : "text-zinc-500"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          a.status === "online" ? "bg-emerald-500" :
                          a.status === "banned" ? "bg-red-500" : "bg-zinc-500"
                        }`} />
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatChips(a.balance)}</TableCell>
                    <TableCell className="text-right font-mono">{a.totalHands}</TableCell>
                    <TableCell className="text-right font-mono">{(a.winRate * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No agents registered</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Agent Dashboard (existing) ── */
function AgentDashboard() {
  const { agentId } = useAuth();

  const agentFetcher = useCallback(
    () => (agentId ? getAgent(agentId) : Promise.reject("No agent")),
    [agentId],
  );
  const tablesFetcher = useCallback(() => getTables(), []);

  const { data: agent, loading: agentLoading } = useApiData(agentFetcher, 5000);
  const { data: tables, loading: tablesLoading } = useApiData(tablesFetcher, 5000);

  const activeTables = tables?.filter((t) =>
    t.seats.some((s) => s.agentId === agentId && s.status === "seated"),
  ) ?? [];

  if (agentLoading || tablesLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Balance"
          value={agent ? formatChips(agent.balance) : "\u2014"}
          description="Current chips"
          icon={Coins}
        />
        <StatCard
          title="Total Hands"
          value={agent?.totalHands ?? "\u2014"}
          description="All time"
          icon={Hash}
        />
        <StatCard
          title="Win Rate"
          value={agent ? `${(agent.winRate * 100).toFixed(1)}%` : "\u2014"}
          description="Showdown wins"
          icon={TrendingUp}
        />
        <StatCard
          title="Active Tables"
          value={activeTables.length}
          description="Currently playing"
          icon={Table2}
        />
      </div>

      {/* Active Tables */}
      {activeTables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Tables</CardTitle>
            <CardDescription>{activeTables.length} table(s) in play</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table ID</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Players</TableHead>
                  <TableHead className="text-right">Hands</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTables.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/tables/${t.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {t.id.slice(0, 12)}...
                      </Link>
                    </TableCell>
                    <TableCell>{t.variant}</TableCell>
                    <TableCell><TableStatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-right font-mono">
                      {t.seats.filter((s) => s.status === "seated").length}/{t.maxSeats ?? t.seats.length}
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.handsPlayed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* P/L Chart */}
      {agent?.pnlHistory && (
        <PnlChartCard pnlHistory={agent.pnlHistory} />
      )}

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>{agent?.sessions?.length ?? 0} sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {agent?.sessions && agent.sessions.length > 0 ? (
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
    </div>
  );
}

/* ── Main Dashboard (role-aware) ── */
export default function DashboardPage() {
  const { role } = useAuth();

  if (role === "spectator") {
    return <SpectatorDashboard />;
  }

  return <AgentDashboard />;
}
