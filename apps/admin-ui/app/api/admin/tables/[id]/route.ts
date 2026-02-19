import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { LOBBY_API_BASE_URL, ADMIN_API_KEY } = getEnv();
  try {
    const res = await fetch(`${LOBBY_API_BASE_URL}/api/tables/${id}`, {
      headers: {
        ...(ADMIN_API_KEY ? { "X-ADMIN-API-KEY": ADMIN_API_KEY } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${res.status} ${res.statusText}` },
        { status: res.status },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to connect to lobby-api", detail: (err as Error).message },
      { status: 502 },
    );
  }
}
