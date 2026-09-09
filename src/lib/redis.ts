import * as dotenv from "dotenv";
dotenv.config();

import Redis from "ioredis";

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[PactTab] No REDIS_URL found. Running in local in-memory fallback mode.");
    }
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });

    client.on("error", (err) => {
      console.error("[PactTab Redis Error]:", err.message);
    });

    return client;
  } catch (err) {
    console.error("[PactTab Redis Init Failed]:", err);
    return null;
  }
}

declare global {
  var __redisClient: Redis | null | undefined;
}

export const redis: Redis | null =
  globalThis.__redisClient !== undefined
    ? globalThis.__redisClient
    : (globalThis.__redisClient = createRedisClient());

/**
 * Creates a duplicate dedicated Redis connection (e.g. for blocking streams or pub/sub)
 */
export function getDuplicateRedis(): Redis | null {
  if (!redis) return null;
  try {
    const dup = redis.duplicate();
    dup.on("error", (err) => {
      console.error("[PactTab Redis Duplicate Error]:", err.message);
    });
    return dup;
  } catch (err) {
    console.error("[PactTab Redis duplicate failed]:", err);
    return null;
  }
}
