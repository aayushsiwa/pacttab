import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  groups,
  groupMembers,
  expenses,
  expenseSplits,
  settlements,
  directInvites,
} from "../src/db/schema";
import { calculateBalancesAndSettlements } from "../src/lib/balances";
import { createExpense, recordSettlement, confirmSettlement } from "../src/lib/expense-service";
import { leaveGroup } from "../src/lib/group-service";
import { deleteUserAccount } from "../src/lib/auth-service";

const testRunId = crypto.randomBytes(4).toString("hex");

const admin = { id: crypto.randomUUID(), username: `dm_admin_${testRunId}` };
const alice = { id: crypto.randomUUID(), username: `dm_alice_${testRunId}` };
const bob = { id: crypto.randomUUID(), username: `dm_bob_${testRunId}` };
const dave = { id: crypto.randomUUID(), username: `dm_dave_${testRunId}` };

const groupIds = {
  record: crypto.randomUUID(),
  expense: crypto.randomUUID(),
  confirm: crypto.randomUUID(),
  delete: crypto.randomUUID(),
  leave: crypto.randomUUID(),
  cancel: crypto.randomUUID(),
};

async function createGroup(id: string, name: string) {
  await db.insert(groups).values({ id, name, createdBy: admin.id });
}

async function addMember(groupId: string, userId: string, status = "active", role = "member") {
  await db.insert(groupMembers).values({
    id: crypto.randomUUID(),
    groupId,
    userId,
    role,
    status,
  });
}

async function addExpense(
  groupId: string,
  id: string,
  amount: string,
  payerId: string,
  splits: { userId: string; owedAmount: string }[]
) {
  await db.insert(expenses).values({
    id,
    groupId,
    description: "Test expense",
    amount,
    paidByUserId: payerId,
    createdBy: payerId,
  });
  for (const split of splits) {
    await db.insert(expenseSplits).values({
      id: crypto.randomUUID(),
      expenseId: id,
      userId: split.userId,
      owedAmount: split.owedAmount,
    });
  }
}

beforeAll(async () => {
  await db.insert(users).values([admin, alice, bob, dave]);

  await createGroup(groupIds.record, `Record ${testRunId}`);
  await addMember(groupIds.record, admin.id, "active", "admin");
  await addMember(groupIds.record, alice.id);
  await addMember(groupIds.record, bob.id, "inactive");

  await createGroup(groupIds.expense, `Expense ${testRunId}`);
  await addMember(groupIds.expense, admin.id, "active", "admin");
  await addMember(groupIds.expense, alice.id);
  await addMember(groupIds.expense, bob.id, "inactive");

  await createGroup(groupIds.confirm, `Confirm ${testRunId}`);
  await addMember(groupIds.confirm, admin.id, "active", "admin");
  await addMember(groupIds.confirm, alice.id);

  await createGroup(groupIds.delete, `Delete ${testRunId}`);
  await addMember(groupIds.delete, admin.id, "active", "admin");
  await addMember(groupIds.delete, alice.id);

  await createGroup(groupIds.leave, `Leave ${testRunId}`);
  await addMember(groupIds.leave, admin.id, "active", "admin");
  await addMember(groupIds.leave, alice.id);

  await createGroup(groupIds.cancel, `Cancel ${testRunId}`);
  await addMember(groupIds.cancel, admin.id, "active", "admin");
  await addMember(groupIds.cancel, alice.id);
});

afterAll(async () => {
  for (const groupId of Object.values(groupIds)) {
    await db.delete(groups).where(eq(groups.id, groupId));
  }
  for (const user of [admin, alice, bob, dave]) {
    await db.delete(users).where(eq(users.id, user.id));
  }
});

describe("departed members in balance math", () => {
  it("keeps the ledger zero-sum when an inactive member is referenced", () => {
    const members = [
      { id: admin.id, username: admin.username, isActive: true },
      { id: bob.id, username: bob.username, isActive: false },
    ];

    const { balances } = calculateBalancesAndSettlements(
      members,
      [
        {
          id: crypto.randomUUID(),
          amount: "200.00",
          paidByUserId: admin.id,
          splits: [
            { userId: admin.id, owedAmount: "100.00" },
            { userId: bob.id, owedAmount: "100.00" },
          ],
        },
      ],
      [
        {
          id: crypto.randomUUID(),
          amount: "100.00",
          paidByUserId: bob.id,
          receivedByUserId: admin.id,
          status: "confirmed",
        },
      ]
    );

    const totalCents = balances.reduce((sum, b) => sum + Math.round(b.netBalance * 100), 0);
    expect(totalCents).toBe(0);
    expect(balances.find((b) => b.userId === admin.id)?.netBalance).toBe(0);
    expect(balances.find((b) => b.userId === bob.id)?.netBalance).toBe(0);
  });

  it("surfaces a departed member with a residual as a ghost in suggested settlements", () => {
    const members = [
      { id: admin.id, username: admin.username, isActive: true },
      { id: alice.id, username: alice.username, isActive: true },
      { id: bob.id, username: bob.username, isActive: false },
    ];

    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      members,
      [
        {
          id: crypto.randomUUID(),
          amount: "300.00",
          paidByUserId: admin.id,
          splits: [
            { userId: admin.id, owedAmount: "100.00" },
            { userId: alice.id, owedAmount: "100.00" },
            { userId: bob.id, owedAmount: "100.00" },
          ],
        },
      ],
      [
        {
          id: crypto.randomUUID(),
          amount: "100.00",
          paidByUserId: alice.id,
          receivedByUserId: admin.id,
          status: "confirmed",
        },
      ]
    );

    const totalCents = balances.reduce((sum, b) => sum + Math.round(b.netBalance * 100), 0);
    expect(totalCents).toBe(0);

    const ghost = balances.find((b) => b.userId === bob.id);
    expect(ghost?.isActive).toBe(false);
    expect(ghost?.netBalance).toBe(-100);

    expect(suggestedSettlements).toContainEqual({
      fromUserId: bob.id,
      fromUsername: bob.username,
      toUserId: admin.id,
      toUsername: admin.username,
      amount: 100,
    });
  });
});

