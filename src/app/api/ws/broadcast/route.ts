import { NextResponse } from "next/server";
import { wsHub, type WSEvent } from "@/lib/ws-hub";

export async function POST(req: Request) {
  try {
    const event: WSEvent = await req.json();
    if (event?.groupId) {
      wsHub.broadcast(event.groupId, event);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Internal broadcast error:", error);
    return NextResponse.json({ success: false, error: "Failed to broadcast" }, { status: 500 });
  }
}
