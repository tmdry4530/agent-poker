import type { TableInfo, HandSummary, AgentInfo, AgentDetail, MatchmakingStatus } from "./types";

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080")
    : "http://localhost:8080";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("agent_poker_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("agent_poker_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getTables(): Promise<TableInfo[]> {
  const data = await fetchApi<{ tables: TableInfo[] }>("/api/tables");
  return data.tables ?? [];
}

export async function getTable(id: string): Promise<TableInfo> {
  return fetchApi<TableInfo>(`/api/tables/${id}`);
}

export interface CreateTableParams {
  variant?: string;
  smallBlind?: number;
  bigBlind?: number;
  maxSeats?: number;
  minBuyInBB?: number;
  maxBuyInBB?: number;
  anteEnabled?: boolean;
  anteAmount?: number;
}

export async function createTable(params: CreateTableParams = {}): Promise<TableInfo> {
  return fetchApi<TableInfo>("/api/tables", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getHands(tableId: string): Promise<HandSummary[]> {
  const data = await fetchApi<{ hands: HandSummary[] }>(
    `/api/tables/${tableId}/hands`,
  );
  return data.hands ?? [];
}

export async function getHandHistory(tableId: string) {
  return fetchApi<{ hands: any[] }>(`/api/tables/${tableId}/hands`).then(d => d.hands ?? []);
}

export async function getHandDetail(tableId: string, handId: string) {
  return fetchApi<any>(`/api/tables/${tableId}/hands/${encodeURIComponent(handId)}`);
}

export async function getLiveState(tableId: string) {
  return fetchApi<{ state: any }>(`/api/tables/${tableId}/state`).then(d => d.state);
}

// Agent APIs
export async function getAgents(): Promise<AgentInfo[]> {
  const data = await fetchApi<{ agents: AgentInfo[] }>("/api/agents");
  return data.agents ?? [];
}

export async function getAgent(id: string): Promise<AgentDetail> {
  return fetchApi<AgentDetail>(`/api/agents/${id}`);
}

export async function banAgent(id: string): Promise<void> {
  await fetchApi<unknown>(`/api/agents/${id}/ban`, { method: "POST" });
}

export async function unbanAgent(id: string): Promise<void> {
  await fetchApi<unknown>(`/api/agents/${id}/unban`, { method: "POST" });
}

// System APIs
export async function getReadyz(): Promise<{ status: string; uptime?: number; [key: string]: unknown }> {
  return fetchApi<{ status: string; uptime?: number }>("/readyz");
}

export async function getStats(): Promise<Record<string, unknown>> {
  return fetchApi<Record<string, unknown>>("/api/stats");
}

export async function getAdminErrors(): Promise<{ errors: Array<{ message: string; timestamp: string; [key: string]: unknown }> }> {
  return fetchApi<{ errors: Array<{ message: string; timestamp: string }> }>("/api/admin/errors");
}

// Matchmaking APIs
export async function getMatchmakingStatus(): Promise<MatchmakingStatus> {
  return fetchApi<MatchmakingStatus>("/api/matchmaking/status");
}

export async function triggerManualMatch(blindLevel: string): Promise<{ tableId: string }> {
  return fetchApi<{ tableId: string }>("/api/matchmaking/match", {
    method: "POST",
    body: JSON.stringify({ blindLevel }),
  });
}
