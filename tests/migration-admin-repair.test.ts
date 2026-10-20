import { describe, it, expect, afterAll, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { users, groups, groupMembers } from "../src/db/schema";

const INDEX_NAME = "group_members_active_admin_unique_idx";

function migrationFiles(): string[] {
  const dir = path.join(process.cwd(), "drizzle");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => path.join(dir, file));
}

function migrationWithAdminIndex(): string {
  const file = migrationFiles().find((candidate) =>
    fs.readFileSync(candidate, "utf8").includes(INDEX_NAME)
  );
  if (!file) throw new Error("No migration creates the single-admin index");
  return file;
}

function statements(file: string): string[] {
  return fs
    .readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("single-admin migration repair", () => {
  const admin = {
    id: crypto.randomUUID(),
    username: `mr_admin_${crypto.randomBytes(3).toString("hex")}`,
  };
  const first = {
    id: crypto.randomUUID(),
    username: `mr_first_${crypto.randomBytes(3).toString("hex")}`,
  };
  const second = {
    id: crypto.randomUUID(),
    username: `mr_second_${crypto.randomBytes(3).toString("hex")}`,
  };
  const groupId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(users).values([admin, first, second]);
    await db.insert(groups).values({ id: groupId, name: "Legacy dual admin", createdBy: admin.id });
  });

  afterAll(async () => {
    await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(users).where(eq(users.id, admin.id));
    await db.delete(users).where(eq(users.id, first.id));
    await db.delete(users).where(eq(users.id, second.id));
  });

  it("demotes a duplicate active admin before creating the single-admin index", async () => {
    const migration = migrationWithAdminIndex();

    // Recreate the legacy state the migration has to repair: two active admins.
    await db.execute(sql.raw(`DROP INDEX IF EXISTS "${INDEX_NAME}"`));
    try {
      await db.insert(groupMembers).values([
        {
          id: crypto.randomUUID(),
          groupId,
          userId: admin.id,
          role: "admin",
          status: "active",
          joinedAt: new Date("2020-01-01T00:00:00Z"),
        },
        {
          id: crypto.randomUUID(),
          groupId,
          userId: first.id,
          role: "admin",
          status: "active",
          joinedAt: new Date("2021-01-01T00:00:00Z"),
        },
        {
          id: crypto.randomUUID(),
          groupId,
          userId: second.id,
          role: "member",
          status: "active",
        },
      ]);

      for (const statement of statements(migration)) {
        await db.execute(sql.raw(statement));
      }

      const admins = await db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.role, "admin"),
            eq(groupMembers.status, "active")
          )
        );

      expect(admins).toHaveLength(1);
      expect(admins[0].userId).toBe(admin.id);

      const indexRows = await db.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM pg_indexes WHERE indexname = ${INDEX_NAME}`
      );
      expect(Number(indexRows[0]?.count)).toBe(1);
    } finally {
      await db.execute(
        sql.raw(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX_NAME}" ON "group_members" USING btree ("group_id") WHERE "group_members"."role" = 'admin' AND "group_members"."status" = 'active'`
        )
      );
    }
  });
});
