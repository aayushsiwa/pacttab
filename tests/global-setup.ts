import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";

function resolveTestDatabase(): { url: string; name: string } {
  config({ path: ".env.test", quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.test");
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name) throw new Error("DATABASE_URL in .env.test does not include a database name");
  return { url, name };
}

function maintenanceUrl(url: string): string {
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  return maintenance.toString();
}

export async function setup(): Promise<void> {
  const { url, name } = resolveTestDatabase();
  const maintenance = postgres(maintenanceUrl(url), { prepare: false, connect_timeout: 10 });
  try {
    const existing = await maintenance`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) {
      await maintenance.unsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await maintenance.end();
  }

  const client = postgres(url, { prepare: false });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });
  } finally {
    await client.end();
  }
}

export async function teardown(): Promise<void> {
  const { url, name } = resolveTestDatabase();
  if (name === "postgres") return;

  const maintenance = postgres(maintenanceUrl(url), { prepare: false, connect_timeout: 10 });
  try {
    try {
      await maintenance.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    } catch {
      await maintenance.unsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${name} AND pid <> pg_backend_pid()`
      );
      await maintenance.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
    }
  } catch (error) {
    console.warn(
      `[tests] Could not drop test database "${name}":`,
      error instanceof Error ? error.message : error
    );
  } finally {
    await maintenance.end();
  }
}
