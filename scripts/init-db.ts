import * as dotenv from "dotenv";
dotenv.config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not defined in .env");
    process.exit(1);
  }

  // Obfuscate password for safe logging
  const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ":****@");
  console.log(`\n📦 PactTab Database Initialization & Migration Tool`);
  console.log(`📡 Target: ${maskedUrl}\n`);

  let targetUrl: URL;
  try {
    targetUrl = new URL(databaseUrl);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Invalid DATABASE_URL format:", message);
    process.exit(1);
  }

  const targetDbName = targetUrl.pathname.replace(/^\//, "") || "postgres";

  // Step 1: Ensure the database exists
  console.log(`🔍 Step 1: Checking if database "${targetDbName}" exists...`);
  let dbExists = false;

  try {
    const directClient = postgres(databaseUrl, { prepare: false, connect_timeout: 5 });
    await directClient`SELECT 1`;
    await directClient.end();
    dbExists = true;
    console.log(`   ✓ Database "${targetDbName}" is accessible.`);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const message = err instanceof Error ? err.message : String(err);
    // Check if error is "database does not exist" (Postgres code 3D000)
    if (code === "3D000" || message.includes("does not exist")) {
      console.log(`   ⚠️  Database "${targetDbName}" does not exist yet.`);
    } else {
      console.warn(`   ⚠️  Could not directly connect: ${message}`);
    }
  }

  if (!dbExists) {
    console.log(`🛠️  Attempting to initialize database "${targetDbName}" via maintenance DB...`);
    const maintenanceUrl = new URL(databaseUrl);
    maintenanceUrl.pathname = "/postgres";

    try {
      const maintenanceClient = postgres(maintenanceUrl.toString(), { prepare: false, connect_timeout: 10 });
      const checkRes = await maintenanceClient`SELECT 1 FROM pg_database WHERE datname = ${targetDbName}`;

      if (checkRes.length === 0) {
        console.log(`   Creating database "${targetDbName}"...`);
        await maintenanceClient.unsafe(`CREATE DATABASE "${targetDbName}"`);
        console.log(`   ✓ Database "${targetDbName}" created successfully!`);
      } else {
        console.log(`   ✓ Database "${targetDbName}" already exists on server.`);
      }
      await maintenanceClient.end();
    } catch (createErr: unknown) {
      const message = createErr instanceof Error ? createErr.message : String(createErr);
      console.error(`   ❌ Failed to create database "${targetDbName}":`, message);
      console.log(`   ℹ️  If your managed provider (e.g. Supabase) only allows using the "postgres" database, update DATABASE_URL to end with /postgres`);
      process.exit(1);
    }
  }

  // Step 2: Ensure migration files exist
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  console.log(`\n📁 Step 2: Checking migrations in "${migrationsFolder}"...`);

  const hasMigrationFiles =
    fs.existsSync(migrationsFolder) &&
    fs.readdirSync(migrationsFolder).some((f) => f.endsWith(".sql"));

  if (!hasMigrationFiles) {
    console.log("   No existing SQL migrations found. Generating with drizzle-kit...");
    try {
      execSync("pnpm exec drizzle-kit generate", { stdio: "inherit" });
      console.log("   ✓ Generated migration files.");
    } catch (genErr: unknown) {
      const message = genErr instanceof Error ? genErr.message : String(genErr);
      console.error("   ❌ Failed to generate migrations:", message);
      process.exit(1);
    }
  } else {
    console.log("   ✓ Migration files found.");
  }

  // Step 3: Apply migrations
  console.log(`\n🚀 Step 3: Applying migrations to "${targetDbName}"...`);
  const targetClient = postgres(databaseUrl, { prepare: false });
  const db = drizzle(targetClient);

  try {
    await migrate(db, { migrationsFolder });
    console.log("   ✓ All migrations applied successfully!");

    // Verify created tables
    const tables = await targetClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log(`\n📋 Verified Public Tables in "${targetDbName}":`);
    tables.forEach((t) => {
      console.log(`   • ${t.table_name}`);
    });

    console.log(`\n🎉 Database initialization and migration complete!\n`);
  } catch (migErr: unknown) {
    const message = migErr instanceof Error ? migErr.message : String(migErr);
    console.error("❌ Migration failed:", message);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