describe("write-path validations", () => {
  it("rejects a settlement where a party is an inactive member", async () => {
    const result = await recordSettlement(admin, groupIds.record, {
      paidByUserId: alice.id,
      receivedByUserId: bob.id,
      amount: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/active members/i);
  });

  it("rejects an expense that includes an inactive participant", async () => {
    const result = await createExpense(admin, groupIds.expense, {
      description: "Ghost lunch",
      amount: 100,
      paidByUserId: admin.id,
      participantUserIds: [bob.id],
      splitType: "equal",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/active members/i);
  });

  it("rejects confirming a settlement after a party leaves", async () => {
    const settlementId = crypto.randomUUID();
    await db.insert(settlements).values({
      id: settlementId,
      groupId: groupIds.confirm,
      paidByUserId: alice.id,
      receivedByUserId: admin.id,
      amount: "50.00",
      status: "pending",
      createdByUserId: alice.id,
    });
    await db
      .update(groupMembers)
      .set({ status: "inactive" })
      .where(and(eq(groupMembers.groupId, groupIds.confirm), eq(groupMembers.userId, alice.id)));

    const result = await confirmSettlement(admin, groupIds.confirm, settlementId);

    expect(result.success).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/active members/i);

    const [row] = await db
      .select({ status: settlements.status })
      .from(settlements)
      .where(eq(settlements.id, settlementId));
    expect(row.status).toBe("pending");
  });
});

describe("account deletion", () => {
  it("blocks deletion while the user owes money in a group", async () => {
    await addExpense(groupIds.delete, crypto.randomUUID(), "100.00", admin.id, [
      { userId: admin.id, owedAmount: "50.00" },
      { userId: alice.id, owedAmount: "50.00" },
    ]);

    const result = await deleteUserAccount(alice, { password: "irrelevant" });
    if (result.success) throw new Error("Expected deletion to be blocked");
    expect(result.error).toMatch(/unsettled balances/i);
    expect(result.error).toContain(`Delete ${testRunId}`);
  });
});

describe("leave gate", () => {
  it("blocks leaving with a one-paise balance", async () => {
    await addExpense(groupIds.leave, crypto.randomUUID(), "0.02", admin.id, [
      { userId: admin.id, owedAmount: "0.01" },
      { userId: alice.id, owedAmount: "0.01" },
    ]);

    const result = await leaveGroup(alice, groupIds.leave);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/owe ₹0\.01/i);

    const [membership] = await db
      .select({ status: groupMembers.status })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupIds.leave), eq(groupMembers.userId, alice.id)));
    expect(membership.status).toBe("active");
  });

  it("cancels pending settlements and revokes invites on leave", async () => {
    const settlementId = crypto.randomUUID();
    await db.insert(settlements).values({
      id: settlementId,
      groupId: groupIds.cancel,
      paidByUserId: admin.id,
      receivedByUserId: alice.id,
      amount: "5.00",
      status: "pending",
      createdByUserId: admin.id,
    });

    const sentInviteId = crypto.randomUUID();
    const receivedInviteId = crypto.randomUUID();
    await db.insert(directInvites).values([
      {
        id: sentInviteId,
        groupId: groupIds.cancel,
        inviterId: alice.id,
        inviteeId: dave.id,
        token: crypto.randomBytes(16).toString("hex"),
        status: "pending",
      },
      {
        id: receivedInviteId,
        groupId: groupIds.cancel,
        inviterId: admin.id,
        inviteeId: alice.id,
        token: crypto.randomBytes(16).toString("hex"),
        status: "pending",
      },
    ]);

    const result = await leaveGroup(alice, groupIds.cancel);
    expect(result.success).toBe(true);

    const [settlement] = await db
      .select({ status: settlements.status })
      .from(settlements)
      .where(eq(settlements.id, settlementId));
    expect(settlement.status).toBe("cancelled");

    const invites = await db
      .select({ id: directInvites.id, status: directInvites.status })
      .from(directInvites)
      .where(eq(directInvites.groupId, groupIds.cancel));
    expect(invites).toHaveLength(2);
    for (const invite of invites) {
      expect(invite.status).toBe("revoked");
    }
  });
});
