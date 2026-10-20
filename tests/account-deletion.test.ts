import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  accounts,
  users,
  groups,
  groupMembers,
  expenses,
  expenseSplits,
  settlements,
  sessions,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { deleteUserAccount } from "../src/lib/auth-service";

const testRunId = crypto.randomBytes(4).toString("hex");

const admin = { id: crypto.randomUUID(), username: `fd_admin_${testRunId}` };
const member = { id: crypto.randomUUID(), username: `fd_member_${testRunId}` };
const groupId = crypto.randomUUID();
const expenseId = crypto.randomUUID();
const memberPassword = "MemberPassword123!";

describe("account deletion preserves shared history", () => {
  beforeAll(async () => {
    await db.insert(users).values([admin, member]);

    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: member.id,
      providerId: "credential",
      userId: member.id,
      password: await hashPassword(memberPassword),
    });

    await db.insert(groups).values({
      id: groupId,
      name: `History Group ${testRunId}`,
      createdBy: admin.id,
    });

    await db.insert(groupMembers).values([
      { id: crypto.randomUUID(), groupId, userId: admin.id, role: "admin", status: "active" },
      { id: crypto.randomUUID(), groupId, userId: member.id, role: "member", status: "active" },
    ]);

    await db.insert(expenses).values({
      id: expenseId,
      groupId,
      description: "Shared dinner",
      amount: "100.00",
      paidByUserId: admin.id,
      createdBy: admin.id,
    });

    await db.insert(expenseSplits).values({
      id: crypto.randomUUID(),
      expenseId,
      userId: member.id,
      owedAmount: "50.00",
    });

    await db.insert(settlements).values({
      id: crypto.randomUUID(),
      groupId,
      paidByUserId: member.id,
      receivedByUserId: admin.id,
      amount: "50.00",
      status: "confirmed",
      createdByUserId: member.id,
    });
  });

  afterAll(async () => {
    await db.delete(settlements).where(eq(settlements.groupId, groupId));
    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    await db.delete(expenses).where(eq(expenses.groupId, groupId));
    await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(sessions).where(eq(sessions.userId, member.id));
    await db.delete(accounts).where(eq(accounts.userId, member.id));
    await db.delete(users).where(eq(users.id, admin.id));
    await db.delete(users).where(eq(users.id, member.id));
  });

  it("anonymises the account while keeping every history row", async () => {
    const result = await deleteUserAccount(member, { password: memberPassword });

    expect(result.success).toBe(true);

    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row).toBeDefined();
    expect(row.username).toMatch(/^deleted_/);
    expect(row.email).toBeNull();
    expect(row.name).toBeNull();
    expect(row.image).toBeNull();

    const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
    expect(expense).toBeDefined();

    const splits = await db
      .select()
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId));
    expect(splits).toHaveLength(1);
    expect(splits[0].userId).toBe(member.id);

    const settlementRows = await db
      .select()
      .from(settlements)
      .where(eq(settlements.groupId, groupId));
    expect(settlementRows).toHaveLength(1);
    expect(settlementRows[0].paidByUserId).toBe(member.id);

    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, member.id)));
    expect(membership.status).toBe("inactive");

    const remainingAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, member.id));
    expect(remainingAccounts).toHaveLength(0);
  });

  it("rejects a hard delete of a user that still owns history rows", async () => {
    await expect(db.delete(users).where(eq(users.id, admin.id))).rejects.toThrowError();

    const [stillThere] = await db.select().from(users).where(eq(users.id, admin.id));
    expect(stillThere).toBeDefined();

    const expense = await db.select().from(expenses).where(eq(expenses.id, expenseId));
    expect(expense).toHaveLength(1);
  });

  it("rejects deletion with an incorrect password", async () => {
    const other = { id: crypto.randomUUID(), username: `fd_other_${testRunId}` };
    await db.insert(users).values(other);
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: other.id,
      providerId: "credential",
      userId: other.id,
      password: await hashPassword(memberPassword),
    });

    const result = await deleteUserAccount(
      { id: other.id, username: other.username },
      { password: "WrongPassword123!" }
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    if (!result.success) {
      expect(result.error).toBe("Incorrect password.");
    }

    const [row] = await db.select().from(users).where(eq(users.id, other.id));
    expect(row.username).toBe(other.username);

    await db.delete(accounts).where(eq(accounts.userId, other.id));
    await db.delete(users).where(eq(users.id, other.id));
  });
});

