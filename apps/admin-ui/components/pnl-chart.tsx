"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PnlDataPoint } from "@/lib/types";

export function filterPnlByRange(data: PnlDataPoint[], range: "7d" | "30d" | "all"): PnlDataPoint[] {
  if (range === "all") return data;
  const now = Date.now();
  const days = range === "7d" ? 7 : 30;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return data.filter((d) => new Date(d.date).getTime() >= cutoff);
}

export function PnlChart({ data, className }: { data: PnlDataPoint[]; className?: string }) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground py-8 ${className ?? ""}`}>
        No P/L data available
      </div>
    );
  }

  const values = data.map((d) => d.pnl);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const chartHeight = 200;

  return (
    <div className={`${className ?? ""}`}>
      <svg viewBox={`0 0 ${data.length * 40} ${chartHeight + 40}`} className="w-full h-48">
        {/* Zero line */}
        <line
          x1="0"
          y1={chartHeight - ((0 - min) / range) * chartHeight + 20}
          x2={data.length * 40}
          y2={chartHeight - ((0 - min) / range) * chartHeight + 20}
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeDasharray="4"
        />
        {/* Line path */}
        <polyline
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          points={data
            .map((d, i) => {
              const x = i * 40 + 20;
              const y = chartHeight - ((d.pnl - min) / range) * chartHeight + 20;
              return `${x},${y}`;
            })
            .join(" ")}
        />
        {/* Data points */}
        {data.map((d, i) => {
          const x = i * 40 + 20;
          const y = chartHeight - ((d.pnl - min) / range) * chartHeight + 20;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={d.pnl >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function PnlChartCard({ pnlHistory }: { pnlHistory: PnlDataPoint[] }) {
  const [pnlRange, setPnlRange] = useState<"7d" | "30d" | "all">("7d");
  const filteredPnl = filterPnlByRange(pnlHistory, pnlRange);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Profit / Loss</CardTitle>
          <div className="flex gap-1">
            {(["7d", "30d", "all"] as const).map((r) => (
              <Button
                key={r}
                variant={pnlRange === r ? "default" : "ghost"}
                size="sm"
                onClick={() => setPnlRange(r)}
              >
                {r === "all" ? "All" : r}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <PnlChart data={filteredPnl} />
      </CardContent>
    </Card>
  );
}
