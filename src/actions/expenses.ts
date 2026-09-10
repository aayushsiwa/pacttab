"use server";

import { z } from "zod";
import crypto from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { expenses, expenseSplits, settlements, messages, groupMembers, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  calculateEqualSplits,
  calculateExactSplits,
  calculatePercentageSplits,
  calculateShareSplits,
} from "@/lib/balances";
import { broadcastWsEvent } from "@/lib/ws-hub";

function computeSplits(
  amount: number,
  participantUserIds: string[],
  splitType: string,
  rawCustomSplits?: string | null
): { userId: string; owedAmount: number }[] {
  if (splitType === "exact" && rawCustomSplits) {
    const data = JSON.parse(rawCustomSplits) as { userId: string; amount: number }[];
    return calculateExactSplits(amount, data);
  }
  if (splitType === "percentage" && rawCustomSplits) {
    const data = JSON.parse(rawCustomSplits) as { userId: string; percentage: number }[];
    return calculatePercentageSplits(amount, data);
  }
  if (splitType === "shares" && rawCustomSplits) {
    const data = JSON.parse(rawCustomSplits) as { userId: string; shares: number }[];
    return calculateShareSplits(amount, data);
  }
  return calculateEqualSplits(amount, participantUserIds);
}

const CreateExpenseSchema = z.object({
  groupId: z.string().uuid().or(z.string().min(1)),
  description: z.string().trim().min(1, "Description is required").max(255),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidByUserId: z.string().min(1, "Payer is required"),
  participantUserIds: z.array(z.string()).min(1, "Select at least one participant"),
  splitType: z.enum(["equal", "exact", "percentage", "shares"]).default("equal"),
  customSplits: z.string().optional().nullable(),
  expenseDate: z.string().optional(),
});

