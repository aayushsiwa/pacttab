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

async function runAdminNotificationTests() {
  console.log("=== STARTING ADMIN ACTION NOTIFICATIONS TEST SUITE ===");
  const testRunId = crypto.randomBytes(3).toString("hex");

  // 1. Setup test users and group
  console.log("1. Setting up admin, member, and joiner users...");
  const pwdHash = await hashPassword("TestPassword123!");
  const adminId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const joinerId = crypto.randomUUID();

  await db.insert(users).values([
    { id: adminId, username: `admin_notif_${testRunId}`, passwordHash: pwdHash },
    { id: memberId, username: `member_notif_${testRunId}`, passwordHash: pwdHash },
    { id: joinerId, username: `joiner_notif_${testRunId}`, passwordHash: pwdHash },
  ]);

  const groupId = crypto.randomUUID();
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

  console.log("   ✓ Admin, member, and group initialized.");

  // 2. Initial state verification: 0 pending actions
  console.log("2. Verifying initial state: zero pending actions...");
  const initialAdminCount = await getUserPendingAdminActionsCount(adminId);
  const initialMemberCount = await getUserPendingAdminActionsCount(memberId);
  const initialAdminGroups = await getUserGroups(adminId);

  if (initialAdminCount !== 0 || initialMemberCount !== 0) {
    throw new Error(`Expected initial counts to be 0, got admin=${initialAdminCount}, member=${initialMemberCount}`);
  }

  const initialGroupItem = initialAdminGroups.find((g) => g.id === groupId);
  if (!initialGroupItem || initialGroupItem.pendingActionCount !== 0 || initialGroupItem.pendingJoinRequestsCount !== 0) {
    throw new Error(`Expected group pending counts to be 0, got: ${JSON.stringify(initialGroupItem)}`);
  }
  console.log("   ✓ Initial action counts verified at 0.");

  // 3. User submits a join request -> admin should see pending action count
  console.log("3. Creating pending join request for joiner...");
  const requestId = crypto.randomUUID();
  await db.insert(joinRequests).values({
    id: requestId,
    groupId,
    userId: joinerId,
    status: "pending",
  });

  const postRequestAdminCount = await getUserPendingAdminActionsCount(adminId);
  const postRequestMemberCount = await getUserPendingAdminActionsCount(memberId);
  const postRequestAdminGroups = await getUserGroups(adminId);
  const postRequestMemberGroups = await getUserGroups(memberId);

  if (postRequestAdminCount !== 1) {
    throw new Error(`Expected admin pending action count to be 1, got ${postRequestAdminCount}`);
  }
  if (postRequestMemberCount !== 0) {
    throw new Error(`Expected member pending action count to remain 0, got ${postRequestMemberCount}`);
  }

  const adminGroupItem = postRequestAdminGroups.find((g) => g.id === groupId);
  if (
    !adminGroupItem ||
    adminGroupItem.pendingJoinRequestsCount !== 1 ||
    adminGroupItem.pendingActionCount !== 1
  ) {
    throw new Error(`Expected admin group pendingJoinRequestsCount=1, pendingActionCount=1, got: ${JSON.stringify(adminGroupItem)}`);
  }

  const memberGroupItem = postRequestMemberGroups.find((g) => g.id === groupId);
  if (
    !memberGroupItem ||
    memberGroupItem.pendingJoinRequestsCount !== 0 ||
    memberGroupItem.pendingActionCount !== 0
  ) {
    throw new Error(`Expected non-admin member group pendingJoinRequestsCount=0, got: ${JSON.stringify(memberGroupItem)}`);
  }
  console.log("   ✓ Admin sees pending join request notification count (1); non-admin member sees 0.");

  // 4. Test pending settlement affirmation notification
  console.log("4. Recording pending settlement where admin is counterparty...");
  const settlementId = crypto.randomUUID();
  await db.insert(settlements).values({
    id: settlementId,
    groupId,
    paidByUserId: memberId,
    receivedByUserId: adminId,
    amount: "500.00",
    status: "pending",
    createdByUserId: memberId, // member created, admin needs to affirm
  });

  const adminGroupsWithSettlement = await getUserGroups(adminId);
  const adminGroupItemWithSettlement = adminGroupsWithSettlement.find((g) => g.id === groupId);

  if (
    !adminGroupItemWithSettlement ||
    adminGroupItemWithSettlement.pendingJoinRequestsCount !== 1 ||
    adminGroupItemWithSettlement.pendingSettlementsCount !== 1 ||
    adminGroupItemWithSettlement.pendingActionCount !== 2
  ) {
    throw new Error(
      `Expected admin group pendingJoinRequestsCount=1, pendingSettlementsCount=1, pendingActionCount=2, got: ${JSON.stringify(
        adminGroupItemWithSettlement
      )}`
    );
  }
  console.log("   ✓ Group shows combined pending action count (1 join request + 1 settlement = 2 actions).");

  // 5. Resolving join request -> pending count decreases
  console.log("5. Resolving join request (approving joiner)...");
  await db
    .update(joinRequests)
    .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() })
    .where(eq(joinRequests.id, requestId));

  const postApprovalAdminCount = await getUserPendingAdminActionsCount(adminId);
  if (postApprovalAdminCount !== 0) {
    throw new Error(`Expected admin pending action count to decrease to 0, got ${postApprovalAdminCount}`);
  }

  const finalAdminGroups = await getUserGroups(adminId);
  const finalGroupItem = finalAdminGroups.find((g) => g.id === groupId);
  if (finalGroupItem?.pendingJoinRequestsCount !== 0) {
    throw new Error(`Expected pendingJoinRequestsCount to be 0 after approval, got ${finalGroupItem?.pendingJoinRequestsCount}`);
  }
  console.log("   ✓ Action counts successfully reset to 0 after request resolution.");

  // 6. Cleanup test records
  console.log("6. Cleaning up test data...");
  await db.delete(groups).where(eq(groups.id, groupId));
  await db.delete(users).where(eq(users.id, adminId));
  await db.delete(users).where(eq(users.id, memberId));
  await db.delete(users).where(eq(users.id, joinerId));
  console.log("   ✓ Cleanup complete.");

  console.log("\n🎉 ALL ADMIN ACTION NOTIFICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runAdminNotificationTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
