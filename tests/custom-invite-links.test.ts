import "dotenv/config";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import { users, groups, groupMembers, inviteLinks } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { createInviteLinkAction, joinGroupAction } from "../src/actions/groups";

async function runCustomInviteLinksTest() {
  console.log("=== STARTING CUSTOM INVITE LINKS TEST SUITE ===");
  const testRunId = crypto.randomBytes(3).toString("hex");

  // 1. Setup Admin user and Group
  console.log("1. Setting up admin user and group...");
  const adminId = crypto.randomUUID();
  const adminUsername = `admin_inv_${testRunId}`;
  const adminHash = await hashPassword("AdminPassword123!");

  await db.insert(users).values({
    id: adminId,
    username: adminUsername,
    passwordHash: adminHash,
  });

  const groupId = crypto.randomUUID();
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
  console.log("   ✓ Admin and group ready.");

  // Mock authentication session for server actions
  process.env.TEST_CURRENT_USER_ID = adminId;

  // 2. Test Custom Slug Creation
  console.log("2. Testing Custom Slug Invite Link Creation...");
  const customSlug = `summer-retreat-${testRunId}`;
  const createRes = await createInviteLinkAction(groupId, {
    customSlug,
    expiresInHours: 48,
    maxUses: 10,
  });

  if (!createRes.success || createRes.token !== customSlug) {
    throw new Error(`Failed to create custom slug invite: ${createRes.error}`);
  }

  const [dbInvite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.token, customSlug));

  if (!dbInvite || dbInvite.groupId !== groupId || dbInvite.maxUses !== 10) {
    throw new Error("Custom invite link record in DB did not match expected values");
  }
  console.log(`   ✓ Successfully created custom invite link with slug "${customSlug}".`);

  // 3. Test Duplicate Slug Collision Detection
  console.log("3. Testing Duplicate Slug Collision Detection...");
  const dupRes = await createInviteLinkAction(groupId, {
    customSlug,
  });
  if (dupRes.success) {
    throw new Error("Duplicate custom slug was allowed when it should have been rejected!");
  }
  if (!dupRes.error?.includes("already in use")) {
    throw new Error(`Unexpected error message for duplicate slug: ${dupRes.error}`);
  }
  console.log("   ✓ Correctly rejected duplicate slug with collision error.");

  // 4. Test Invalid Slug Format Rejections
  console.log("4. Testing Invalid Format Rejections...");
  const tooShortRes = await createInviteLinkAction(groupId, { customSlug: "ab" });
  if (tooShortRes.success) {
    throw new Error("Slug with <3 characters should have failed!");
  }
  console.log("   ✓ Correctly rejected slug with <3 characters.");

  const invalidCharRes = await createInviteLinkAction(groupId, { customSlug: "bad slug with spaces!" });
  if (invalidCharRes.success) {
    throw new Error("Slug with spaces and exclamation mark should have failed!");
  }
  console.log("   ✓ Correctly rejected slug with invalid characters.");

  // 5. Test Reserved Words Rejection
  console.log("5. Testing Reserved Slug Rejection...");
  const reservedRes = await createInviteLinkAction(groupId, { customSlug: "login" });
  if (reservedRes.success) {
    throw new Error("Reserved slug 'login' should have failed!");
  }
  if (!reservedRes.error?.includes("reserved")) {
    throw new Error(`Unexpected error message for reserved slug: ${reservedRes.error}`);
  }
  console.log("   ✓ Correctly rejected reserved slug 'login'.");

  // 6. Test Default Random Token When Custom Slug Omitted
  console.log("6. Testing Default Random Hex Generation when slug is omitted...");
  const randomRes = await createInviteLinkAction(groupId);
  if (!randomRes.success || !randomRes.token || randomRes.token.length !== 32) {
    throw new Error(`Random token generation failed: token=${randomRes.token}`);
  }
  console.log(`   ✓ Successfully generated 32-char random token: ${randomRes.token}`);

  // 7. Test End-to-End Joining with Custom Slug
  console.log("7. Testing End-to-End Joining using the Custom Slug...");
  const joinerId = crypto.randomUUID();
  const joinerUsername = `joiner_cust_${testRunId}`;
  const joinerHash = await hashPassword("JoinerPassword123!");

  await db.insert(users).values({
    id: joinerId,
    username: joinerUsername,
    passwordHash: joinerHash,
  });

  // Switch session to joiner
  process.env.TEST_CURRENT_USER_ID = joinerId;

  const joinRes = await joinGroupAction(customSlug);
  if (!joinRes.success || joinRes.groupId !== groupId) {
    throw new Error(`Joining group via custom slug failed: ${joinRes.error}`);
  }

  // Verify membership active
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, joinerId), eq(groupMembers.status, "active")));

  if (!membership) {
    throw new Error("Joiner active membership record not found!");
  }

  // Verify invite use count incremented
  const [updatedInvite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.token, customSlug));

  if (updatedInvite.useCount !== 1) {
    throw new Error(`Expected use count 1, got ${updatedInvite.useCount}`);
  }
  console.log("   ✓ Joiner joined group via custom slug; invite use count incremented.");

  // Cleanup test data
  console.log("8. Cleaning up test data...");
  await db.delete(groups).where(eq(groups.id, groupId));
  await db.delete(users).where(eq(users.id, adminId));
  await db.delete(users).where(eq(users.id, joinerId));
  console.log("   ✓ Cleaned up test data.");

  console.log("\n🎉 ALL CUSTOM INVITE LINKS TESTS PASSED SUCCESSFULLY!");
}

runCustomInviteLinksTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  });
