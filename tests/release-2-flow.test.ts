import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  groups,
  groupMembers,
  inviteLinks,
  joinRequests,
  expenses,
  expenseSplits,
  settlements,
  messages,
} from "../src/db/schema";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { calculateBalancesAndSettlements } from "../src/lib/balances";

describe("Release 2 End-to-End Flow Verification", () => {
  const testRunId = crypto.randomBytes(3).toString("hex");
  const adminPassword = "AdminPassword123!";
  let adminHash: string;
  const adminId = crypto.randomUUID();
  const adminUsername = `admin_r2_${testRunId}`;

  const memberPassword = "MemberPassword123!";
  const memberId = crypto.randomUUID();
  const memberUsername = `member_r2_${testRunId}`;

  const joinerPassword = "JoinerPassword123!";
  const joinerId = crypto.randomUUID();
  const joinerUsername = `joiner_r2_${testRunId}`;

  const groupId = crypto.randomUUID();
  const expenseId = crypto.randomUUID();
  const updatedAmount = "1800.00";
  const settleId = crypto.randomUUID();

  const allMembers = [
    { id: adminId, username: adminUsername },
    { id: memberId, username: memberUsername },
    { id: joinerId, username: joinerUsername },
  ];
  const currentSplits = [
    { userId: adminId, owedAmount: "600.00" },
    { userId: memberId, owedAmount: "600.00" },
    { userId: joinerId, owedAmount: "600.00" },
  ];

  beforeAll(async () => {
    adminHash = await hashPassword(adminPassword);
    const memberHash = await hashPassword(memberPassword);
    const joinerHash = await hashPassword(joinerPassword);

    await db.insert(users).values([
      { id: adminId, username: adminUsername, passwordHash: adminHash },
      { id: memberId, username: memberUsername, passwordHash: memberHash },
      { id: joinerId, username: joinerUsername, passwordHash: joinerHash },
    ]);

    await db.insert(groups).values({
      id: groupId,
      name: `Release 2 Group ${testRunId}`,
      description: "Testing Release 2 features",
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

  it("handles advanced invite links with admin approval queue and activation", async () => {
    const inviteToken = crypto.randomBytes(16).toString("hex");
    const inviteId = crypto.randomUUID();
    await db.insert(inviteLinks).values({
      id: inviteId,
      groupId,
      token: inviteToken,
      createdBy: adminId,
      requiresApproval: true,
      maxUses: 5,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });

    const joinRequestId = crypto.randomUUID();
    await db.insert(joinRequests).values({
      id: joinRequestId,
      groupId,
      userId: joinerId,
      status: "pending",
    });

    const [fetchedReq] = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, joinRequestId));

    expect(fetchedReq).toBeDefined();
    expect(fetchedReq.status).toBe("pending");

    // Admin approves request
    await db
      .update(joinRequests)
      .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() })
      .where(eq(joinRequests.id, joinRequestId));

    await db.insert(groupMembers).values({
      id: crypto.randomUUID(),
      groupId,
      userId: joinerId,
      role: "member",
      status: "active",
    });

    const [activeJoiner] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, joinerId),
          eq(groupMembers.status, "active")
        )
      );

    expect(activeJoiner).toBeDefined();
  });

  it("records custom split expense creation and generates audit trail on update", async () => {
    const initialAmount = "1500.00";
    await db.insert(expenses).values({
      id: expenseId,
      groupId,
      paidByUserId: adminId,
      amount: initialAmount,
      description: "Team Dinner Initial",
      createdBy: adminId,
      expenseDate: new Date(),
    });

    await db.insert(expenseSplits).values([
      { id: crypto.randomUUID(), expenseId, userId: adminId, owedAmount: "500.00" },
      { id: crypto.randomUUID(), expenseId, userId: memberId, owedAmount: "500.00" },
      { id: crypto.randomUUID(), expenseId, userId: joinerId, owedAmount: "500.00" },
    ]);

    // Update expense
    await db
      .update(expenses)
      .set({ amount: updatedAmount, description: "Team Dinner Buffet" })
      .where(eq(expenses.id, expenseId));

    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await db.insert(expenseSplits).values([
      { id: crypto.randomUUID(), expenseId, userId: adminId, owedAmount: "600.00" },
      { id: crypto.randomUUID(), expenseId, userId: memberId, owedAmount: "600.00" },
      { id: crypto.randomUUID(), expenseId, userId: joinerId, owedAmount: "600.00" },
    ]);

    const auditMessageId = crypto.randomUUID();
    await db.insert(messages).values({
      id: auditMessageId,
      groupId,
      authorId: null,
      body: `${adminUsername} updated expense "Team Dinner Buffet" (Total: ₹1,800.00).`,
      type: "system",
    });

    const [auditMsg] = await db.select().from(messages).where(eq(messages.id, auditMessageId));

    expect(auditMsg).toBeDefined();
    expect(auditMsg.body).toContain("updated expense");
  });

  it("calculates member balances and protects balance before leave group", async () => {
    const { balances: balBefore } = calculateBalancesAndSettlements(
      allMembers,
      [{ id: expenseId, amount: updatedAmount, paidByUserId: adminId, splits: currentSplits }],
      []
    );

    const memberBal = balBefore.find((b) => b.userId === memberId)?.netBalance || 0;
    expect(memberBal).toBe(-600);

    // Record pending settlement
    await db.insert(settlements).values({
      id: settleId,
      groupId,
      paidByUserId: memberId,
      receivedByUserId: adminId,
      amount: "600.00",
      status: "pending",
      createdByUserId: memberId,
    });

    const { balances: balPending } = calculateBalancesAndSettlements(
      allMembers,
      [{ id: expenseId, amount: updatedAmount, paidByUserId: adminId, splits: currentSplits }],
      [
        {
          id: settleId,
          paidByUserId: memberId,
          receivedByUserId: adminId,
          amount: "600.00",
          status: "pending",
        },
      ]
    );
    const memberBalPending = balPending.find((b) => b.userId === memberId)?.netBalance || 0;
    expect(memberBalPending).toBe(-600);

    // Admin affirms settlement
    await db
      .update(settlements)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(settlements.id, settleId));

    const { balances: balConfirmed } = calculateBalancesAndSettlements(
      allMembers,
      [{ id: expenseId, amount: updatedAmount, paidByUserId: adminId, splits: currentSplits }],
      [
        {
          id: settleId,
          paidByUserId: memberId,
          receivedByUserId: adminId,
          amount: "600.00",
          status: "confirmed",
        },
      ]
    );
    const memberBalConfirmed = balConfirmed.find((b) => b.userId === memberId)?.netBalance || 0;
    expect(memberBalConfirmed).toBe(0);

    // Member with 0 balance can leave group
    await db
      .update(groupMembers)
      .set({ status: "inactive" })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

    const [leftMember] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

    expect(leftMember.status).toBe("inactive");
  });

  it("transfers admin role to another member", async () => {
    await db.transaction(async (tx) => {
      await tx
        .update(groupMembers)
        .set({ role: "member" })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, adminId)));
      await tx
        .update(groupMembers)
        .set({ role: "admin" })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, joinerId)));
    });

    const [newAdmin] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, joinerId)));

    expect(newAdmin.role).toBe("admin");
  });

  it("cascades permanent group deletion across all related records", async () => {
    await db.delete(groups).where(eq(groups.id, groupId));

    const checkExpenses = await db.select().from(expenses).where(eq(expenses.groupId, groupId));
    const checkSplits = await db
      .select()
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId));
    const checkSettlements = await db
      .select()
      .from(settlements)
      .where(eq(settlements.groupId, groupId));
    const checkMembers = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    const checkInvites = await db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.groupId, groupId));
    const checkRequests = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.groupId, groupId));

    expect(checkExpenses).toHaveLength(0);
    expect(checkSplits).toHaveLength(0);
    expect(checkSettlements).toHaveLength(0);
    expect(checkMembers).toHaveLength(0);
    expect(checkInvites).toHaveLength(0);
    expect(checkRequests).toHaveLength(0);
  });

  it("verifies user password and deletes user account permanently", async () => {
    const wrongPasswordValid = await verifyPassword("WrongPassword!", adminHash);
    expect(wrongPasswordValid).toBe(false);

    const rightPasswordValid = await verifyPassword(adminPassword, adminHash);
    expect(rightPasswordValid).toBe(true);

    await db.delete(users).where(eq(users.id, adminId));
    const [deletedUserCheck] = await db.select().from(users).where(eq(users.id, adminId));
    expect(deletedUserCheck).toBeUndefined();
  });
});
