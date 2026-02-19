import type { TableInfo, HandSummary } from "./types";

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_LOBBY_API_URL ?? "http://localhost:8080")
    : "http://localhost:8080";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
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

export async function createTable(): Promise<TableInfo> {
  return fetchApi<TableInfo>("/api/tables", { method: "POST", body: JSON.stringify({}) });
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
