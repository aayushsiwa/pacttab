import * as dotenv from "dotenv";
dotenv.config();

import { redis, getDuplicateRedis } from "../src/lib/redis";
import crypto from "crypto";

async function testRedisWsFlow() {
  console.log("🚀 Testing Redis Pub/Sub Cross-Instance Real-Time Event Sync...\n");

  if (!redis) {
    throw new Error("REDIS_URL is not configured or failed to initialize");
  }

  // 1. Verify Redis connectivity
  const pong = await redis.ping();
  if (pong !== "PONG") {
    throw new Error(`Expected PONG, got ${pong}`);
  }
  console.log("1. Redis PING test successful (PONG)");

  // 2. Setup simulated cross-instance Pub/Sub
  console.log("2. Simulating Instance A and Instance B...");
  const channel = `pacttab:test:events:${Date.now()}`;
  const subscriber = getDuplicateRedis()!;

  const instanceAId = crypto.randomUUID();
  const instanceBId = crypto.randomUUID();

  let receivedOnInstanceB: unknown = null;

  await subscriber.subscribe(channel);
  subscriber.on("message", (ch, msg) => {
    if (ch === channel) {
      try {
        const payload = JSON.parse(msg);
        // Instance B receives event from Instance A
        if (payload.originInstanceId === instanceAId) {
          receivedOnInstanceB = payload.event;
        }
      } catch (err) {
        console.error("Parse error:", err);
      }
    }
  });

  console.log("   ✓ Instance B subscribed to channel:", channel);

  // 3. Publish event from Instance A
  console.log("3. Publishing real-time message event from Instance A...");
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

  await redis.publish(
    channel,
    JSON.stringify({
      originInstanceId: instanceAId,
      event: testEvent,
    })
  );

  // Wait for delivery
  let attempts = 0;
  while (!receivedOnInstanceB && attempts < 30) {
    await new Promise((r) => setTimeout(r, 100));
    attempts++;
  }

  if (!receivedOnInstanceB) {
    throw new Error("Instance B did not receive event published by Instance A within 3 seconds");
  }

  console.log("   ✓ Instance B successfully received cross-instance event:", (receivedOnInstanceB as typeof testEvent).message.body);

  // Cleanup
  await subscriber.unsubscribe(channel);
  await subscriber.quit();

  console.log("\n🎉 ALL REDIS REAL-TIME SYNC TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

testRedisWsFlow().catch((err) => {
  console.error("❌ Redis test failed:", err);
  process.exit(1);
});
