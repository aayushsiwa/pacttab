import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { wsHub, broadcastWsEvent } from "@/lib/ws-hub";
import { db } from "@/db";
import { messages, groupMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const groupId = url.searchParams.get("groupId");

  if (!groupId) {
    return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
  }

  try {
    return await experimental_upgradeWebSocket((ws) => {
      wsHub.register(groupId, ws);

      // Send connection confirmation if open
      try {
        if (ws.readyState === 1 /* OPEN */) {
          ws.send(JSON.stringify({ type: "connected", groupId }));
        }
      } catch {
        // Ignore send errors during initial handshake
      }

      ws.on("message", async (data: WebSocketData) => {
        try {
          const payload = JSON.parse(data.toString());

          // Handle client ping
          if (payload.action === "ping") {
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: "pong" }));
            }
            return;
          }

          // Handle client direct message send over websocket
          if (payload.action === "send_message" && payload.body && payload.userId) {
            const trimmed = payload.body.trim();
            if (!trimmed) return;

            // Verify membership
            const membership = await db
              .select({ id: groupMembers.id })
              .from(groupMembers)
              .where(
                and(
                  eq(groupMembers.groupId, groupId),
                  eq(groupMembers.userId, payload.userId),
                  eq(groupMembers.status, "active")
                )
              )
              .limit(1);

            if (membership.length === 0) return;

            const messageId = crypto.randomUUID();
            await db.insert(messages).values({
              id: messageId,
              groupId,
              authorId: payload.userId,
              body: trimmed,
              type: "user",
            });

            // Fetch username
            const userRecord = await db
              .select({ username: users.username })
              .from(users)
              .where(eq(users.id, payload.userId))
              .limit(1);

            const authorUsername = userRecord[0]?.username || "member";

            // Broadcast to all clients across instances via Redis & local wsHub
            await broadcastWsEvent({
              type: "new_message",
              groupId,
              message: {
                id: messageId,
                body: trimmed,
                type: "user",
                createdAt: new Date().toISOString(),
                authorId: payload.userId,
                authorUsername,
              },
            });
          }
        } catch (err) {
          console.error("[PactTab WS] Error processing message:", err);
        }
      });

      const closeHandler = () => {
        wsHub.unregister(groupId, ws);
      };

      ws.on("close", closeHandler);
      ws.on("error", closeHandler);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "WebSocket upgrade is handled by the server runtime or Vercel Functions.",
        message,
      },
      { status: 400 }
    );
  }
}
