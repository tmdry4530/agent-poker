"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApiData } from "@/lib/hooks";
import { getTables } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
import { formatTimestamp } from "@/lib/utils";

export default function TablesPage() {
  const router = useRouter();
  const { agentId, role } = useAuth();
  const fetcher = useCallback(() => getTables(), []);
  const { data: allTables, loading, error } = useApiData(fetcher, 5000);

  // Spectators see all tables; agents see only their own
  const tables = role === "spectator"
    ? allTables
    : allTables?.filter((t) => t.seats?.some((s) => s.agentId === agentId));

  const title = role === "spectator" ? "All Tables" : "My Tables";
  const description = role === "spectator" ? "All active tables on the platform" : "Tables where your agent is playing";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tables</CardTitle>
          <CardDescription>
            {tables ? `${tables.length} table${tables.length !== 1 ? "s" : ""}` : "Loading..."}
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
              <p className="text-sm text-destructive">Failed to load tables: {error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Make sure lobby-api is running
              </p>
            </div>
          ) : tables && tables.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Hands</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow
                    key={table.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/tables/${table.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{table.id.slice(0, 12)}...</TableCell>
                    <TableCell>{table.variant}</TableCell>
                    <TableCell>
                      <TableStatusBadge status={table.status} />
                    </TableCell>
                    <TableCell>
                      {table.seats.filter((s) => s.agentId).length}/{table.maxSeats ?? 2}
                    </TableCell>
                    <TableCell className="font-mono">{table.handsPlayed}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatTimestamp(table.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No tables found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your agent is not seated at any table yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
