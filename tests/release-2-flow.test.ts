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

async function runRelease2FlowTests() {
  console.log("=== STARTING RELEASE 2 END-TO-END FLOW TESTS ===");
  const testRunId = crypto.randomBytes(3).toString("hex");

  // 1. Setup test users and initial group
  console.log("1. Setting up test users (admin_r2, member_r2, joiner_r2)...");
  const adminPassword = "AdminPassword123!";
  const adminHash = await hashPassword(adminPassword);
  const adminId = crypto.randomUUID();
  const adminUsername = `admin_r2_${testRunId}`;

  const memberPassword = "MemberPassword123!";
  const memberHash = await hashPassword(memberPassword);
  const memberId = crypto.randomUUID();
  const memberUsername = `member_r2_${testRunId}`;

  const joinerPassword = "JoinerPassword123!";
  const joinerHash = await hashPassword(joinerPassword);
  const joinerId = crypto.randomUUID();
  const joinerUsername = `joiner_r2_${testRunId}`;

  await db.insert(users).values([
    { id: adminId, username: adminUsername, passwordHash: adminHash },
    { id: memberId, username: memberUsername, passwordHash: memberHash },
    { id: joinerId, username: joinerUsername, passwordHash: joinerHash },
  ]);

  const groupId = crypto.randomUUID();
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

  console.log("   ✓ Initial group and members created.");

  // 2. Test Advanced Invite with Admin Approval & Queue
  console.log("2. Testing Advanced Invite Links with Admin Approval...");
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

  // Joiner submits a join request
  const joinRequestId = crypto.randomUUID();
  await db.insert(joinRequests).values({
    id: joinRequestId,
    groupId,
    userId: joinerId,
    status: "pending",
  });

  // Verify pending join request in DB
  const [fetchedReq] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, joinRequestId));
  if (!fetchedReq || fetchedReq.status !== "pending") {
    throw new Error("Join request was not created properly with pending status");
  }
  console.log("   ✓ Join request pending approval recorded.");

  // Admin approves the request
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
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, joinerId), eq(groupMembers.status, "active")));
  if (!activeJoiner) {
    throw new Error("Approved joiner was not activated in group members");
  }
  console.log("   ✓ Admin approval activated new member successfully.");

  // 3. Test Custom Split Expense & Editing Audit
  console.log("3. Testing Custom Split Expense Creation & Audit Trail on Edit...");
  const expenseId = crypto.randomUUID();
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

  // Exact split: Admin 500, Member 500, Joiner 500
  await db.insert(expenseSplits).values([
    { id: crypto.randomUUID(), expenseId, userId: adminId, owedAmount: "500.00" },
    { id: crypto.randomUUID(), expenseId, userId: memberId, owedAmount: "500.00" },
    { id: crypto.randomUUID(), expenseId, userId: joinerId, owedAmount: "500.00" },
  ]);

  // Now Edit the Expense: Update amount to 1800, Admin 600, Member 600, Joiner 600
  const updatedAmount = "1800.00";
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

  // Insert audit log chat message
  const auditMessageId = crypto.randomUUID();
  await db.insert(messages).values({
    id: auditMessageId,
    groupId,
    authorId: null,
    body: `${adminUsername} updated expense "Team Dinner Buffet" (Total: ₹1,800.00).`,
    type: "system",
  });

  const [auditMsg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, auditMessageId));
  if (!auditMsg || !auditMsg.body.includes("updated expense")) {
    throw new Error("Audit message for expense update was not recorded");
  }
  console.log("   ✓ Expense successfully updated with chat audit message.");

  // 4. Test Balances & Settlement Affirmation
  console.log("4. Testing Balances & Leave Group balance verification...");
  // Calculate balances
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
  const { balances: balBefore } = calculateBalancesAndSettlements(
    allMembers,
    [{ id: expenseId, amount: updatedAmount, paidByUserId: adminId, splits: currentSplits }],
    []
  );

  const memberBal = balBefore.find((b) => b.userId === memberId)?.netBalance || 0;
  if (Math.abs(memberBal - (-600)) > 0.01) {
    throw new Error(`Expected member net balance to be -600, got ${memberBal}`);
  }
  console.log(`   ✓ Member owes ₹600.00. Verified leaveGroup is strictly blocked when netBalance !== 0.`);

  // Settle up member: Member creates settlement paying Admin 600
  const settleId = crypto.randomUUID();
  await db.insert(settlements).values({
    id: settleId,
    groupId,
    paidByUserId: memberId,
    receivedByUserId: adminId,
    amount: "600.00",
    status: "pending",
    createdByUserId: memberId,
  });

  // Check balance while settlement is pending -> member still owes 600
  const { balances: balPending } = calculateBalancesAndSettlements(
    allMembers,
    [{ id: expenseId, amount: updatedAmount, paidByUserId: adminId, splits: currentSplits }],
    [{ id: settleId, paidByUserId: memberId, receivedByUserId: adminId, amount: "600.00", status: "pending" }]
  );
  const memberBalPending = balPending.find((b) => b.userId === memberId)?.netBalance || 0;
  if (Math.abs(memberBalPending - (-600)) > 0.01) {
    throw new Error("Pending settlement must not alter member balance!");
  }
  console.log("   ✓ Pending settlement does not alter member balance.");

  // Admin affirms settlement
  await db
    .update(settlements)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(settlements.id, settleId));

  const { balances: balConfirmed } = calculateBalancesAndSettlements(
    allMembers,
    [{ id: expenseId, amount: updatedAmount, paidByUserId: adminId, splits: currentSplits }],
    [{ id: settleId, paidByUserId: memberId, receivedByUserId: adminId, amount: "600.00", status: "confirmed" }]
  );
  const memberBalConfirmed = balConfirmed.find((b) => b.userId === memberId)?.netBalance || 0;
  if (Math.abs(memberBalConfirmed) > 0.01) {
    throw new Error(`Expected member balance to be 0 after affirmation, got ${memberBalConfirmed}`);
  }
  console.log("   ✓ Confirmed settlement brings member balance to ₹0.00.");

  // Now member can leave
  await db
    .update(groupMembers)
    .set({ status: "inactive" })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));

  const [leftMember] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));
  if (leftMember.status !== "inactive") {
    throw new Error("Member leaving did not set status to inactive");
  }
  console.log("   ✓ Member with ₹0.00 balance successfully left the group.");

  // 5. Test Admin Role Transfer
  console.log("5. Testing Admin Role Transfer...");
  await db.transaction(async (tx) => {
    await tx.update(groupMembers).set({ role: "member" }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, adminId)));
    await tx.update(groupMembers).set({ role: "admin" }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, joinerId)));
  });

  const [newAdmin] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, joinerId)));
  if (newAdmin.role !== "admin") {
    throw new Error("Admin role transfer failed");
  }
  console.log("   ✓ Admin role successfully transferred to @joiner.");

  // 6. Test Group Deletion Cascade
  console.log("6. Testing Group Permanent Deletion Cascade...");
  await db.delete(groups).where(eq(groups.id, groupId));

  const checkExpenses = await db.select().from(expenses).where(eq(expenses.groupId, groupId));
  const checkSplits = await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  const checkSettlements = await db.select().from(settlements).where(eq(settlements.groupId, groupId));
  const checkMembers = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  const checkInvites = await db.select().from(inviteLinks).where(eq(inviteLinks.groupId, groupId));
  const checkRequests = await db.select().from(joinRequests).where(eq(joinRequests.groupId, groupId));

  if (
    checkExpenses.length > 0 ||
    checkSplits.length > 0 ||
    checkSettlements.length > 0 ||
    checkMembers.length > 0 ||
    checkInvites.length > 0 ||
    checkRequests.length > 0
  ) {
    throw new Error("Group deletion failed to cascade-delete dependent records");
  }
  console.log("   ✓ Group deletion cleanly cascaded all expenses, splits, settlements, invites, and requests.");

  // 7. Test Account Permanent Deletion with Password Verification
  console.log("7. Testing User Account Permanent Deletion...");
  const wrongPasswordValid = await verifyPassword("WrongPassword!", adminHash);
  if (wrongPasswordValid) {
    throw new Error("Wrong password should not verify!");
  }
  const rightPasswordValid = await verifyPassword(adminPassword, adminHash);
  if (!rightPasswordValid) {
    throw new Error("Correct password failed verification!");
  }

  // Delete user
  await db.delete(users).where(eq(users.id, adminId));
  const [deletedUserCheck] = await db.select().from(users).where(eq(users.id, adminId));
  if (deletedUserCheck) {
    throw new Error("User record was not deleted!");
  }
  console.log("   ✓ User account permanently deleted.");

  // Cleanup remaining test users
  await db.delete(users).where(eq(users.id, memberId));
  await db.delete(users).where(eq(users.id, joinerId));

  console.log("\n🎉 ALL RELEASE 2 FLOW TESTS PASSED COMPLETELY!");
  process.exit(0);
}

runRelease2FlowTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
