import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { expenses, groupMembers, groups, settlements, users } from "../src/db/schema";
import { serviceResponse, type ServiceResult } from "../src/lib/api-auth";
import { sendMessage } from "../src/lib/chat-service";
import {
  cancelSettlement,
  confirmSettlement,
  createExpense,
  deleteExpense,
  recordSettlement,
  rejectSettlement,
  updateExpense,
} from "../src/lib/expense-service";

async function expectStatus(result: ServiceResult, status: number) {
  const response = serviceResponse(result);
  expect(result.success).toBe(false);
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: result.error });
}

describe("expense and chat service authorization and HTTP statuses", () => {
  const payer = { id: randomUUID(), username: `payer_${randomUUID().slice(0, 8)}` };
  const recipient = { id: randomUUID(), username: `recipient_${randomUUID().slice(0, 8)}` };
  const other = { id: randomUUID(), username: `other_${randomUUID().slice(0, 8)}` };
  const outsider = { id: randomUUID(), username: `outsider_${randomUUID().slice(0, 8)}` };
  const groupId = randomUUID();
  const expenseId = randomUUID();
  const settlementId = randomUUID();
  const expenseInput = {
    description: "Dinner",
    amount: 20,
    paidByUserId: payer.id,
    participantUserIds: [payer.id, recipient.id],
  };
  const settlementInput = { paidByUserId: payer.id, receivedByUserId: recipient.id, amount: 10 };

  beforeAll(async () => {
    await db.insert(users).values([payer, recipient, other, outsider]);
    await db
      .insert(groups)
      .values({ id: groupId, name: "Service authorization", createdBy: payer.id });
    await db
      .insert(groupMembers)
      .values(
        [payer, recipient, other].map((user) => ({ id: randomUUID(), groupId, userId: user.id }))
      );
    await db.insert(expenses).values({
      id: expenseId,
      groupId,
      description: "Dinner",
      amount: "20.00",
      paidByUserId: payer.id,
      createdBy: payer.id,
    });
    await db.insert(settlements).values({
      id: settlementId,
      groupId,
      ...settlementInput,
      amount: "10.00",
      status: "pending",
      createdByUserId: payer.id,
    });
  });

  beforeEach(async () => {
    await db
      .update(groupMembers)
      .set({ status: "active" })
      .where(eq(groupMembers.groupId, groupId));
    await db
      .update(settlements)
      .set({ status: "pending", createdByUserId: payer.id, rejectedAt: null })
      .where(eq(settlements.id, settlementId));
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await db.delete(groups).where(eq(groups.id, groupId));
    await db
      .delete(users)
      .where(inArray(users.id, [payer.id, recipient.id, other.id, outsider.id]));
  });

  const memberOperations = [
    ["create expense", (user: typeof payer) => createExpense(user, groupId, expenseInput)],
    [
      "update expense",
      (user: typeof payer) => updateExpense(user, groupId, expenseId, expenseInput),
    ],
    ["delete expense", (user: typeof payer) => deleteExpense(user, groupId, expenseId)],
    ["record settlement", (user: typeof payer) => recordSettlement(user, groupId, settlementInput)],
    ["confirm settlement", (user: typeof payer) => confirmSettlement(user, groupId, settlementId)],
    ["reject settlement", (user: typeof payer) => rejectSettlement(user, groupId, settlementId)],
    ["send message", (user: typeof payer) => sendMessage(user, groupId, "Hello")],
  ] as const;

  it.each(memberOperations)("returns 403 for a nonmember: %s", async (_name, operation) => {
    await expectStatus(await operation(outsider), 403);
  });

  it.each(memberOperations)("returns 403 for an inactive member: %s", async (_name, operation) => {
    await db
      .update(groupMembers)
      .set({ status: "inactive" })
      .where(eq(groupMembers.userId, recipient.id));
    await expectStatus(await operation(recipient), 403);
    expect(
      await db.select().from(settlements).where(eq(settlements.id, settlementId))
    ).toMatchObject([{ status: "pending" }]);
  });

  it("checks membership before revealing whether a settlement exists", async () => {
    await expectStatus(await rejectSettlement(outsider, groupId, randomUUID()), 403);
  });

  const settlementOperations = [
    ["confirm", confirmSettlement],
    ["reject", rejectSettlement],
    ["cancel", cancelSettlement],
  ] as const;

  it.each(settlementOperations)(
    "returns 404 for a missing settlement: %s",
    async (_name, operation) => {
      await expectStatus(await operation(recipient, groupId, randomUUID()), 404);
    }
  );

  it.each(settlementOperations)(
    "returns 409 for an already processed settlement: %s",
    async (_name, operation) => {
      await db
        .update(settlements)
        .set({ status: "confirmed" })
        .where(eq(settlements.id, settlementId));
      await expectStatus(await operation(recipient, groupId, settlementId), 409);
    }
  );

  it.each([
    ["update", updateExpense],
    ["delete", deleteExpense],
  ] as const)("returns 404 for a missing expense: %s", async (_name, operation) => {
    await expectStatus(await operation(payer, groupId, randomUUID(), expenseInput), 404);
  });

  it.each([
    ["update", updateExpense],
    ["delete", deleteExpense],
  ] as const)(
    "returns 403 when an unrelated member tries to %s an expense",
    async (_name, operation) => {
      await expectStatus(await operation(other, groupId, expenseId, expenseInput), 403);
    }
  );

  it.each([payer, other])(
    "only allows the counterparty to reject a settlement with a creator ($username)",
    async (user) => {
      await expectStatus(await rejectSettlement(user, groupId, settlementId), 403);
    }
  );

  it("allows the active counterparty to reject a settlement with a creator", async () => {
    expect(await rejectSettlement(recipient, groupId, settlementId)).toEqual({ success: true });
    expect(
      await db.select().from(settlements).where(eq(settlements.id, settlementId))
    ).toMatchObject([{ status: "rejected", rejectedAt: expect.any(Date) }]);
  });

  it.each([payer, recipient])(
    "allows either active participant to reject a legacy settlement ($username)",
    async (user) => {
      await db
        .update(settlements)
        .set({ createdByUserId: null })
        .where(eq(settlements.id, settlementId));
      expect(await rejectSettlement(user, groupId, settlementId)).toEqual({ success: true });
      expect(
        await db.select().from(settlements).where(eq(settlements.id, settlementId))
      ).toMatchObject([{ status: "rejected" }]);
    }
  );

  it("rejects unrelated active members for a legacy settlement", async () => {
    await db
      .update(settlements)
      .set({ createdByUserId: null })
      .where(eq(settlements.id, settlementId));
    await expectStatus(await rejectSettlement(other, groupId, settlementId), 403);
    expect(
      await db.select().from(settlements).where(eq(settlements.id, settlementId))
    ).toMatchObject([{ status: "pending" }]);
  });

  it("returns 403 for non-counterparty affirmation and non-creator cancellation", async () => {
    await expectStatus(await confirmSettlement(payer, groupId, settlementId), 403);
    await expectStatus(await cancelSettlement(recipient, groupId, settlementId), 403);
    await db
      .update(settlements)
      .set({ createdByUserId: null })
      .where(eq(settlements.id, settlementId));
    await expectStatus(await confirmSettlement(other, groupId, settlementId), 403);
  });

  it("keeps invalid splits and empty messages as 400 errors", async () => {
    const invalid = { ...expenseInput, splitType: "exact", customSplits: "{" };
    await expectStatus(await createExpense(payer, groupId, invalid), 400);
    await expectStatus(await updateExpense(payer, groupId, expenseId, invalid), 400);
    await expectStatus(await sendMessage(payer, groupId, " "), 400);
  });

  const transactionOperations = [
    ["create expense", () => createExpense(payer, groupId, expenseInput)],
    ["update expense", () => updateExpense(payer, groupId, expenseId, expenseInput)],
    ["delete expense", () => deleteExpense(payer, groupId, expenseId)],
    ["record settlement", () => recordSettlement(payer, groupId, settlementInput)],
    ["confirm settlement", () => confirmSettlement(recipient, groupId, settlementId)],
    ["reject settlement", () => rejectSettlement(recipient, groupId, settlementId)],
    ["cancel settlement", () => cancelSettlement(payer, groupId, settlementId)],
  ] as const;

  it.each(transactionOperations)(
    "returns 500 on a caught persistence failure: %s",
    async (_name, operation) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("Synthetic database failure"));
      await expectStatus(await operation(), 500);
    }
  );

  it("returns 500 on a caught chat persistence failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("Synthetic database failure");
    });
    await expectStatus(await sendMessage(payer, groupId, "Hello"), 500);
  });
});
