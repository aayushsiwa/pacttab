import { describe, it, expect, afterAll } from "vitest";
import { db } from "../src/db";
import {
  users,
  groups,
  groupMembers,
  inviteLinks,
  messages,
  expenses,
  expenseSplits,
  settlements,
} from "../src/db/schema";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { calculateEqualSplits, calculateBalancesAndSettlements } from "../src/lib/balances";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Release 1 End-to-End Flow Verification", () => {
  const testSuffix = Date.now().toString().slice(-5);
  const usernameA = `maya_${testSuffix}`;
  const usernameB = `arjun_${testSuffix}`;
  const password = "securePassword123";
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const inviteToken = crypto.randomBytes(16).toString("hex");
  const expenseId = crypto.randomUUID();
  const settlementId = crypto.randomUUID();
  const amount = 1200;
  const participantIds = [userAId, userBId];
  const splits = calculateEqualSplits(amount, participantIds);

  afterAll(async () => {
    await db.delete(settlements).where(eq(settlements.groupId, groupId));
    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await db.delete(expenses).where(eq(expenses.groupId, groupId));
    await db.delete(messages).where(eq(messages.groupId, groupId));
    await db.delete(inviteLinks).where(eq(inviteLinks.groupId, groupId));
    await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(users).where(eq(users.id, userAId));
    await db.delete(users).where(eq(users.id, userBId));
  });

  it("creates accounts with password hashing and verification", async () => {
    const hashA = await hashPassword(password);
    await db.insert(users).values({
      id: userAId,
      username: usernameA,
      passwordHash: hashA,
    });
    const verifiedA = await verifyPassword(password, hashA);
    expect(verifiedA).toBe(true);

    const hashB = await hashPassword(password);
    await db.insert(users).values({
      id: userBId,
      username: usernameB,
      passwordHash: hashB,
    });
    const verifiedB = await verifyPassword(password, hashB);
    expect(verifiedB).toBe(true);
  });

  it("creates group with admin role and generates invite link", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(groups).values({
        id: groupId,
        name: `Goa Trip ${testSuffix}`,
        description: "Private beach trip expenses & coordination",
        createdBy: userAId,
      });

      await tx.insert(groupMembers).values({
        id: crypto.randomUUID(),
        groupId,
        userId: userAId,
        role: "admin",
        status: "active",
      });

      await tx.insert(inviteLinks).values({
        id: crypto.randomUUID(),
        groupId,
        token: inviteToken,
        createdBy: userAId,
      });

      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId,
        authorId: null,
        body: `${usernameA} created the group "Goa Trip ${testSuffix}".`,
        type: "system",
      });
    });

    const [groupRecord] = await db.select().from(groups).where(eq(groups.id, groupId));
    expect(groupRecord).toBeDefined();
    expect(groupRecord.name).toBe(`Goa Trip ${testSuffix}`);
  });

  it("allows user B to join group and post chat messages", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(groupMembers).values({
        id: crypto.randomUUID(),
        groupId,
        userId: userBId,
        role: "member",
        status: "active",
      });

      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId,
        authorId: null,
        body: `${usernameB} joined the group.`,
        type: "system",
      });
    });

    await db.insert(messages).values({
      id: crypto.randomUUID(),
      groupId,
      authorId: userBId,
      body: "Hey Maya, ready for Goa!",
      type: "user",
    });

    const members = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
    expect(members).toHaveLength(2);
  });

  it("records expense with equal splits and computes balances and suggested repayments", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        id: expenseId,
        groupId,
        description: "Seafood Dinner",
        amount: amount.toFixed(2),
        paidByUserId: userAId,
        createdBy: userAId,
      });

      for (const s of splits) {
        await tx.insert(expenseSplits).values({
          id: crypto.randomUUID(),
          expenseId,
          userId: s.userId,
          owedAmount: s.owedAmount.toFixed(2),
        });
      }

      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId,
        authorId: null,
        body: `${usernameA} added expense "Seafood Dinner" — ₹1,200.00`,
        type: "system",
      });
    });

    const expList = [
      {
        id: expenseId,
        amount: amount,
        paidByUserId: userAId,
        splits: splits.map((s) => ({ userId: s.userId, owedAmount: s.owedAmount })),
      },
    ];

    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      [
        { id: userAId, username: usernameA },
        { id: userBId, username: usernameB },
      ],
      expList,
      []
    );

    const balA = balances.find((b) => b.userId === userAId)?.netBalance;
    const balB = balances.find((b) => b.userId === userBId)?.netBalance;

    expect(balA).toBe(600);
    expect(balB).toBe(-600);

    expect(suggestedSettlements).toHaveLength(1);
    expect(suggestedSettlements[0].fromUserId).toBe(userBId);
    expect(suggestedSettlements[0].toUserId).toBe(userAId);
    expect(suggestedSettlements[0].amount).toBe(600);
  });

  it("records settlement and settles all balances cleanly to 0", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(settlements).values({
        id: settlementId,
        groupId,
        paidByUserId: userBId,
        receivedByUserId: userAId,
        amount: "600.00",
      });

      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId,
        authorId: null,
        body: `${usernameB} recorded a settlement of ₹600.00 to ${usernameA}.`,
        type: "system",
      });
    });

    const expList = [
      {
        id: expenseId,
        amount: amount,
        paidByUserId: userAId,
        splits: splits.map((s) => ({ userId: s.userId, owedAmount: s.owedAmount })),
      },
    ];

    const postSettlementResult = calculateBalancesAndSettlements(
      [
        { id: userAId, username: usernameA },
        { id: userBId, username: usernameB },
      ],
      expList,
      [{ id: settlementId, amount: 600, paidByUserId: userBId, receivedByUserId: userAId }]
    );

    const finalBalA = postSettlementResult.balances.find((b) => b.userId === userAId)?.netBalance;
    const finalBalB = postSettlementResult.balances.find((b) => b.userId === userBId)?.netBalance;

    expect(finalBalA).toBe(0);
    expect(finalBalB).toBe(0);
    expect(postSettlementResult.suggestedSettlements).toHaveLength(0);
  });

  it("verifies activity feed contains all messages", async () => {
    const groupMessages = await db.select().from(messages).where(eq(messages.groupId, groupId));
    expect(groupMessages.length).toBeGreaterThanOrEqual(4);
  });
});
