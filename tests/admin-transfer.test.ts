import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { users, groups, groupMembers } from "../src/db/schema";
import { leaveGroup, transferAdmin } from "../src/lib/group-service";
import { hasOtherActiveAdmin, otherActiveMembers } from "../src/lib/group-membership";

const testRunId = crypto.randomBytes(4).toString("hex");

const admin = { id: crypto.randomUUID(), username: `at_admin_${testRunId}` };
const first = { id: crypto.randomUUID(), username: `at_first_${testRunId}` };
const second = { id: crypto.randomUUID(), username: `at_second_${testRunId}` };

const groupId = crypto.randomUUID();

async function addMember(userId: string, role = "member") {
  await db.insert(groupMembers).values({
    id: crypto.randomUUID(),
    groupId,
    userId,
    role,
    status: "active",
  });
}

async function activeAdmins() {
  return db
    .select({ userId: groupMembers.userId, role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.role, "admin"),
        eq(groupMembers.status, "active")
      )
    );
}

beforeAll(async () => {
  await db.insert(users).values([admin, first, second]);
  await db
    .insert(groups)
    .values({ id: groupId, name: `Transfer ${testRunId}`, createdBy: admin.id });
  await addMember(admin.id, "admin");
  await addMember(first.id);
  await addMember(second.id);
});

afterAll(async () => {
  await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  await db.delete(groups).where(eq(groups.id, groupId));
  await db.delete(users).where(eq(users.id, admin.id));
  await db.delete(users).where(eq(users.id, first.id));
  await db.delete(users).where(eq(users.id, second.id));
});

describe("admin membership helpers", () => {
  it("detects another active admin even when several members are active", () => {
    const members = [
      { id: admin.id, role: "admin", status: "active" },
      { id: first.id, role: "member", status: "active" },
      { id: second.id, role: "admin", status: "active" },
    ];

    expect(hasOtherActiveAdmin(members, admin.id)).toBe(true);
    expect(otherActiveMembers(members, admin.id)).toHaveLength(2);
  });

  it("ignores an admin who already left the group", () => {
    const members = [
      { id: admin.id, role: "admin", status: "active" },
      { id: first.id, role: "admin", status: "inactive" },
    ];

    expect(hasOtherActiveAdmin(members, admin.id)).toBe(false);
    expect(otherActiveMembers(members, admin.id)).toHaveLength(0);
  });
});

describe("admin transfer serialization", () => {
  it("keeps a single active admin when two transfers race", async () => {
    const results = await Promise.all([
      transferAdmin(admin, groupId, first.id),
      transferAdmin(admin, groupId, second.id),
    ]);

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].status).toBe(403);
    expect(failed[0].error).toMatch(/only the current group admin/i);

    const admins = await activeAdmins();
    expect(admins).toHaveLength(1);
    expect([first.id, second.id]).toContain(admins[0].userId);
  });

  it("rejects a second active admin row at the database level", async () => {
    const admins = await activeAdmins();

    await expect(addMember(admin.id, "admin")).rejects.toThrowError();
    expect(admins.length).toBeGreaterThanOrEqual(1);
  });

  it("lets the outgoing admin leave once the role was handed over", async () => {
    const admins = await activeAdmins();
    const newAdminId = admins[0].userId;

    const leaveResult = await leaveGroup(admin, groupId);
    expect(leaveResult.success).toBe(true);

    const [membership] = await db
      .select({ status: groupMembers.status, role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, admin.id)));
    expect(membership.status).toBe("inactive");
    expect(newAdminId).toBeDefined();
  });
});
