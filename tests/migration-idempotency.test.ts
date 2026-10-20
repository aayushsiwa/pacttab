import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

class Rollback extends Error {}

function migrationFiles(): string[] {
  const dir = path.join(process.cwd(), "drizzle");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(dir, file));
}

function statements(file: string): string[] {
  return fs
    .readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("migration idempotency", () => {
  it("re-applies every migration to a database that is already up to date", async () => {
    const files = migrationFiles();

    // The first two files create the base schema and are recorded in the
    // journal of every existing database. The rest must stay safe to re-run
    // against a schema that is already at the latest state, because a
    // database whose schema was synced outside the journal would otherwise
    // fail on the first "relation already exists".
    const replayable = files.slice(2);
    expect(replayable.length).toBeGreaterThan(0);

    let failure: unknown = null;
    try {
      await db.transaction(async (tx) => {
        for (const file of replayable) {
          for (const statement of statements(file)) {
            await tx.execute(sql.raw(statement));
          }
        }
        throw new Rollback();
      });
    } catch (error) {
      failure = error;
    }

    // A Rollback means every statement ran; anything else is a real failure.
    expect(failure).toBeInstanceOf(Rollback);
  });
});
