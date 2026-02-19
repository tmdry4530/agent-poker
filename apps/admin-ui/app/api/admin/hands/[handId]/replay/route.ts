import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handId: string }> },
) {
  const { handId } = await params;
  // TODO: Implement replay verification endpoint
  return NextResponse.json(
    { error: "Replay API not yet implemented", handId },
    { status: 501 },
  );
}
