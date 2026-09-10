import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../src/db";
import { users, groups, groupMembers, expenses, expenseSplits, settlements, messages } from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { calculateEqualSplits, calculateBalancesAndSettlements } from "../src/lib/balances";

async function runSettlementAffirmationTest() {
  console.log("🚀 Starting Settlement Affirmation Lifecycle Test...\n");

  const testSuffix = Math.floor(Math.random() * 90000 + 10000).toString();
  const userAId = crypto.randomUUID();
  const usernameA = `maya_aff_${testSuffix}`;
  const userBId = crypto.randomUUID();
  const usernameB = `arjun_aff_${testSuffix}`;
  const groupId = crypto.randomUUID();

  try {
    // 1. Setup test users and group
    console.log("1. Setting up test users and group...");
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
    console.log("   ✓ Users and group initialized");

    // 2. Add an expense: Maya pays ₹1,000 for dinner split equally with Arjun
    console.log("2. Adding equal-split expense: Maya pays ₹1,000...");
    const expenseId = crypto.randomUUID();
    const amount = 1000;
    const splits = calculateEqualSplits(amount, [userAId, userBId]);

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

    // Check balances before settlement
    const membersList = [
      { id: userAId, username: usernameA },
      { id: userBId, username: usernameB },
    ];
    const expList = [
      {
        id: expenseId,
        amount,
        paidByUserId: userAId,
        splits: splits.map((s) => ({ userId: s.userId, owedAmount: s.owedAmount })),
      },
    ];

    const initialResult = calculateBalancesAndSettlements(membersList, expList, []);
    const initialBalA = initialResult.balances.find((b) => b.userId === userAId)?.netBalance;
    const initialBalB = initialResult.balances.find((b) => b.userId === userBId)?.netBalance;
    console.log(`   Initial Balances: @${usernameA} = +₹${initialBalA}, @${usernameB} = -₹${Math.abs(initialBalB!)}`);
    if (initialBalA !== 500 || initialBalB !== -500) {
      throw new Error(`Expected initial balances +500/-500, got ${initialBalA}/${initialBalB}`);
    }

    // 3. Arjun records paying Maya ₹500 (creates pending settlement)
    console.log("\n3. Testing Settlement Creation (Arjun records paying Maya ₹500)...");
    const settlementId = crypto.randomUUID();
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

    // 4. Verify balances remain unchanged while settlement is pending
    console.log("4. Verifying balances remain unchanged while settlement is pending...");
    const [savedSettlement] = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, settlementId));

    if (savedSettlement.status !== "pending") {
      throw new Error(`Expected status 'pending', got '${savedSettlement.status}'`);
    }

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
    console.log(`   Balances with Pending Settlement: @${usernameA} = +₹${pendingBalA}, @${usernameB} = -₹${Math.abs(pendingBalB!)}`);
    if (pendingBalA !== 500 || pendingBalB !== -500) {
      throw new Error(`Pending settlement should NOT affect balances! Got ${pendingBalA}/${pendingBalB}`);
    }
    console.log("   ✓ Balances properly preserved during pending status");

    // 5. Counterparty Affirmation: Maya confirms the settlement
    console.log("\n5. Testing Counterparty Affirmation (Maya confirms the payment)...");
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

    if (confirmedSettlement.status !== "confirmed" || !confirmedSettlement.confirmedAt) {
      throw new Error("Settlement confirmation failed");
    }

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
    console.log(`   Post-Confirmation Balances: @${usernameA} = ₹${finalBalA}, @${usernameB} = ₹${finalBalB}`);
    if (finalBalA !== 0 || finalBalB !== 0) {
      throw new Error(`Expected balances to be ₹0 after confirmation, got ${finalBalA}/${finalBalB}`);
    }
    console.log("   ✓ Balances updated to ₹0.00 following counterparty confirmation");

    // 6. Testing Rejection: Arjun claims paying Maya another ₹200, Maya rejects it
    console.log("\n6. Testing Settlement Rejection workflow...");
    const rejectedSettlementId = crypto.randomUUID();
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
        id: confirmedSettlement.id,
        amount: confirmedSettlement.amount,
        paidByUserId: confirmedSettlement.paidByUserId,
        receivedByUserId: confirmedSettlement.receivedByUserId,
        status: confirmedSettlement.status,
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
    if (postRejectBalA !== 0 || postRejectBalB !== 0) {
      throw new Error(`Rejected settlement altered balances! Got ${postRejectBalA}/${postRejectBalB}`);
    }
    console.log("   ✓ Rejected settlement correctly disregarded in balance calculation");

    // 7. Testing Cancellation: Arjun records payment of ₹100, then cancels it
    console.log("\n7. Testing Creator Cancellation workflow...");
    const cancelledSettlementId = crypto.randomUUID();
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
        id: confirmedSettlement.id,
        amount: confirmedSettlement.amount,
        paidByUserId: confirmedSettlement.paidByUserId,
        receivedByUserId: confirmedSettlement.receivedByUserId,
        status: confirmedSettlement.status,
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
    if (postCancelBalA !== 0 || postCancelBalB !== 0) {
      throw new Error(`Cancelled settlement altered balances! Got ${postCancelBalA}/${postCancelBalB}`);
    }
    console.log("   ✓ Cancelled settlement correctly disregarded in balance calculation");

    console.log("\n🎉 ALL SETTLEMENT AFFIRMATION TESTS PASSED SUCCESSFULLY!");
  } finally {
    // Cleanup
    await db.delete(settlements).where(eq(settlements.groupId, groupId));
    await db.delete(expenseSplits).where(eq(expenseSplits.userId, userAId));
    await db.delete(expenseSplits).where(eq(expenseSplits.userId, userBId));
    await db.delete(expenses).where(eq(expenses.groupId, groupId));
    await db.delete(messages).where(eq(messages.groupId, groupId));
    await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(users).where(eq(users.id, userAId));
    await db.delete(users).where(eq(users.id, userBId));
  }
}

runSettlementAffirmationTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  });
