import type { WebSocket } from "ws";
import { redis, getDuplicateRedis } from "./redis";
import crypto from "crypto";

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
      type: "expense_updated";
      groupId: string;
      description: string;
      amount: number;
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
      type: "settlement_confirmed";
      groupId: string;
      settlementId: string;
      amount?: number;
    }
  | {
      type: "settlement_rejected";
      groupId: string;
      settlementId: string;
    }
  | {
      type: "settlement_cancelled";
      groupId: string;
      settlementId: string;
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

const INSTANCE_ID = crypto.randomUUID();
const REDIS_EVENT_CHANNEL = "pacttab:ws:events";

class WebSocketHub {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private groupSockets = new Map<string, Set<WebSocket | any>>();
  private subscriberInitialized = false;

  constructor() {
    this.initRedisSubscriber();
  }

  private initRedisSubscriber() {
    if (this.subscriberInitialized) return;
    const subscriber = getDuplicateRedis();
    if (!subscriber) return;

    this.subscriberInitialized = true;

    subscriber.subscribe(REDIS_EVENT_CHANNEL, (err) => {
      if (err) {
        console.error("[PactTab WS] Failed to subscribe to Redis channel:", err.message);
      } else {
        console.log(`[PactTab WS] Subscribed to Redis channel ${REDIS_EVENT_CHANNEL}`);
      }
    });

    subscriber.on("message", (channel, message) => {
      if (channel !== REDIS_EVENT_CHANNEL) return;
      try {
        const data = JSON.parse(message);
        // If this event was published by this same instance and already delivered locally, skip
        if (data.originInstanceId === INSTANCE_ID) return;
        if (data.event?.groupId) {
          this.broadcastLocal(data.event.groupId, data.event);
        }
      } catch (err) {
        console.error("[PactTab WS] Failed to parse Redis message:", err);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(groupId: string, ws: WebSocket | any) {
    if (!this.groupSockets.has(groupId)) {
      this.groupSockets.set(groupId, new Set());
    }
    this.groupSockets.get(groupId)!.add(ws);

    const closeHandler = () => {
      this.unregister(groupId, ws);
    };

    if (typeof ws.on === "function") {
      ws.on("close", closeHandler);
    } else if (typeof ws.addEventListener === "function") {
      ws.addEventListener("close", closeHandler);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unregister(groupId: string, ws: WebSocket | any) {
    const sockets = this.groupSockets.get(groupId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        this.groupSockets.delete(groupId);
      }
    }
  }

  broadcastLocal(groupId: string, event: WSEvent) {
    const sockets = this.groupSockets.get(groupId);
    if (!sockets || sockets.size === 0) return;

    const payload = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === 1 /* OPEN */) {
        try {
          ws.send(payload);
        } catch (err) {
          console.error("[PactTab WS] Failed to send WebSocket message:", err);
        }
      }
    }
  }

  broadcast(groupId: string, event: WSEvent) {
    this.broadcastLocal(groupId, event);
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
 * Helper to dispatch WebSocket events from server actions or API routes.
 * Broadcasts to local sockets immediately and publishes to Redis for cross-instance delivery.
 */
export async function broadcastWsEvent(event: WSEvent): Promise<void> {
  // 1. In-process direct broadcast to local clients
  wsHub.broadcastLocal(event.groupId, event);

  // 2. Publish to Redis for cross-instance delivery (e.g. Vercel Functions)
  if (redis) {
    try {
      await redis.publish(
        REDIS_EVENT_CHANNEL,
        JSON.stringify({
          originInstanceId: INSTANCE_ID,
          event,
        })
      );
    } catch (err) {
      console.error("[PactTab WS] Failed to publish event to Redis:", err);
    }
  }

  // 3. Optional local loopback fallback
  const port = process.env.PORT || "3000";
  try {
    await fetch(`http://127.0.0.1:${port}/api/ws/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      cache: "no-store",
    }).catch(() => {});
  } catch {
    // Ignore internal fetch failures
  }
}
