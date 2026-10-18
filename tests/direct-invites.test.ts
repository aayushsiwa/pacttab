import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import crypto from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  groups,
  groupMembers,
  directInvites,
  messages,
  inviteLinks,
  joinRequests,
} from "../src/db/schema";
import {
  createDirectInvite,
  respondToDirectInvite,
  revokeDirectInvite,
  resolveDirectInviteByToken,
  joinGroup,
  reviewJoinRequest,
} from "../src/lib/group-service";
import { getUserPendingDirectInvites, getGroupDetails } from "../src/lib/queries";

describe("Direct Invites (Invite by Username)", () => {
  const testRunId = crypto.randomBytes(3).toString("hex");
  const adminId = crypto.randomUUID();
  const adminUsername = `admin_di_${testRunId}`;
  const memberId = crypto.randomUUID();
  const memberUsername = `member_di_${testRunId}`;
  const inviteeId = crypto.randomUUID();
  const inviteeUsername = `invitee_di_${testRunId}`;
  const outsiderId = crypto.randomUUID();
  const outsiderUsername = `outsider_di_${testRunId}`;
  const declinerId = crypto.randomUUID();
  const declinerUsername = `decliner_di_${testRunId}`;
  const provisionalId = crypto.randomUUID();
  const provisionalUsername = `user_${crypto.randomBytes(12).toString("hex")}`;
  const staleId = crypto.randomUUID();
  const staleUsername = `stale_di_${testRunId}`;
  const groupId = crypto.randomUUID();

  const adminUser = { id: adminId, username: adminUsername };
  const memberUser = { id: memberId, username: memberUsername };
  const inviteeUser = { id: inviteeId, username: inviteeUsername };
  const outsiderUser = { id: outsiderId, username: outsiderUsername };
  const declinerUser = { id: declinerId, username: declinerUsername };
  const staleUser = { id: staleId, username: staleUsername };

  let inviteToken: string;
  let inviteId: string;
  let declinerInviteId: string;

  beforeAll(async () => {
    await db.insert(users).values([
      { id: adminId, username: adminUsername },
      { id: memberId, username: memberUsername },
      { id: inviteeId, username: inviteeUsername },
      { id: outsiderId, username: outsiderUsername },
      { id: declinerId, username: declinerUsername },
      { id: provisionalId, username: provisionalUsername, needsUsername: true },
      { id: staleId, username: staleUsername },
    ]);

    await db.insert(groups).values({
      id: groupId,
      name: `Direct Invite Group ${testRunId}`,
      createdBy: adminId,
    });

    await db.insert(groupMembers).values([
      { id: crypto.randomUUID(), groupId, userId: adminId, role: "admin", status: "active" },
      { id: crypto.randomUUID(), groupId, userId: memberId, role: "member", status: "active" },
    ]);
  });

  afterAll(async () => {
    delete process.env.TEST_CURRENT_USER_ID;
    await db.delete(groups).where(eq(groups.id, groupId));
    await db
      .delete(users)
      .where(
        sql`${users.id} IN (${adminId}, ${memberId}, ${inviteeId}, ${outsiderId}, ${declinerId}, ${provisionalId}, ${staleId})`
      );
  });

  it("rejects non-admins trying to invite by username", async () => {
    process.env.TEST_CURRENT_USER_ID = memberId;

    const res = await createDirectInvite(memberUser, groupId, { username: inviteeUsername });

    expect(res.success).toBe(false);
    expect(res.status).toBe(403);
  });

  it("rejects unknown usernames with 404", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await createDirectInvite(adminUser, groupId, {
      username: `ghost_${testRunId}`,
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe(404);
    expect(res.error).toBe("User not found");
  });

  it("rejects self-invites", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await createDirectInvite(adminUser, groupId, { username: adminUsername });

    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("rejects inviting an active member", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await createDirectInvite(adminUser, groupId, { username: memberUsername });

    expect(res.success).toBe(false);
    expect(res.status).toBe(409);
  });

  it("does not resolve provisional onboarding accounts", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await createDirectInvite(adminUser, groupId, { username: provisionalUsername });

    expect(res.success).toBe(false);
    expect(res.status).toBe(404);
  });

  it("validates username format", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await createDirectInvite(adminUser, groupId, { username: "bad name!" });

    expect(res.success).toBe(false);
    expect(res.status).toBe(400);
  });

  it("creates a direct invite with a share token (case-insensitive match)", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await createDirectInvite(adminUser, groupId, {
      username: inviteeUsername.toUpperCase(),
    });

    expect(res.success).toBe(true);
    expect(res.token).toHaveLength(32);
    expect(res.inviteeUsername).toBe(inviteeUsername);
    inviteToken = res.token!;
    inviteId = res.inviteId!;

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, inviteId));
    expect(row.status).toBe("pending");
    expect(row.groupId).toBe(groupId);
    expect(row.inviteeId).toBe(inviteeId);
    expect(row.expiresAt).not.toBeNull();
  });

  it("lists the pending invite in the invitee's inbox", async () => {
    const inbox = await getUserPendingDirectInvites(inviteeId);

    expect(inbox).toHaveLength(1);
    expect(inbox[0].id).toBe(inviteId);
    expect(inbox[0].inviterUsername).toBe(adminUsername);
  });

  it("rejects a duplicate invite while one is still pending", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await createDirectInvite(adminUser, groupId, { username: inviteeUsername });

    expect(res.success).toBe(false);
    expect(res.status).toBe(409);
  });

  it("resolves the direct invite by token", async () => {
    const resolved = await resolveDirectInviteByToken(inviteToken);

    expect(resolved).not.toBeNull();
    expect(resolved!.groupId).toBe(groupId);
    expect(resolved!.inviteeId).toBe(inviteeId);
    expect(resolved!.status).toBe("pending");
  });

  it("returns null for unknown tokens", async () => {
    const resolved = await resolveDirectInviteByToken(crypto.randomBytes(16).toString("hex"));

    expect(resolved).toBeNull();
  });

  it("prevents users other than the invitee from responding", async () => {
    process.env.TEST_CURRENT_USER_ID = outsiderId;

    const res = await respondToDirectInvite(outsiderUser, inviteId, "accepted");

    expect(res.success).toBe(false);
    expect(res.status).toBe(403);

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, inviteId));
    expect(row.status).toBe("pending");
  });

  it("accepts the invite, adds membership, and posts a system message", async () => {
    process.env.TEST_CURRENT_USER_ID = inviteeId;

    const res = await respondToDirectInvite(inviteeUser, inviteId, "accepted");

    expect(res.success).toBe(true);

    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, inviteeId)));

    expect(membership).toBeDefined();
    expect(membership.status).toBe("active");
    expect(membership.role).toBe("member");

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, inviteId));
    expect(row).toBeUndefined();

    const [systemMessage] = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.groupId, groupId), sql`${messages.body} LIKE ${"%accepted the invite%"}`)
      );

    expect(systemMessage).toBeDefined();
    expect(systemMessage.type).toBe("system");
  });

  it("clears the invite from the invitee's inbox after acceptance", async () => {
    const inbox = await getUserPendingDirectInvites(inviteeId);

    expect(inbox).toHaveLength(0);
  });

  it("returns 404 when responding to an invite that was already accepted", async () => {
    process.env.TEST_CURRENT_USER_ID = inviteeId;

    const res = await respondToDirectInvite(inviteeUser, inviteId, "declined");

    expect(res.success).toBe(false);
    expect(res.status).toBe(404);
  });

  it("deletes the invite on decline and allows a fresh re-invite", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const created = await createDirectInvite(adminUser, groupId, { username: declinerUsername });
    expect(created.success).toBe(true);
    declinerInviteId = created.inviteId!;

    process.env.TEST_CURRENT_USER_ID = declinerId;
    const declineRes = await respondToDirectInvite(declinerUser, declinerInviteId, "declined");
    expect(declineRes.success).toBe(true);

    const [declinedRow] = await db
      .select()
      .from(directInvites)
      .where(eq(directInvites.id, declinerInviteId));
    expect(declinedRow).toBeUndefined();

    process.env.TEST_CURRENT_USER_ID = adminId;
    const res = await createDirectInvite(adminUser, groupId, { username: declinerUsername });

    expect(res.success).toBe(true);
    expect(res.inviteId).not.toBe(declinerInviteId);
    declinerInviteId = res.inviteId!;

    const [row] = await db
      .select()
      .from(directInvites)
      .where(eq(directInvites.id, declinerInviteId));
    expect(row.status).toBe("pending");
    expect(row.inviteeId).toBe(declinerId);
    expect(row.token).toBe(res.token);
  });

  it("allows admins to revoke a pending invite", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;

    const res = await revokeDirectInvite(adminUser, groupId, declinerInviteId);

    expect(res.success).toBe(true);

    const [row] = await db
      .select()
      .from(directInvites)
      .where(eq(directInvites.id, declinerInviteId));
    expect(row.status).toBe("revoked");
  });

  it("rejects revoking by non-admins and re-revoking", async () => {
    process.env.TEST_CURRENT_USER_ID = memberId;

    const nonAdminRes = await revokeDirectInvite(memberUser, groupId, declinerInviteId);
    expect(nonAdminRes.success).toBe(false);
    expect(nonAdminRes.status).toBe(403);

    process.env.TEST_CURRENT_USER_ID = adminId;
    const againRes = await revokeDirectInvite(adminUser, groupId, declinerInviteId);
    expect(againRes.success).toBe(false);
    expect(againRes.status).toBe(409);
  });

  it("rejects expired invites at respond time and deletes the row", async () => {
    const expiredId = crypto.randomUUID();
    const expiredToken = crypto.randomBytes(16).toString("hex");

    await db.insert(directInvites).values({
      id: expiredId,
      groupId,
      inviterId: adminId,
      inviteeId: outsiderId,
      token: expiredToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    process.env.TEST_CURRENT_USER_ID = outsiderId;
    const res = await respondToDirectInvite(outsiderUser, expiredId, "accepted");

    expect(res.success).toBe(false);
    expect(res.status).toBe(409);
    expect(res.error).toContain("expired");

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, expiredId));
    expect(row).toBeUndefined();
  });

  it("reports expired once when resolved by token, then deletes the row", async () => {
    const expiredId = crypto.randomUUID();
    const expiredToken = crypto.randomBytes(16).toString("hex");

    await db.delete(directInvites).where(eq(directInvites.inviteeId, outsiderId));
    await db.insert(directInvites).values({
      id: expiredId,
      groupId,
      inviterId: adminId,
      inviteeId: outsiderId,
      token: expiredToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    const resolved = await resolveDirectInviteByToken(expiredToken);

    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe("expired");

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, expiredId));
    expect(row).toBeUndefined();

    const secondResolve = await resolveDirectInviteByToken(expiredToken);
    expect(secondResolve).toBeNull();
  });

  it("deletes a pending direct invite when the invitee joins via share link", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const created = await createDirectInvite(adminUser, groupId, { username: outsiderUsername });
    expect(created.success).toBe(true);
    const directInviteId = created.inviteId!;

    const linkToken = crypto.randomBytes(16).toString("hex");
    await db.insert(inviteLinks).values({
      id: crypto.randomUUID(),
      groupId,
      token: linkToken,
      createdBy: adminId,
    });

    const joinRes = await joinGroup(linkToken, outsiderUser);
    expect(joinRes.success).toBe(true);

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, directInviteId));
    expect(row).toBeUndefined();

    const inbox = await getUserPendingDirectInvites(outsiderId);
    expect(inbox).toHaveLength(0);
  });

  it("deletes a pending direct invite when the invitee's join request is approved", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const created = await createDirectInvite(adminUser, groupId, { username: declinerUsername });
    expect(created.success).toBe(true);
    const directInviteId = created.inviteId!;

    const requestId = crypto.randomUUID();
    await db.insert(joinRequests).values({
      id: requestId,
      groupId,
      userId: declinerId,
      status: "pending",
    });

    const res = await reviewJoinRequest(adminUser, groupId, requestId, "approved");
    expect(res.success).toBe(true);

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, directInviteId));
    expect(row).toBeUndefined();

    const inbox = await getUserPendingDirectInvites(declinerId);
    expect(inbox).toHaveLength(0);
  });

  it("hides and silently clears invites for users who are already members", async () => {
    process.env.TEST_CURRENT_USER_ID = adminId;
    const created = await createDirectInvite(adminUser, groupId, { username: staleUsername });
    expect(created.success).toBe(true);
    const directInviteId = created.inviteId!;

    await db.insert(groupMembers).values({
      id: crypto.randomUUID(),
      groupId,
      userId: staleId,
      role: "member",
      status: "active",
    });

    const inbox = await getUserPendingDirectInvites(staleId);
    expect(inbox).toHaveLength(0);

    const details = await getGroupDetails(groupId, adminId);
    expect(details).not.toBeNull();
    expect(details!.directInvites.some((i) => i.id === directInviteId)).toBe(false);

    const acceptedMessagesBefore = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(eq(messages.groupId, groupId), sql`${messages.body} LIKE ${"%accepted the invite%"}`)
      );

    process.env.TEST_CURRENT_USER_ID = staleId;
    const res = await respondToDirectInvite(staleUser, directInviteId, "accepted");
    expect(res.success).toBe(true);

    const [row] = await db.select().from(directInvites).where(eq(directInvites.id, directInviteId));
    expect(row).toBeUndefined();

    const acceptedMessagesAfter = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(eq(messages.groupId, groupId), sql`${messages.body} LIKE ${"%accepted the invite%"}`)
      );
    expect(acceptedMessagesAfter).toHaveLength(acceptedMessagesBefore.length);
  });
});
