import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "connected";
  let redisStatus = "in-memory (single-instance)";

  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    dbStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (process.env.REDIS_URL) {
    if (redis && redis.status === "ready") {
      redisStatus = "connected";
    } else if (redis) {
      try {
        const ping = await redis.ping();
        redisStatus = ping === "PONG" ? "connected" : `unexpected: ${ping}`;
      } catch (err) {
        redisStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      redisStatus = "error: disconnected";
    }
  }

  const isHealthy = dbStatus === "connected" && !redisStatus.startsWith("error");
  const responseTimeMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      responseTimeMs,
      services: {
        database: dbStatus,
        redis: redisStatus,
        websocket: "ready",
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
