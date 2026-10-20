import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
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
    process.env.TEST_CURRENT_USER_ID = member.id;
    let result;
    try {
      result = await deleteUserAccount({ password: memberPassword });
    } finally {
      delete process.env.TEST_CURRENT_USER_ID;
    }

    expect(result.ok).toBe(true);

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

    process.env.TEST_CURRENT_USER_ID = other.id;
    let result;
    try {
      result = await deleteUserAccount({ password: "WrongPassword123!" });
    } finally {
      delete process.env.TEST_CURRENT_USER_ID;
    }

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Incorrect password.");
    }

    const [row] = await db.select().from(users).where(eq(users.id, other.id));
    expect(row.username).toBe(other.username);

    await db.delete(accounts).where(eq(accounts.userId, other.id));
    await db.delete(users).where(eq(users.id, other.id));
  });
});
