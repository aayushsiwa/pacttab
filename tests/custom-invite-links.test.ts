import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import { users, groups, groupMembers, inviteLinks } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { createInviteLink, joinGroup } from "../src/lib/group-service";

describe("Custom Invite Links Workflow", () => {
  const testRunId = crypto.randomBytes(3).toString("hex");
  const adminId = crypto.randomUUID();
  const adminUsername = `admin_inv_${testRunId}`;
  const groupId = crypto.randomUUID();
  const joinerId = crypto.randomUUID();
  const joinerUsername = `joiner_cust_${testRunId}`;
  const customSlug = `summer-retreat-${testRunId}`;

  const adminUser = { id: adminId, username: adminUsername };
  const joinerUser = { id: joinerId, username: joinerUsername };

  beforeAll(async () => {
    await hashPassword("AdminPassword123!"); // hash for future use
    await db.insert(users).values({
      id: adminId,
      username: adminUsername,
    });

    await db.insert(groups).values({
      id: groupId,
      name: `Custom Invite Group ${testRunId}`,
      createdBy: adminId,
    });

    await db.insert(groupMembers).values({
      id: crypto.randomUUID(),
      groupId,
      userId: adminId,
      role: "admin",
      status: "active",
    });

    await hashPassword("JoinerPassword123!"); // hash for future use
    await db.insert(users).values({
      id: joinerId,
      username: joinerUsername,
    });
  });

  afterAll(async () => {
    delete process.env.TEST_CURRENT_USER_ID;
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(users).where(eq(users.id, adminId));
    await db.delete(users).where(eq(users.id, joinerId));
  });

  it("creates custom slug invite link and persists in database", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const createRes = await createInviteLink(adminUser, groupId, {
      customSlug,
      expiresInHours: 48,
      maxUses: 10,
    });

    expect(createRes.success).toBe(true);
    expect(createRes.token).toBe(customSlug);

    const [dbInvite] = await db.select().from(inviteLinks).where(eq(inviteLinks.token, customSlug));

    expect(dbInvite).toBeDefined();
    expect(dbInvite.groupId).toBe(groupId);
    expect(dbInvite.maxUses).toBe(10);
  });

  it("rejects duplicate custom slugs with collision error", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const dupRes = await createInviteLink(adminUser, groupId, {
      customSlug,
    });

    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toContain("already in use");
  });

  it("rejects invalid slug formats (too short, spaces, special symbols)", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const tooShortRes = await createInviteLink(adminUser, groupId, { customSlug: "ab" });
    expect(tooShortRes.success).toBe(false);

    const invalidCharRes = await createInviteLink(adminUser, groupId, {
      customSlug: "bad slug with spaces!",
    });
    expect(invalidCharRes.success).toBe(false);
  });

  it("rejects reserved system route slugs", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const reservedRes = await createInviteLink(adminUser, groupId, { customSlug: "login" });
    expect(reservedRes.success).toBe(false);
    expect(reservedRes.error).toContain("reserved");
  });

  it("generates 32-character random hex token when custom slug is omitted", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const randomRes = await createInviteLink(adminUser, groupId);
    expect(randomRes.success).toBe(true);
    expect(randomRes.token).toBeDefined();
    expect(randomRes.token).toHaveLength(32);
  });

  it("allows user to join group via custom slug and increments use count", async () => {
    process.env.TEST_CURRENT_USER_ID = joinerId;

    const joinRes = await joinGroup(customSlug, joinerUser);
    expect(joinRes.success).toBe(true);
    expect(joinRes.groupId).toBe(groupId);

    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, joinerId),
          eq(groupMembers.status, "active")
        )
      );

    expect(membership).toBeDefined();

    const [updatedInvite] = await db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.token, customSlug));

    expect(updatedInvite.useCount).toBe(1);
  });
});