export async function createExpenseAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const rawGroupId = formData.get("groupId") as string;
  const rawDesc = formData.get("description") as string;
  const rawAmount = formData.get("amount") as string;
  const rawPaidBy = formData.get("paidByUserId") as string;
  const rawDate = formData.get("expenseDate") as string;
  const rawSplitType = (formData.get("splitType") as string) || "equal";
  const rawCustomSplits = formData.get("customSplits") as string | null;
  const rawParticipants = formData.getAll("participantUserIds") as string[];

  const validation = CreateExpenseSchema.safeParse({
    groupId: rawGroupId,
    description: rawDesc,
    amount: rawAmount,
    paidByUserId: rawPaidBy,
    participantUserIds: rawParticipants,
    splitType: rawSplitType,
    customSplits: rawCustomSplits,
    expenseDate: rawDate,
  });

  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || "Invalid expense details" };
  }

  const { groupId, description, amount, paidByUserId, participantUserIds, splitType, customSplits, expenseDate } = validation.data;

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

  // 3. Compute splits based on method
  let splits: { userId: string; owedAmount: number }[];
  try {
    splits = computeSplits(amount, participantUserIds, splitType, customSplits);
  } catch (splitErr: unknown) {
    const msg = splitErr instanceof Error ? splitErr.message : "Invalid split configuration";
    return { success: false, error: msg };
  }

  const expenseId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
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
        id: messageId,
        groupId,
        authorId: null,
        body: `${payerName} added expense "${description}" — ₹${amount.toFixed(2)}`,
        type: "system",
      });
    });

    // Real-time broadcast over WebSocket
    await broadcastWsEvent({
      type: "new_message",
      groupId,
      message: {
        id: messageId,
        body: `${payerName} added expense "${description}" — ₹${amount.toFixed(2)}`,
        type: "system",
        createdAt: new Date().toISOString(),
        authorId: null,
        authorUsername: null,
      },
    });

    await broadcastWsEvent({
      type: "expense_created",
      groupId,
      description,
      amount,
      payerUsername: payerName,
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

      const deleteMsgId = crypto.randomUUID();
      // Post activity message
      await tx.insert(messages).values({
        id: deleteMsgId,
        groupId,
        authorId: null,
        body: `${user.username} deleted expense "${expenseItem.description}".`,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId,
        message: {
          id: deleteMsgId,
          body: `${user.username} deleted expense "${expenseItem.description}".`,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "expense_deleted",
        groupId,
        description: expenseItem.description,
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return { success: false, error: "Failed to delete expense" };
  }
}

const UpdateExpenseSchema = z.object({
  groupId: z.string().uuid().or(z.string().min(1)),
  expenseId: z.string().uuid().or(z.string().min(1)),
  description: z.string().trim().min(1, "Description is required").max(255),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidByUserId: z.string().min(1, "Payer is required"),
  participantUserIds: z.array(z.string()).min(1, "Select at least one participant"),
  splitType: z.enum(["equal", "exact", "percentage", "shares"]).default("equal"),
  customSplits: z.string().optional().nullable(),
  expenseDate: z.string().optional(),
});

export async function updateExpenseAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const rawGroupId = formData.get("groupId") as string;
  const rawExpenseId = formData.get("expenseId") as string;
  const rawDesc = formData.get("description") as string;
  const rawAmount = formData.get("amount") as string;
  const rawPaidBy = formData.get("paidByUserId") as string;
  const rawDate = formData.get("expenseDate") as string;
  const rawSplitType = (formData.get("splitType") as string) || "equal";
  const rawCustomSplits = formData.get("customSplits") as string | null;
  const rawParticipants = formData.getAll("participantUserIds") as string[];

  const validation = UpdateExpenseSchema.safeParse({
    groupId: rawGroupId,
    expenseId: rawExpenseId,
    description: rawDesc,
    amount: rawAmount,
    paidByUserId: rawPaidBy,
    participantUserIds: rawParticipants,
    splitType: rawSplitType,
    customSplits: rawCustomSplits,
    expenseDate: rawDate,
  });

  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || "Invalid expense details" };
  }

  const { groupId, expenseId, description, amount, paidByUserId, participantUserIds, splitType, customSplits, expenseDate } = validation.data;

  // 1. Verify membership
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id), eq(groupMembers.status, "active")))
    .limit(1);

  if (membership.length === 0) {
    return { success: false, error: "You are not an active member of this group" };
  }

  // 2. Fetch existing expense
  const [existingExpense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
    .limit(1);

  if (!existingExpense) {
    return { success: false, error: "Expense not found" };
  }

  const isAdmin = membership[0].role === "admin";
  const isCreator = existingExpense.createdBy === user.id;
  const isPayer = existingExpense.paidByUserId === user.id;

  if (!isAdmin && !isCreator && !isPayer) {
    return { success: false, error: "You do not have permission to edit this expense" };
  }

  // 3. Verify participants
  const allNeededUsers = Array.from(new Set([paidByUserId, ...participantUserIds]));
  const foundMembers = await db
    .select({ userId: groupMembers.userId, username: users.username })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, allNeededUsers)));

  if (foundMembers.length !== allNeededUsers.length) {
    return { success: false, error: "One or more selected participants are not in this group" };
  }

  let splits: { userId: string; owedAmount: number }[];
  try {
    splits = computeSplits(amount, participantUserIds, splitType, customSplits);
  } catch (splitErr: unknown) {
    const msg = splitErr instanceof Error ? splitErr.message : "Invalid split configuration";
    return { success: false, error: msg };
  }

  const dateObj = expenseDate ? new Date(expenseDate) : existingExpense.expenseDate;
  const updateMsgId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      // Update expense
      await tx
        .update(expenses)
        .set({
          description,
          amount: amount.toFixed(2),
          paidByUserId,
          expenseDate: dateObj,
        })
        .where(eq(expenses.id, expenseId));

      // Replace splits
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
      for (const split of splits) {
        await tx.insert(expenseSplits).values({
          id: crypto.randomUUID(),
          expenseId,
          userId: split.userId,
          owedAmount: split.owedAmount.toFixed(2),
        });
      }

      // Insert audit system message
      await tx.insert(messages).values({
        id: updateMsgId,
        groupId,
        authorId: null,
        body: `${user.username} edited expense "${description}" — ₹${amount.toFixed(2)}.`,
        type: "system",
      });
    });

    await broadcastWsEvent({
      type: "new_message",
      groupId,
      message: {
        id: updateMsgId,
        body: `${user.username} edited expense "${description}" — ₹${amount.toFixed(2)}.`,
        type: "system",
        createdAt: new Date().toISOString(),
        authorId: null,
        authorUsername: null,
      },
    });

    await broadcastWsEvent({
      type: "expense_updated",
      groupId,
      description,
      amount,
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update expense:", error);
    return { success: false, error: "Failed to update expense" };
  }
}