describe("account deletion validates balances inside the transaction", () => {
  const lockUser = { id: crypto.randomUUID(), username: `fd_lock_${testRunId}` };
  const owedUser = { id: crypto.randomUUID(), username: `fd_owed_${testRunId}` };
  const peer = { id: crypto.randomUUID(), username: `fd_peer_${testRunId}` };
  const lockGroupId = crypto.randomUUID();
  const owedGroupId = crypto.randomUUID();
  const owedExpenseId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(users).values([lockUser, owedUser, peer]);

    const passwordHash = await hashPassword(memberPassword);
    await db.insert(accounts).values([
      {
        id: crypto.randomUUID(),
        accountId: lockUser.id,
        providerId: "credential",
        userId: lockUser.id,
        password: passwordHash,
      },
      {
        id: crypto.randomUUID(),
        accountId: owedUser.id,
        providerId: "credential",
        userId: owedUser.id,
        password: passwordHash,
      },
    ]);

    await db.insert(groups).values([
      { id: lockGroupId, name: `Lock Group ${testRunId}`, createdBy: lockUser.id },
      { id: owedGroupId, name: `Owed Group ${testRunId}`, createdBy: owedUser.id },
    ]);

    await db.insert(groupMembers).values([
      {
        id: crypto.randomUUID(),
        groupId: lockGroupId,
        userId: lockUser.id,
        role: "admin",
        status: "active",
      },
      {
        id: crypto.randomUUID(),
        groupId: owedGroupId,
        userId: owedUser.id,
        role: "admin",
        status: "active",
      },
      {
        id: crypto.randomUUID(),
        groupId: owedGroupId,
        userId: peer.id,
        role: "member",
        status: "active",
      },
    ]);

    // The owed user paid for an expense they only half share, so they are owed money.
    await db.insert(expenses).values({
      id: owedExpenseId,
      groupId: owedGroupId,
      description: "Dinner",
      amount: "100.00",
      paidByUserId: owedUser.id,
      createdBy: owedUser.id,
    });
    await db.insert(expenseSplits).values({
      id: crypto.randomUUID(),
      expenseId: owedExpenseId,
      userId: owedUser.id,
      owedAmount: "50.00",
    });
    await db.insert(expenseSplits).values({
      id: crypto.randomUUID(),
      expenseId: owedExpenseId,
      userId: peer.id,
      owedAmount: "50.00",
    });
  });

  afterAll(async () => {
    await db.delete(settlements).where(eq(settlements.groupId, owedGroupId));
    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, owedExpenseId));
    await db.delete(expenses).where(eq(expenses.groupId, owedGroupId));
    await db.delete(groupMembers).where(eq(groupMembers.groupId, lockGroupId));
    await db.delete(groupMembers).where(eq(groupMembers.groupId, owedGroupId));
    await db.delete(groups).where(eq(groups.id, lockGroupId));
    await db.delete(groups).where(eq(groups.id, owedGroupId));
    await db.delete(accounts).where(eq(accounts.userId, lockUser.id));
    await db.delete(accounts).where(eq(accounts.userId, owedUser.id));
    await db.delete(users).where(eq(users.id, lockUser.id));
    await db.delete(users).where(eq(users.id, owedUser.id));
    await db.delete(users).where(eq(users.id, peer.id));
  });

  it("rejects deletion when the user is owed money and names the group", async () => {
    const result = await deleteUserAccount(owedUser, { password: memberPassword });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/unsettled balances/i);
      expect(result.error).toContain(`Owed Group ${testRunId}`);
      expect(result.error).toMatch(/you are owed/i);
    }

    const [row] = await db.select().from(users).where(eq(users.id, owedUser.id));
    expect(row.username).toBe(owedUser.username);
  });

  it("waits for the group advisory lock before validating balances", async () => {
    let releaseLock = () => {};
    const lockHeld = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const holder = db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockGroupId}))`);
      await lockHeld;
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    let settled = false;
    const deletion = deleteUserAccount(lockUser, { password: memberPassword }).then((result) => {
      settled = true;
      return result;
    });

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(settled).toBe(false);

    releaseLock();
    await holder;

    const result = await deletion;

    expect(result.success).toBe(true);

    const [row] = await db.select().from(users).where(eq(users.id, lockUser.id));
    expect(row.username).toMatch(/^deleted_/);
  });
});
