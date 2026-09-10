import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  groups,
  groupMembers,
  joinRequests,
  settlements,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { getUserGroups, getUserPendingAdminActionsCount } from "../src/lib/queries";

describe("Admin Action Notifications & Pending Request Indicators", () => {
  const testRunId = crypto.randomBytes(3).toString("hex");
  const adminId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const joinerId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  const settlementId = crypto.randomUUID();

  beforeAll(async () => {
    const pwdHash = await hashPassword("TestPassword123!");
    await db.insert(users).values([
      { id: adminId, username: `admin_notif_${testRunId}`, passwordHash: pwdHash },
      { id: memberId, username: `member_notif_${testRunId}`, passwordHash: pwdHash },
      { id: joinerId, username: `joiner_notif_${testRunId}`, passwordHash: pwdHash },
    ]);

    await db.insert(groups).values({
      id: groupId,
      name: `Notification Test Group ${testRunId}`,
      description: "Testing admin action notification dots",
      createdBy: adminId,
    });

    await db.insert(groupMembers).values([
      { id: crypto.randomUUID(), groupId, userId: adminId, role: "admin", status: "active" },
      { id: crypto.randomUUID(), groupId, userId: memberId, role: "member", status: "active" },
    ]);
  });

  afterAll(async () => {
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(users).where(eq(users.id, adminId));
    await db.delete(users).where(eq(users.id, memberId));
    await db.delete(users).where(eq(users.id, joinerId));
  });

  it("verifies initial state has 0 pending admin actions", async () => {
    const adminCount = await getUserPendingAdminActionsCount(adminId);
    const memberCount = await getUserPendingAdminActionsCount(memberId);
    const adminGroups = await getUserGroups(adminId);

    expect(adminCount).toBe(0);
    expect(memberCount).toBe(0);

    const groupItem = adminGroups.find((g) => g.id === groupId);
    expect(groupItem).toBeDefined();
    expect(groupItem?.pendingActionCount).toBe(0);
    expect(groupItem?.pendingJoinRequestsCount).toBe(0);
  });

  it("shows pending join request notification count to admin and 0 to regular member", async () => {
    await db.insert(joinRequests).values({
      id: requestId,
      groupId,
      userId: joinerId,
      status: "pending",
    });

    const adminCount = await getUserPendingAdminActionsCount(adminId);
    const memberCount = await getUserPendingAdminActionsCount(memberId);
    const adminGroups = await getUserGroups(adminId);
    const memberGroups = await getUserGroups(memberId);

    expect(adminCount).toBe(1);
    expect(memberCount).toBe(0);

    const adminGroupItem = adminGroups.find((g) => g.id === groupId);
    expect(adminGroupItem?.pendingJoinRequestsCount).toBe(1);
    expect(adminGroupItem?.pendingActionCount).toBe(1);

    const memberGroupItem = memberGroups.find((g) => g.id === groupId);
    expect(memberGroupItem?.pendingJoinRequestsCount).toBe(0);
    expect(memberGroupItem?.pendingActionCount).toBe(0);
  });

  it("combines join requests and pending affirmations in action counts", async () => {
    await db.insert(settlements).values({
      id: settlementId,
      groupId,
      paidByUserId: memberId,
      receivedByUserId: adminId,
      amount: "500.00",
      status: "pending",
      createdByUserId: memberId,
    });

    const adminGroups = await getUserGroups(adminId);
    const adminGroupItem = adminGroups.find((g) => g.id === groupId);

    expect(adminGroupItem?.pendingJoinRequestsCount).toBe(1);
    expect(adminGroupItem?.pendingSettlementsCount).toBe(1);
    expect(adminGroupItem?.pendingActionCount).toBe(2);
  });

  it("resets pending join request action count to 0 upon approval", async () => {
    await db
      .update(joinRequests)
      .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() })
      .where(eq(joinRequests.id, requestId));

    const adminCount = await getUserPendingAdminActionsCount(adminId);
    expect(adminCount).toBe(0);

    const adminGroups = await getUserGroups(adminId);
    const adminGroupItem = adminGroups.find((g) => g.id === groupId);
    expect(adminGroupItem?.pendingJoinRequestsCount).toBe(0);
  });
});