const RecordSettlementSchema = z.object({
  groupId: z.string().min(1),
  paidByUserId: z.string().min(1, "Payer is required"),
  receivedByUserId: z.string().min(1, "Recipient is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

export async function recordSettlementAction(
  prevState: unknown,
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
    return { success: false, error: validation.error.issues[0]?.message || "Invalid settlement details" };
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

  // Counterparty is the other user involved who must confirm
  const counterpartyUserId = user.id === paidByUserId ? receivedByUserId : paidByUserId;
  const counterpartyName = counterpartyUserId === paidByUserId ? payerName : recipientName;

  const settlementId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(settlements).values({
        id: settlementId,
        groupId,
        paidByUserId,
        receivedByUserId,
        amount: amount.toFixed(2),
        status: "pending",
        createdByUserId: user.id,
        settledAt: new Date(),
      });

      const settleMsgId = crypto.randomUUID();
      const messageBody = `${user.username} recorded payment of ₹${amount.toFixed(2)} from @${payerName} to @${recipientName} (Pending affirmation from @${counterpartyName}).`;

      // Post activity message
      await tx.insert(messages).values({
        id: settleMsgId,
        groupId,
        authorId: null,
        body: messageBody,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId,
        message: {
          id: settleMsgId,
          body: messageBody,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "settlement_recorded",
        groupId,
        amount,
        payerUsername: payerName,
        recipientUsername: recipientName,
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to record settlement:", error);
    return { success: false, error: "Failed to record settlement" };
  }
}

export async function confirmSettlementAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const groupId = formData.get("groupId") as string;
  const settlementId = formData.get("settlementId") as string;

  if (!groupId || !settlementId) {
    return { success: false, error: "Invalid settlement request" };
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

  const [settlement] = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId)))
    .limit(1);

  if (!settlement) {
    return { success: false, error: "Settlement not found" };
  }

  if (settlement.status !== "pending") {
    return { success: false, error: `Settlement is already ${settlement.status}` };
  }

  // Counterparty verification
  const counterpartyUserId = settlement.createdByUserId === settlement.paidByUserId
    ? settlement.receivedByUserId
    : settlement.paidByUserId;

  if (settlement.createdByUserId && user.id !== counterpartyUserId) {
    return { success: false, error: "Only the other member involved can affirm this settlement" };
  } else if (!settlement.createdByUserId && user.id !== settlement.paidByUserId && user.id !== settlement.receivedByUserId) {
    return { success: false, error: "Only a participant of this settlement can affirm it" };
  }

  const memberRecords = await db
    .select({ userId: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, [settlement.paidByUserId, settlement.receivedByUserId]));

  const payerName = memberRecords.find((m) => m.userId === settlement.paidByUserId)?.username || "Member";
  const recipientName = memberRecords.find((m) => m.userId === settlement.receivedByUserId)?.username || "Member";

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(settlements)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
        })
        .where(eq(settlements.id, settlementId));

      const confirmMsgId = crypto.randomUUID();
      const messageBody = `${user.username} confirmed the settlement of ₹${Number(settlement.amount).toFixed(2)} from @${payerName} to @${recipientName}.`;

      await tx.insert(messages).values({
        id: confirmMsgId,
        groupId,
        authorId: null,
        body: messageBody,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId,
        message: {
          id: confirmMsgId,
          body: messageBody,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "settlement_confirmed",
        groupId,
        settlementId,
        amount: Number(settlement.amount),
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to confirm settlement:", error);
    return { success: false, error: "Failed to confirm settlement" };
  }
}

export async function rejectSettlementAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const groupId = formData.get("groupId") as string;
  const settlementId = formData.get("settlementId") as string;

  if (!groupId || !settlementId) {
    return { success: false, error: "Invalid settlement request" };
  }

  const [settlement] = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId)))
    .limit(1);

  if (!settlement) {
    return { success: false, error: "Settlement not found" };
  }

  if (settlement.status !== "pending") {
    return { success: false, error: `Settlement is already ${settlement.status}` };
  }

  const counterpartyUserId = settlement.createdByUserId === settlement.paidByUserId
    ? settlement.receivedByUserId
    : settlement.paidByUserId;

  if (settlement.createdByUserId && user.id !== counterpartyUserId) {
    return { success: false, error: "Only the other member involved can reject this settlement" };
  }

  const memberRecords = await db
    .select({ userId: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, [settlement.paidByUserId, settlement.receivedByUserId]));

  const payerName = memberRecords.find((m) => m.userId === settlement.paidByUserId)?.username || "Member";

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(settlements)
        .set({
          status: "rejected",
          rejectedAt: new Date(),
        })
        .where(eq(settlements.id, settlementId));

      const rejectMsgId = crypto.randomUUID();
      const messageBody = `${user.username} rejected the settlement claim of ₹${Number(settlement.amount).toFixed(2)} from @${payerName}.`;

      await tx.insert(messages).values({
        id: rejectMsgId,
        groupId,
        authorId: null,
        body: messageBody,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId,
        message: {
          id: rejectMsgId,
          body: messageBody,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "settlement_rejected",
        groupId,
        settlementId,
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to reject settlement:", error);
    return { success: false, error: "Failed to reject settlement" };
  }
}

export async function cancelSettlementAction(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const groupId = formData.get("groupId") as string;
  const settlementId = formData.get("settlementId") as string;

  if (!groupId || !settlementId) {
    return { success: false, error: "Invalid settlement request" };
  }

  const [settlement] = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId)))
    .limit(1);

  if (!settlement) {
    return { success: false, error: "Settlement not found" };
  }

  if (settlement.status !== "pending") {
    return { success: false, error: `Settlement is already ${settlement.status}` };
  }

  if (settlement.createdByUserId !== user.id) {
    return { success: false, error: "Only the member who recorded this settlement can cancel it" };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(settlements)
        .set({
          status: "cancelled",
        })
        .where(eq(settlements.id, settlementId));

      const cancelMsgId = crypto.randomUUID();
      const messageBody = `${user.username} cancelled their pending settlement of ₹${Number(settlement.amount).toFixed(2)}.`;

      await tx.insert(messages).values({
        id: cancelMsgId,
        groupId,
        authorId: null,
        body: messageBody,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId,
        message: {
          id: cancelMsgId,
          body: messageBody,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "settlement_cancelled",
        groupId,
        settlementId,
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel settlement:", error);
    return { success: false, error: "Failed to cancel settlement" };
  }
}
