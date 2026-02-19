"use client";

import { useCallback, useRef, useState } from "react";
import { useWebSocket } from "./use-websocket";

const WS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_GAME_SERVER_WS_URL ?? "ws://localhost:8081")
    : "ws://localhost:8081";

export interface DashboardStats {
  activeTables: number;
  connectedAgents: number;
  handsPerMinute: number;
  totalChipsInPlay: number;
}

const INITIAL_STATS: DashboardStats = {
  activeTables: 0,
  connectedAgents: 0,
  handsPerMinute: 0,
  totalChipsInPlay: 0,
};

// Rolling window for hands/minute (5 minutes)
const ROLLING_WINDOW_MS = 5 * 60 * 1000;

interface WsMessage {
  type?: string;
  [key: string]: unknown;
}

export function useDashboardWs() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const handTimestamps = useRef<number[]>([]);

  const addHandTimestamp = useCallback(() => {
    const now = Date.now();
    handTimestamps.current.push(now);
    // prune old entries outside window
    const cutoff = now - ROLLING_WINDOW_MS;
    handTimestamps.current = handTimestamps.current.filter((t) => t >= cutoff);
  }, []);

  const calcHandsPerMinute = useCallback((): number => {
    const now = Date.now();
    const cutoff = now - ROLLING_WINDOW_MS;
    const recent = handTimestamps.current.filter((t) => t >= cutoff);
    if (recent.length === 0) return 0;
    // hands in window / minutes in window
    const windowMinutes = ROLLING_WINDOW_MS / 60000;
    return Math.round((recent.length / windowMinutes) * 10) / 10;
  }, []);

  const onMessage = useCallback(
    (raw: unknown) => {
      const msg = raw as WsMessage;
      if (!msg || typeof msg.type !== "string") return;

      switch (msg.type) {
        case "dashboard:snapshot": {
          // Full state snapshot from server
          const d = msg as WsMessage & {
            activeTables?: number;
            connectedAgents?: number;
            totalChipsInPlay?: number;
          };
          setStats((prev) => ({
            ...prev,
            activeTables: d.activeTables ?? prev.activeTables,
            connectedAgents: d.connectedAgents ?? prev.connectedAgents,
            totalChipsInPlay: d.totalChipsInPlay ?? prev.totalChipsInPlay,
            handsPerMinute: calcHandsPerMinute(),
          }));
          break;
        }
        case "table:created":
        case "table:opened": {
          setStats((prev) => ({
            ...prev,
            activeTables: prev.activeTables + 1,
          }));
          break;
        }
        case "table:closed": {
          setStats((prev) => ({
            ...prev,
            activeTables: Math.max(0, prev.activeTables - 1),
          }));
          break;
        }
        case "agent:connected":
        case "agent:seated": {
          setStats((prev) => ({
            ...prev,
            connectedAgents: prev.connectedAgents + 1,
          }));
          break;
        }
        case "agent:disconnected":
        case "agent:left": {
          setStats((prev) => ({
            ...prev,
            connectedAgents: Math.max(0, prev.connectedAgents - 1),
          }));
          break;
        }
        case "hand:complete":
        case "hand:ended": {
          addHandTimestamp();
          setStats((prev) => ({
            ...prev,
            handsPerMinute: calcHandsPerMinute(),
          }));
          break;
        }
        case "chips:update": {
          const c = msg as WsMessage & { totalChipsInPlay?: number };
          if (typeof c.totalChipsInPlay === "number") {
            setStats((prev) => ({
              ...prev,
              totalChipsInPlay: c.totalChipsInPlay as number,
            }));
          }
          break;
        }
        // Handle generic state updates from server
        case "stats:update": {
          const s = msg as WsMessage & Partial<DashboardStats>;
          setStats((prev) => ({
            activeTables: s.activeTables ?? prev.activeTables,
            connectedAgents: s.connectedAgents ?? prev.connectedAgents,
            handsPerMinute: s.handsPerMinute ?? calcHandsPerMinute(),
            totalChipsInPlay: s.totalChipsInPlay ?? prev.totalChipsInPlay,
          }));
          break;
        }
      }
    },
    [addHandTimestamp, calcHandsPerMinute],
  );

  const { status } = useWebSocket({
    url: `${WS_URL}/admin`,
    onMessage,
  });

  return { stats, wsStatus: status };
}
