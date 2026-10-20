import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { users, groups, groupMembers } from "../src/db/schema";
import { leaveGroup } from "../src/lib/group-service";

const testRunId = crypto.randomBytes(4).toString("hex");

const admin = { id: crypto.randomUUID(), username: `gl_admin_${testRunId}` };
const member = { id: crypto.randomUUID(), username: `gl_member_${testRunId}` };

const soloGroupId = crypto.randomUUID();
const sharedGroupId = crypto.randomUUID();

async function createGroup(id: string, name: string) {
  await db.insert(groups).values({ id, name, createdBy: admin.id });
}

async function addMember(groupId: string, userId: string, role = "member") {
  await db.insert(groupMembers).values({
    id: crypto.randomUUID(),
    groupId,
    userId,
    role,
    status: "active",
  });
}

beforeAll(async () => {
  await db.insert(users).values([admin, member]);

  await createGroup(soloGroupId, `Solo ${testRunId}`);
  await addMember(soloGroupId, admin.id, "admin");

  await createGroup(sharedGroupId, `Shared ${testRunId}`);
  await addMember(sharedGroupId, admin.id, "admin");
  await addMember(sharedGroupId, member.id);
});

afterAll(async () => {
  await db.delete(groupMembers).where(eq(groupMembers.groupId, soloGroupId));
  await db.delete(groupMembers).where(eq(groupMembers.groupId, sharedGroupId));
  await db.delete(groups).where(eq(groups.id, soloGroupId));
  await db.delete(groups).where(eq(groups.id, sharedGroupId));
  await db.delete(users).where(eq(users.id, admin.id));
  await db.delete(users).where(eq(users.id, member.id));
});

describe("admin leave policy", () => {
  it("blocks the only active admin from leaving and points at deleting the group", async () => {
    const result = await leaveGroup(admin, soloGroupId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/only active member/i);
    expect(result.error).toMatch(/delete the group/i);

    const [membership] = await db
      .select({ status: groupMembers.status })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, soloGroupId), eq(groupMembers.userId, admin.id)));
    expect(membership.status).toBe("active");
  });

  it("tells an admin with other active members to promote one of them to admin", async () => {
    const result = await leaveGroup(admin, sharedGroupId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/promote another member to admin/i);

    const [membership] = await db
      .select({ status: groupMembers.status })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, sharedGroupId), eq(groupMembers.userId, admin.id)));
    expect(membership.status).toBe("active");
  });

  it("lets a non-admin member leave a group with a zero balance", async () => {
    const result = await leaveGroup(member, sharedGroupId);

    expect(result.success).toBe(true);

    const [membership] = await db
      .select({ status: groupMembers.status })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, sharedGroupId), eq(groupMembers.userId, member.id)));
    expect(membership.status).toBe("inactive");
  });
});
