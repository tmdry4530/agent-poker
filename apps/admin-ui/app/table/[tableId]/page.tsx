"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, List } from "lucide-react";
import { PokerTable } from "@/components/poker/PokerTable";
import { HandHistoryList } from "@/components/hand-history-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiData } from "@/lib/hooks";
import { getTable } from "@/lib/api";
import { TableStatusBadge } from "@/components/table-status-badge";

export default function PokerTablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = use(params);
  const fetcher = useCallback(() => getTable(tableId), [tableId]);
  const { data: table } = useApiData(fetcher, 3000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tables">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              Table View
              {table && <TableStatusBadge status={table.status} />}
            </h1>
            <p className="text-muted-foreground font-mono text-xs">{tableId}</p>
          </div>
        </div>
        {table && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Hands: <span className="font-mono text-foreground">{table.handsPlayed}</span></span>
            <span>Variant: <span className="text-foreground">{table.variant}</span></span>
          </div>
        )}
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="hands">
            <List className="mr-1.5 h-3.5 w-3.5" />
            Hands
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <PokerTable tableId={tableId} />
        </TabsContent>

        <TabsContent value="hands" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hand History</CardTitle>
            </CardHeader>
            <CardContent>
              <HandHistoryList tableId={tableId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
