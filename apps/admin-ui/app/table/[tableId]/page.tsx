"use client";

import { use, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { getTable } from "@/lib/api";
import { TableStatusBadge } from "@/components/table-status-badge";

const PokerTable = dynamic(
  () => import("@/components/poker/PokerTable").then(m => ({ default: m.PokerTable })),
  { loading: () => <Skeleton className="h-[500px] w-full" /> }
);

const HandHistoryList = dynamic(
  () => import("@/components/hand-history-list").then(m => ({ default: m.HandHistoryList })),
  { loading: () => <Skeleton className="h-[200px] w-full" /> }
);

export default function PokerTablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = use(params);
  const router = useRouter();
  const { agentId } = useAuth();
  const fetcher = useCallback(() => getTable(tableId), [tableId]);
  const { data: table } = useApiData(fetcher, 3000);

  // Check agent ownership — redirect if not seated at this table
  const isMyTable = table?.seats?.some((s) => s.agentId === agentId);
  if (table && !isMyTable) {
    router.push("/tables");
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tables">
            <Button variant="ghost" size="icon" className="h-[44px] w-[44px] shrink-0 hover:bg-zinc-800 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                High Stakes Table
              </h1>
              {table && <TableStatusBadge status={table.status} />}
            </div>
            <p className="text-zinc-500 font-mono text-[11px] uppercase mt-0.5 tracking-wider select-all cursor-copy" title="Click to copy ID">
              ID: {tableId}
            </p>
          </div>
        </div>
        {table && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Completed Hands: <span className="font-mono text-foreground">{table.handsPlayed}</span></span>
            <span>Variant: <span className="text-foreground">{table.variant}</span></span>
          </div>
        )}
      </div>

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="bg-transparent border-b border-white/10 w-full justify-start rounded-none h-12 p-0 gap-6">
          <TabsTrigger
            value="table"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 px-2 py-3 text-sm font-bold tracking-wider uppercase transition-all"
          >
            Table
          </TabsTrigger>
          <TabsTrigger
            value="hands"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-400 px-2 py-3 text-sm font-bold tracking-wider uppercase transition-all"
          >
            <List className="mr-2 h-4 w-4" />
            Hands
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-6 border border-zinc-800 rounded-xl bg-[#0a0a0a] overflow-hidden min-h-[850px] relative">
          <Suspense fallback={<Skeleton className="h-[800px] w-full bg-zinc-900" />}>
            <div className="pt-20 pb-10">
              <PokerTable tableId={tableId} />
            </div>
          </Suspense>
        </TabsContent>

        <TabsContent value="hands" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hand History</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-[200px] w-full" />}>
                <HandHistoryList tableId={tableId} />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
