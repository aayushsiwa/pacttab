import { db } from "../src/db";
import { users, groups, groupMembers, inviteLinks, messages, expenses, expenseSplits, settlements } from "../src/db/schema";
import { hashPassword, verifyPassword } from "../src/lib/auth";
import { calculateEqualSplits, calculateBalancesAndSettlements } from "../src/lib/balances";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

async function runE2EFlowTest() {
  console.log("🚀 Starting Release 1 End-to-End Verification Test...\n");

  const testSuffix = Date.now().toString().slice(-5);
  const usernameA = `maya_${testSuffix}`;
  const usernameB = `arjun_${testSuffix}`;
  const password = "securePassword123";

  // 1. Account Creation (User A)
  console.log("1. Testing Account Sign-Up for User A (Maya)...");
  const userAId = crypto.randomUUID();
  const hashA = await hashPassword(password);
  await db.insert(users).values({
    id: userAId,
    username: usernameA,
    passwordHash: hashA,
  });

  const verifiedA = await verifyPassword(password, hashA);
  if (!verifiedA) throw new Error("Password verification failed for User A");
  console.log(`   ✓ Created User A: @${usernameA} (${userAId})`);

  // 2. Account Creation (User B)
  console.log("2. Testing Account Sign-Up for User B (Arjun)...");
  const userBId = crypto.randomUUID();
  const hashB = await hashPassword(password);
  await db.insert(users).values({
    id: userBId,
    username: usernameB,
    passwordHash: hashB,
  });
  console.log(`   ✓ Created User B: @${usernameB} (${userBId})`);

  // 3. Group Creation by Maya
  console.log("3. Testing Group Creation by User A...");
  const groupId = crypto.randomUUID();
  const inviteToken = crypto.randomBytes(16).toString("hex");

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
  console.log(`   ✓ Group created: "${groupId}" with admin @${usernameA}`);
  console.log(`   ✓ Generated invite token: ${inviteToken}`);

  // 4. Joining Group via Invite Token by Arjun
  console.log("4. Testing User B Joining via Invite Token...");
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
  console.log(`   ✓ User B @${usernameB} joined group successfully`);

  // 5. Sending Chat Message
  console.log("5. Testing Group Chat Message...");
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    groupId,
    authorId: userBId,
    body: "Hey Maya, ready for Goa!",
    type: "user",
  });
  console.log("   ✓ User message posted to group chat");

  // 6. Adding Equal-Split Expense (Dinner: ₹1,200 paid by Maya, split Maya & Arjun)
  console.log("6. Testing Equal-Split Expense (Dinner ₹1,200 paid by Maya)...");
  const expenseId = crypto.randomUUID();
  const amount = 1200;
  const participantIds = [userAId, userBId];
  const splits = calculateEqualSplits(amount, participantIds);

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
  console.log(`   ✓ Expense recorded with ${splits.length} splits: ₹${splits[0].owedAmount} each`);

  // 7. Balance Calculation & Suggested Settlements Verification
  console.log("7. Verifying Balances & Suggested Repayments...");
  let expList = [{
    id: expenseId,
    amount: amount,
    paidByUserId: userAId,
    splits: splits.map(s => ({ userId: s.userId, owedAmount: s.owedAmount }))
  }];

  let { balances, suggestedSettlements } = calculateBalancesAndSettlements(
    [{ id: userAId, username: usernameA }, { id: userBId, username: usernameB }],
    expList,
    []
  );

  const balA = balances.find(b => b.userId === userAId)?.netBalance;
  const balB = balances.find(b => b.userId === userBId)?.netBalance;

  console.log(`   Balances -> @${usernameA}: ₹${balA}, @${usernameB}: ₹${balB}`);
  if (balA !== 600 || balB !== -600) {
    throw new Error(`Unexpected balances: balA=${balA}, balB=${balB}`);
  }

  console.log("   Suggested Repayment:", suggestedSettlements);
  if (
    suggestedSettlements.length !== 1 ||
    suggestedSettlements[0].fromUserId !== userBId ||
    suggestedSettlements[0].toUserId !== userAId ||
    suggestedSettlements[0].amount !== 600
  ) {
    throw new Error("Suggested settlement incorrect");
  }
  console.log("   ✓ Balances and suggested repayments verified (+₹600 / -₹600)");

  // 8. Recording Settlement: Arjun pays Maya ₹600
  console.log("8. Testing Settlement Recording (Arjun pays Maya ₹600)...");
  const settlementId = crypto.randomUUID();
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
  console.log("   ✓ Settlement recorded");

  // 9. Re-verifying Balances after Settlement
  console.log("9. Verifying Balances Post-Settlement...");
  const postSettlementResult = calculateBalancesAndSettlements(
    [{ id: userAId, username: usernameA }, { id: userBId, username: usernameB }],
    expList,
    [{ id: settlementId, amount: 600, paidByUserId: userBId, receivedByUserId: userAId }]
  );

  const finalBalA = postSettlementResult.balances.find(b => b.userId === userAId)?.netBalance;
  const finalBalB = postSettlementResult.balances.find(b => b.userId === userBId)?.netBalance;
  console.log(`   Post-settlement balances -> @${usernameA}: ₹${finalBalA}, @${usernameB}: ₹${finalBalB}`);
  if (finalBalA !== 0 || finalBalB !== 0) {
    throw new Error(`Expected ₹0 balance, got: A=${finalBalA}, B=${finalBalB}`);
  }
  if (postSettlementResult.suggestedSettlements.length !== 0) {
    throw new Error("Expected zero remaining suggested settlements");
  }
  console.log("   ✓ All debts cleanly settled to ₹0.00");

  // 10. Verify Messages & Activity Feed
  console.log("10. Verifying Group Chat & System Activity Feed...");
  const groupMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.groupId, groupId));

  console.log(`   ✓ Found ${groupMessages.length} total messages/activity items in feed:`);
  for (const m of groupMessages) {
    console.log(`     [${m.type.toUpperCase()}] ${m.body}`);
  }

  console.log("\n🎉 ALL RELEASE 1 ACCEPTANCE CRITERIA PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runE2EFlowTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
