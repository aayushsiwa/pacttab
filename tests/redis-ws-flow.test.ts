import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
dotenv.config();

import { redis, getDuplicateRedis } from "../src/lib/redis";
import crypto from "crypto";

describe("Redis Pub/Sub Cross-Instance Real-Time Event Sync", () => {
  it("connects to Redis and responds to PING", async () => {
    expect(redis).toBeDefined();
    const pong = await redis!.ping();
    expect(pong).toBe("PONG");
  });

  it("syncs real-time events across simulated instances via Redis Pub/Sub", async () => {
    const channel = `pacttab:test:events:${Date.now()}`;
    const subscriber = getDuplicateRedis()!;
    const instanceAId = crypto.randomUUID();

    let receivedOnInstanceB: { message?: { body: string } } | null = null;

    await subscriber.subscribe(channel);
    subscriber.on("message", (ch, msg) => {
      if (ch === channel) {
        try {
          const payload = JSON.parse(msg);
          if (payload.originInstanceId === instanceAId) {
            receivedOnInstanceB = payload.event;
          }
        } catch {}
      }
    });

    const testEvent = {
      type: "new_message",
      groupId: "grp_test_redis_123",
      message: {
        id: crypto.randomUUID(),
        body: "Hello from Instance A via Redis!",
        type: "user",
        createdAt: new Date().toISOString(),
        authorId: "user_a_123",
        authorUsername: "maya",
      },
    };

    await redis!.publish(
      channel,
      JSON.stringify({
        originInstanceId: instanceAId,
        event: testEvent,
      })
    );

    let attempts = 0;
    while (!receivedOnInstanceB && attempts < 30) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    const received = receivedOnInstanceB as { message?: { body: string } } | null;
    expect(received).toBeDefined();
    expect(received?.message?.body).toBe("Hello from Instance A via Redis!");

    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  });
});
