"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { getAgents } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
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
import { formatTimestamp, formatChips } from "@/lib/utils";

function AgentStatusBadge({ status }: { status: string }) {
  const variant =
    status === "online"
      ? "default"
      : status === "banned"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function AgentsPage() {
  const router = useRouter();
  const fetcher = useCallback(() => getAgents(), []);
  const { data: agents, loading, error } = useApiData(fetcher, 5000);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Manage registered agents</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Agents</CardTitle>
          <CardDescription>
            {agents ? `${agents.length} agent${agents.length !== 1 ? "s" : ""}` : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive">Failed to load agents: {error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Make sure lobby-api is running on localhost:8080
              </p>
            </div>
          ) : agents && agents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Hands</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow
                    key={agent.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/agents/${agent.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{agent.id.slice(0, 12)}...</TableCell>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <AgentStatusBadge status={agent.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatChips(agent.balance)}</TableCell>
                    <TableCell className="text-right font-mono">{agent.totalHands}</TableCell>
                    <TableCell className="text-right font-mono">{(agent.winRate * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatTimestamp(agent.joinedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No agents registered</p>
              <p className="text-xs text-muted-foreground mt-1">
                Agents will appear here when they connect
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
