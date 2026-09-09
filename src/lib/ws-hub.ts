import type { WebSocket } from "ws";

export type WSEvent =
  | {
      type: "new_message";
      groupId: string;
      message: {
        id: string;
        body: string;
        type: string;
        createdAt: string | Date;
        authorId: string | null;
        authorUsername: string | null;
      };
    }
  | {
      type: "expense_created";
      groupId: string;
      description: string;
      amount: number;
      payerUsername: string;
    }
  | {
      type: "expense_deleted";
      groupId: string;
      description: string;
    }
  | {
      type: "settlement_recorded";
      groupId: string;
      amount: number;
      payerUsername: string;
      recipientUsername: string;
    }
  | {
      type: "member_joined";
      groupId: string;
      username: string;
    }
  | {
      type: "refresh";
      groupId: string;
    };

class WebSocketHub {
  private groupSockets = new Map<string, Set<WebSocket>>();

  register(groupId: string, ws: WebSocket) {
    if (!this.groupSockets.has(groupId)) {
      this.groupSockets.set(groupId, new Set());
    }
    this.groupSockets.get(groupId)!.add(ws);

    ws.on("close", () => {
      this.unregister(groupId, ws);
    });
  }

  unregister(groupId: string, ws: WebSocket) {
    const sockets = this.groupSockets.get(groupId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        this.groupSockets.delete(groupId);
      }
    }
  }

  broadcast(groupId: string, event: WSEvent) {
    const sockets = this.groupSockets.get(groupId);
    if (!sockets || sockets.size === 0) return;

    const payload = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === 1 /* OPEN */) {
        try {
          ws.send(payload);
        } catch (err) {
          console.error("Failed to send WebSocket message:", err);
        }
      }
    }
  }

  getConnectedCount(groupId: string): number {
    return this.groupSockets.get(groupId)?.size || 0;
  }
}

// Global singleton to survive Next.js module reloading
declare global {
  var __wsHub: WebSocketHub | undefined;
}

export const wsHub = globalThis.__wsHub || new WebSocketHub();
if (process.env.NODE_ENV !== "production") {
  globalThis.__wsHub = wsHub;
}

/**
 * Helper to dispatch WebSocket events from server actions or API routes
 */
export async function broadcastWsEvent(event: WSEvent): Promise<void> {
  // 1. In-process direct broadcast
  wsHub.broadcast(event.groupId, event);

  // 2. Also attempt internal HTTP broadcast to ensure workers or external nodes receive it
  const port = process.env.PORT || "3000";
  try {
    await fetch(`http://127.0.0.1:${port}/api/ws/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      cache: "no-store",
    }).catch(() => {
      // Ignore connection errors if internal endpoint is not running
    });
  } catch {
    // Ignore internal fetch failures
  }
}
