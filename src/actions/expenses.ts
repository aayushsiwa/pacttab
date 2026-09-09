"use server";

import { z } from "zod";
import crypto from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { expenses, expenseSplits, settlements, messages, groupMembers, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { calculateEqualSplits } from "@/lib/balances";

const CreateExpenseSchema = z.object({
  groupId: z.string().uuid().or(z.string().min(1)),
  description: z.string().trim().min(1, "Description is required").max(255),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidByUserId: z.string().min(1, "Payer is required"),
  participantUserIds: z.array(z.string()).min(1, "Select at least one participant"),
  expenseDate: z.string().optional(),
});

export async function createExpenseAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const rawGroupId = formData.get("groupId") as string;
  const rawDesc = formData.get("description") as string;
  const rawAmount = formData.get("amount") as string;
  const rawPaidBy = formData.get("paidByUserId") as string;
  const rawDate = formData.get("expenseDate") as string;
  const rawParticipants = formData.getAll("participantUserIds") as string[];

  const validation = CreateExpenseSchema.safeParse({
    groupId: rawGroupId,
    description: rawDesc,
    amount: rawAmount,
    paidByUserId: rawPaidBy,
    participantUserIds: rawParticipants,
    expenseDate: rawDate,
  });

  if (!validation.success) {
    return { success: false, error: validation.error.errors[0]?.message || "Invalid expense details" };
  }

  const { groupId, description, amount, paidByUserId, participantUserIds, expenseDate } = validation.data;

  // 1. Verify that current user is an active member
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id), eq(groupMembers.status, "active")))
    .limit(1);

  if (membership.length === 0) {
    return { success: false, error: "You are not an active member of this group" };
  }

  // 2. Verify all participants and payer are group members
  const allNeededUsers = Array.from(new Set([paidByUserId, ...participantUserIds]));
  const foundMembers = await db
    .select({ userId: groupMembers.userId, username: users.username })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, allNeededUsers)));

  if (foundMembers.length !== allNeededUsers.length) {
    return { success: false, error: "One or more selected participants are not in this group" };
  }

  const payerName = foundMembers.find((m) => m.userId === paidByUserId)?.username || "A member";

  // 3. Compute equal splits
  const splits = calculateEqualSplits(amount, participantUserIds);

  const expenseId = crypto.randomUUID();
  const dateObj = expenseDate ? new Date(expenseDate) : new Date();

  try {
    await db.transaction(async (tx) => {
      // Insert expense
      await tx.insert(expenses).values({
        id: expenseId,
        groupId,
        description,
        amount: amount.toFixed(2),
        paidByUserId,
        expenseDate: dateObj,
        createdBy: user.id,
      });

      // Insert splits
      for (const split of splits) {
        await tx.insert(expenseSplits).values({
          id: crypto.randomUUID(),
          expenseId,
          userId: split.userId,
          owedAmount: split.owedAmount.toFixed(2),
        });
      }

      // Insert chat activity message
      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId,
        authorId: null,
        body: `${payerName} added expense "${description}" — ₹${amount.toFixed(2)}`,
        type: "system",
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to create expense:", error);
    return { success: false, error: "Failed to save expense. Please try again." };
  }
}

export async function deleteExpenseAction(
  groupId: string,
  expenseId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  // Verify membership
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id), eq(groupMembers.status, "active")))
    .limit(1);

  if (membership.length === 0) {
    return { success: false, error: "Unauthorized" };
  }

  // Get expense
  const exp = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      createdBy: expenses.createdBy,
      paidByUserId: expenses.paidByUserId,
    })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .limit(1);

  if (exp.length === 0) {
    return { success: false, error: "Expense not found" };
  }

  const expenseItem = exp[0];
  const isAdmin = membership[0].role === "admin";
  const isCreator = expenseItem.createdBy === user.id;
  const isPayer = expenseItem.paidByUserId === user.id;

  if (!isAdmin && !isCreator && !isPayer) {
    return { success: false, error: "You do not have permission to delete this expense" };
  }

  try {
    await db.transaction(async (tx) => {
      // Delete splits first or cascade
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
      await tx.delete(expenses).where(eq(expenses.id, expenseId));

      // Post activity message
      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId,
        authorId: null,
        body: `${user.username} deleted expense "${expenseItem.description}".`,
        type: "system",
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return { success: false, error: "Failed to delete expense" };
  }
}

const RecordSettlementSchema = z.object({
  groupId: z.string().min(1),
  paidByUserId: z.string().min(1, "Payer is required"),
  receivedByUserId: z.string().min(1, "Recipient is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

export async function recordSettlementAction(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const rawGroupId = formData.get("groupId") as string;
  const rawPaidBy = formData.get("paidByUserId") as string;
  const rawReceivedBy = formData.get("receivedByUserId") as string;
  const rawAmount = formData.get("amount") as string;

  const validation = RecordSettlementSchema.safeParse({
    groupId: rawGroupId,
    paidByUserId: rawPaidBy,
    receivedByUserId: rawReceivedBy,
    amount: rawAmount,
  });

  if (!validation.success) {
    return { success: false, error: validation.error.errors[0]?.message || "Invalid settlement details" };
  }

  const { groupId, paidByUserId, receivedByUserId, amount } = validation.data;

  if (paidByUserId === receivedByUserId) {
    return { success: false, error: "Payer and recipient cannot be the same person" };
  }

  // Verify group membership
  const membership = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id), eq(groupMembers.status, "active")))
    .limit(1);

  if (membership.length === 0) {
    return { success: false, error: "You are not an active member of this group" };
  }

  // Get usernames
  const memberRecords = await db
    .select({ userId: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, [paidByUserId, receivedByUserId]));

  const payerName = memberRecords.find((m) => m.userId === paidByUserId)?.username || "Member";
  const recipientName = memberRecords.find((m) => m.userId === receivedByUserId)?.username || "Member";

  try {
    await db.transaction(async (tx) => {
      await tx.insert(settlements).values({
        id: crypto.randomUUID(),
        groupId,
        paidByUserId,
        receivedByUserId,
        amount: amount.toFixed(2),
        settledAt: new Date(),
      });

      // Post activity message
      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId,
        authorId: null,
        body: `${payerName} recorded a settlement of ₹${amount.toFixed(2)} to ${recipientName}.`,
        type: "system",
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to record settlement:", error);
    return { success: false, error: "Failed to record settlement" };
  }
}
