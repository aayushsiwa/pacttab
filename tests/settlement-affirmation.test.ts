import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../src/db";
import {
  users,
  groups,
  groupMembers,
  expenses,
  expenseSplits,
  settlements,
  messages,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { calculateEqualSplits, calculateBalancesAndSettlements } from "../src/lib/balances";

describe("Settlement Affirmation Lifecycle Flow", () => {
  const testSuffix = Math.floor(Math.random() * 90000 + 10000).toString();
  const userAId = crypto.randomUUID();
  const usernameA = `maya_aff_${testSuffix}`;
  const userBId = crypto.randomUUID();
  const usernameB = `arjun_aff_${testSuffix}`;
  const groupId = crypto.randomUUID();
  const expenseId = crypto.randomUUID();
  const settlementId = crypto.randomUUID();
  const rejectedSettlementId = crypto.randomUUID();
  const cancelledSettlementId = crypto.randomUUID();

  const membersList = [
    { id: userAId, username: usernameA },
    { id: userBId, username: usernameB },
  ];
  const amount = 1000;
  const splits = calculateEqualSplits(amount, [userAId, userBId]);
  const expList = [
    {
      id: expenseId,
      amount,
      paidByUserId: userAId,
      splits: splits.map((s) => ({ userId: s.userId, owedAmount: s.owedAmount })),
    },
  ];

  beforeAll(async () => {
    // 1. Setup test users and group
    await db.insert(users).values([
      { id: userAId, username: usernameA, passwordHash: "hashA" },
      { id: userBId, username: usernameB, passwordHash: "hashB" },
    ]);

    await db.insert(groups).values({
      id: groupId,
      name: `Affirmation Test Group ${testSuffix}`,
      createdBy: userAId,
    });

    await db.insert(groupMembers).values([
      { id: crypto.randomUUID(), groupId, userId: userAId, role: "admin", status: "active" },
      { id: crypto.randomUUID(), groupId, userId: userBId, role: "member", status: "active" },
    ]);

    // 2. Add equal-split expense
    await db.insert(expenses).values({
      id: expenseId,
      groupId,
      description: "Team Dinner",
      amount: amount.toFixed(2),
      paidByUserId: userAId,
      createdBy: userAId,
    });

    for (const s of splits) {
      await db.insert(expenseSplits).values({
        id: crypto.randomUUID(),
        expenseId,
        userId: s.userId,
        owedAmount: s.owedAmount.toFixed(2),
      });
    }
  });

  afterAll(async () => {
    await db.delete(settlements).where(eq(settlements.groupId, groupId));
    await db.delete(expenseSplits).where(eq(expenseSplits.userId, userAId));
    await db.delete(expenseSplits).where(eq(expenseSplits.userId, userBId));
    await db.delete(expenses).where(eq(expenses.groupId, groupId));
    await db.delete(messages).where(eq(messages.groupId, groupId));
    await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(users).where(eq(users.id, userAId));
    await db.delete(users).where(eq(users.id, userBId));
  });

  it("calculates initial balances correctly before settlement (+500 / -500)", () => {
    const initialResult = calculateBalancesAndSettlements(membersList, expList, []);
    const initialBalA = initialResult.balances.find((b) => b.userId === userAId)?.netBalance;
    const initialBalB = initialResult.balances.find((b) => b.userId === userBId)?.netBalance;

    expect(initialBalA).toBe(500);
    expect(initialBalB).toBe(-500);
  });

  it("preserves member balances while a settlement is in pending status", async () => {
    await db.insert(settlements).values({
      id: settlementId,
      groupId,
      paidByUserId: userBId,
      receivedByUserId: userAId,
      amount: "500.00",
      status: "pending",
      createdByUserId: userBId,
      settledAt: new Date(),
    });

    const [savedSettlement] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, settlementId));
    expect(savedSettlement.status).toBe("pending");

    const pendingResult = calculateBalancesAndSettlements(membersList, expList, [
      {
        id: savedSettlement.id,
        amount: savedSettlement.amount,
        paidByUserId: savedSettlement.paidByUserId,
        receivedByUserId: savedSettlement.receivedByUserId,
        status: savedSettlement.status,
      },
    ]);

    const pendingBalA = pendingResult.balances.find((b) => b.userId === userAId)?.netBalance;
    const pendingBalB = pendingResult.balances.find((b) => b.userId === userBId)?.netBalance;

    expect(pendingBalA).toBe(500);
    expect(pendingBalB).toBe(-500);
  });

  it("updates balances to 0 after counterparty affirms and confirms settlement", async () => {
    await db
      .update(settlements)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
      })
      .where(eq(settlements.id, settlementId));

    const [confirmedSettlement] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, settlementId));
    expect(confirmedSettlement.status).toBe("confirmed");
    expect(confirmedSettlement.confirmedAt).toBeDefined();

    const confirmedResult = calculateBalancesAndSettlements(membersList, expList, [
      {
        id: confirmedSettlement.id,
        amount: confirmedSettlement.amount,
        paidByUserId: confirmedSettlement.paidByUserId,
        receivedByUserId: confirmedSettlement.receivedByUserId,
        status: confirmedSettlement.status,
      },
    ]);

    const finalBalA = confirmedResult.balances.find((b) => b.userId === userAId)?.netBalance;
    const finalBalB = confirmedResult.balances.find((b) => b.userId === userBId)?.netBalance;

    expect(finalBalA).toBe(0);
    expect(finalBalB).toBe(0);
  });

  it("disregards rejected settlements in balance calculation", async () => {
    await db.insert(settlements).values({
      id: rejectedSettlementId,
      groupId,
      paidByUserId: userBId,
      receivedByUserId: userAId,
      amount: "200.00",
      status: "pending",
      createdByUserId: userBId,
      settledAt: new Date(),
    });

    await db
      .update(settlements)
      .set({
        status: "rejected",
        rejectedAt: new Date(),
      })
      .where(eq(settlements.id, rejectedSettlementId));

    const rejectedResult = calculateBalancesAndSettlements(membersList, expList, [
      {
        id: settlementId,
        amount: "500.00",
        paidByUserId: userBId,
        receivedByUserId: userAId,
        status: "confirmed",
      },
      {
        id: rejectedSettlementId,
        amount: "200.00",
        paidByUserId: userBId,
        receivedByUserId: userAId,
        status: "rejected",
      },
    ]);

    const postRejectBalA = rejectedResult.balances.find((b) => b.userId === userAId)?.netBalance;
    const postRejectBalB = rejectedResult.balances.find((b) => b.userId === userBId)?.netBalance;

    expect(postRejectBalA).toBe(0);
    expect(postRejectBalB).toBe(0);
  });

  it("disregards cancelled settlements in balance calculation", async () => {
    await db.insert(settlements).values({
      id: cancelledSettlementId,
      groupId,
      paidByUserId: userBId,
      receivedByUserId: userAId,
      amount: "100.00",
      status: "pending",
      createdByUserId: userBId,
      settledAt: new Date(),
    });

    await db
      .update(settlements)
      .set({
        status: "cancelled",
      })
      .where(eq(settlements.id, cancelledSettlementId));

    const cancelledResult = calculateBalancesAndSettlements(membersList, expList, [
      {
        id: settlementId,
        amount: "500.00",
        paidByUserId: userBId,
        receivedByUserId: userAId,
        status: "confirmed",
      },
      {
        id: cancelledSettlementId,
        amount: "100.00",
        paidByUserId: userBId,
        receivedByUserId: userAId,
        status: "cancelled",
      },
    ]);

    const postCancelBalA = cancelledResult.balances.find((b) => b.userId === userAId)?.netBalance;
    const postCancelBalB = cancelledResult.balances.find((b) => b.userId === userBId)?.netBalance;

    expect(postCancelBalA).toBe(0);
    expect(postCancelBalB).toBe(0);
  });
});
