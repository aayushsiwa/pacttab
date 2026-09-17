import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { wsHub } from "./src/lib/ws-hub";
import { db } from "./src/db";
import { messages, groupMembers, users } from "./src/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url || "", true);

    if (pathname === "/api/ws" || pathname === "/ws") {
      const groupId = typeof query.groupId === "string" ? query.groupId : null;
      if (!groupId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, groupId);
      });
    } else {
      // Don't destroy if other upgrades exist
    }
  });

  wss.on("connection", (ws: WebSocket, _req: unknown, groupId: string) => {
    wsHub.register(groupId, ws);

    // Send connection confirmation
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "connected", groupId }));
    }

    ws.on("message", async (data) => {
      try {
        const payload = JSON.parse(data.toString());

        // Handle client ping
        if (payload.action === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
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

          // Broadcast to all clients in group
          wsHub.broadcast(groupId, {
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
        console.error("Failed to process WebSocket message:", err);
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> PactTab server ready at http://${hostname}:${port}`);
    console.log(`> WebSocket server ready at ws://${hostname}:${port}/api/ws`);
  });
});
