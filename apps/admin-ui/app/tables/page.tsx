"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { getTables, createTable } from "@/lib/api";
import { TableStatusBadge } from "@/components/table-status-badge";
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

export default function TablesPage() {
  const router = useRouter();
  const fetcher = useCallback(() => getTables(), []);
  const { data: tables, loading, error, refresh } = useApiData(fetcher, 5000);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const table = await createTable();
      refresh();
      router.push(`/tables/${table.id}`);
    } catch {
      // error handled by useApiData on next poll
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tables</h1>
          <p className="text-muted-foreground">Manage poker tables</p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="mr-2 h-4 w-4" />
          {creating ? "Creating..." : "Create Table"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tables</CardTitle>
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
                Make sure lobby-api is running on localhost:8080
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
                      {table.seats.filter((s) => s.agentId).length}/2
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
              <p className="text-sm text-muted-foreground">No tables yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a table to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
