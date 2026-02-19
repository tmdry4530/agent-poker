"use client";

import { useCallback } from "react";
import { Activity, AlertTriangle, CheckCircle, Database, Server, Wifi, XCircle } from "lucide-react";
import { useApiData } from "@/lib/hooks";
import { getReadyz, getStats, getAdminErrors } from "@/lib/api";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function HealthStatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle className="h-4 w-4 text-green-500" />
  ) : (
    <XCircle className="h-4 w-4 text-red-500" />
  );
}

export default function SystemPage() {
  const readyzFetcher = useCallback(() => getReadyz(), []);
  const statsFetcher = useCallback(() => getStats(), []);
  const errorsFetcher = useCallback(() => getAdminErrors(), []);

  const { data: health, loading: healthLoading, error: healthError } = useApiData(readyzFetcher, 10000);
  const { data: stats, loading: statsLoading } = useApiData(statsFetcher, 10000);
  const { data: errorsData, loading: errorsLoading } = useApiData(errorsFetcher, 15000);

  const isHealthy = health?.status === "ok" || health?.status === "healthy";
  const uptime = typeof health?.uptime === "number" ? health.uptime : 0;
  const activeWsConnections = typeof stats?.activeWsConnections === "number" ? stats.activeWsConnections : (typeof stats?.wsConnections === "number" ? stats.wsConnections : 0);
  const dbStatus = typeof stats?.dbStatus === "string" ? stats.dbStatus : (typeof health?.db === "string" ? health.db : "unknown");
  const errors = errorsData?.errors ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">Server status and diagnostics</p>
        </div>
      </div>

      {/* Health overview */}
      {healthLoading && statsLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : healthError ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to reach lobby-api: {healthError}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure lobby-api is running on localhost:8080
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Server Status"
            value={isHealthy ? "Healthy" : "Unhealthy"}
            icon={Server}
            description={health?.status ? `Status: ${String(health.status)}` : "Unknown"}
          />
          <StatCard
            title="Uptime"
            value={uptime > 0 ? formatUptime(uptime) : "--"}
            icon={Activity}
            description="Since last restart"
          />
          <StatCard
            title="WS Connections"
            value={activeWsConnections}
            icon={Wifi}
            description="Active WebSocket clients"
          />
          <StatCard
            title="Database"
            value={dbStatus === "connected" || dbStatus === "ok" ? "Connected" : String(dbStatus)}
            icon={Database}
            description={`Status: ${String(dbStatus)}`}
          />
        </div>
      )}

      {/* Detailed stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Server Stats</CardTitle>
            <CardDescription>Raw stats from /api/stats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm text-muted-foreground">{key}</span>
                  <span className="text-sm font-mono font-medium">
                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent errors */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Last 50 errors from /api/admin/errors</CardDescription>
            </div>
            {!errorsLoading && (
              <Badge variant={errors.length > 0 ? "destructive" : "secondary"}>
                {errors.length} error{errors.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {errorsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : errors.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-md border border-destructive/20 p-3"
                  >
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-all">{err.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {err.timestamp ? new Date(err.timestamp).toLocaleString() : "Unknown time"}
                      </p>
                      {Object.entries(err)
                        .filter(([k]) => k !== "message" && k !== "timestamp")
                        .map(([k, v]) => (
                          <span key={k} className="inline-block text-xs text-muted-foreground mr-2 mt-1">
                            {k}: <span className="font-mono">{String(v)}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No recent errors</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
