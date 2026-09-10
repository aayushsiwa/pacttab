"use server";

import { z } from "zod";
import crypto from "crypto";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  groups,
  groupMembers,
  inviteLinks,
  joinRequests,
  messages,
  expenses,
  expenseSplits,
  settlements,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { calculateBalancesAndSettlements } from "@/lib/balances";
import { broadcastWsEvent } from "@/lib/ws-hub";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100, "Group name must be 100 characters or fewer"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer").optional(),
});

export type GroupActionState = {
  error?: string;
  success?: boolean;
};

export async function createGroupAction(prevState: GroupActionState | null, formData: FormData): Promise<GroupActionState> {
  const user = await requireUser();

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");

  const validation = CreateGroupSchema.safeParse({
    name: rawName,
    description: rawDescription || undefined,
  });

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid group details" };
  }

  const groupId = crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const inviteToken = crypto.randomBytes(16).toString("hex");
  const messageId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      // 1. Create group
      await tx.insert(groups).values({
        id: groupId,
        name: validation.data.name,
        description: validation.data.description || null,
        createdBy: user.id,
      });

      // 2. Add creator as admin member
      await tx.insert(groupMembers).values({
        id: crypto.randomUUID(),
        groupId,
        userId: user.id,
        role: "admin",
        status: "active",
      });

      // 3. Create initial invite link
      await tx.insert(inviteLinks).values({
        id: inviteId,
        groupId,
        token: inviteToken,
        createdBy: user.id,
      });

      // 4. Initial system message
      await tx.insert(messages).values({
        id: messageId,
        groupId,
        authorId: null,
        body: `${user.username} created the group "${validation.data.name}".`,
        type: "system",
      });
    });
  } catch (error) {
    console.error("Failed to create group:", error);
    return { error: "Failed to create group. Please try again." };
  }

  revalidatePath("/groups");
  redirect(`/group/${groupId}`);
}

export async function createInviteLinkAction(
  groupId: string,
  options?: {
    expiresInHours?: number | null;
    maxUses?: number | null;
    requiresApproval?: boolean;
  }
): Promise<{ success: boolean; token?: string; error?: string }> {
  const user = await requireUser();

  // Verify user is admin
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can generate invite links" };
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt =
    options?.expiresInHours && options.expiresInHours > 0
      ? new Date(Date.now() + options.expiresInHours * 3600 * 1000)
      : null;

  try {
    await db.insert(inviteLinks).values({
      id: crypto.randomUUID(),
      groupId,
      token,
      createdBy: user.id,
      expiresAt,
      maxUses: options?.maxUses ?? null,
      requiresApproval: options?.requiresApproval ?? false,
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true, token };
  } catch (error) {
    console.error("Failed to create invite link:", error);
    return { success: false, error: "Failed to generate invite link" };
  }
}

export async function rotateInviteLinkAction(
  groupId: string,
  oldInviteId?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const user = await requireUser();

  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can rotate invite links" };
  }

  try {
    if (oldInviteId) {
      await db
        .update(inviteLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(inviteLinks.id, oldInviteId), eq(inviteLinks.groupId, groupId)));
    } else {
      await db
        .update(inviteLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(inviteLinks.groupId, groupId), isNull(inviteLinks.revokedAt)));
    }

    const token = crypto.randomBytes(16).toString("hex");
    await db.insert(inviteLinks).values({
      id: crypto.randomUUID(),
      groupId,
      token,
      createdBy: user.id,
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true, token };
  } catch (error) {
    console.error("Failed to rotate invite link:", error);
    return { success: false, error: "Failed to rotate invite link" };
  }
}

export async function revokeInviteLinkAction(groupId: string, inviteId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can revoke invite links" };
  }

  try {
    await db
      .update(inviteLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(inviteLinks.id, inviteId), eq(inviteLinks.groupId, groupId)));

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to revoke invite link:", error);
    return { success: false, error: "Failed to revoke invite link" };
  }
}

export async function joinGroupAction(token: string): Promise<{
  success: boolean;
  groupId?: string;
  groupName?: string;
  canRequestJoin?: boolean;
  pendingApproval?: boolean;
  error?: string;
}> {
  const user = await requireUser();

  const now = new Date();
  const validInvites = await db
    .select({
      id: inviteLinks.id,
      groupId: inviteLinks.groupId,
      groupName: groups.name,
      useCount: inviteLinks.useCount,
      maxUses: inviteLinks.maxUses,
      expiresAt: inviteLinks.expiresAt,
      requiresApproval: inviteLinks.requiresApproval,
      revokedAt: inviteLinks.revokedAt,
    })
    .from(inviteLinks)
    .innerJoin(groups, eq(inviteLinks.groupId, groups.id))
    .where(eq(inviteLinks.token, token))
    .limit(1);

  if (validInvites.length === 0) {
    return { success: false, error: "This invite link is invalid or does not exist." };
  }

  const invite = validInvites[0];

  if (invite.revokedAt !== null) {
    return { success: false, error: "This invite link has been revoked by an admin." };
  }

  // Check if already a member
  const existingMember = await db
    .select({ id: groupMembers.id, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, invite.groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (existingMember.length > 0) {
    if (existingMember[0].status === "active") {
      return { success: true, groupId: invite.groupId, groupName: invite.groupName };
    }
    // Re-activate if inactive
    await db
      .update(groupMembers)
      .set({ status: "active" })
      .where(eq(groupMembers.id, existingMember[0].id));

    revalidatePath(`/group/${invite.groupId}`);
    return { success: true, groupId: invite.groupId, groupName: invite.groupName };
  }

  const isExpired = invite.expiresAt !== null && invite.expiresAt < now;
  const isCapped = invite.maxUses !== null && invite.useCount >= invite.maxUses;

  if (isExpired || isCapped) {
    return {
      success: false,
      canRequestJoin: true,
      groupId: invite.groupId,
      groupName: invite.groupName,
      error: isExpired
        ? "This invite link has expired. You may request to join instead."
        : "This invite link has reached its maximum uses. You may request to join instead.",
    };
  }

  if (invite.requiresApproval) {
    // Check if user already submitted a join request
    const [existingReq] = await db
      .select()
      .from(joinRequests)
      .where(and(eq(joinRequests.groupId, invite.groupId), eq(joinRequests.userId, user.id)))
      .limit(1);

    if (existingReq) {
      if (existingReq.status === "pending") {
        return {
          success: false,
          pendingApproval: true,
          groupId: invite.groupId,
          groupName: invite.groupName,
          error: "Your request to join this group is pending admin approval.",
        };
      }
      if (existingReq.status === "declined") {
        return {
          success: false,
          groupId: invite.groupId,
          groupName: invite.groupName,
          error: "Your previous request to join this group was declined.",
        };
      }
    } else {
      await db.insert(joinRequests).values({
        id: crypto.randomUUID(),
        groupId: invite.groupId,
        userId: user.id,
        status: "pending",
      });

      const reqMsgId = crypto.randomUUID();
      const body = `${user.username} requested to join the group.`;
      await db.insert(messages).values({
        id: reqMsgId,
        groupId: invite.groupId,
        authorId: null,
        body,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId: invite.groupId,
        message: {
          id: reqMsgId,
          body,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "join_request_created",
        groupId: invite.groupId,
        username: user.username,
      });

      revalidatePath("/groups");
    }

    return {
      success: false,
      pendingApproval: true,
      groupId: invite.groupId,
      groupName: invite.groupName,
      error: "This group requires admin approval. Your join request has been submitted to the admin.",
    };
  }

  // Direct join
  try {
    await db.transaction(async (tx) => {
      // Add member
      await tx.insert(groupMembers).values({
        id: crypto.randomUUID(),
        groupId: invite.groupId,
        userId: user.id,
        role: "member",
        status: "active",
      });

      // Increment use count
      await tx
        .update(inviteLinks)
        .set({ useCount: sql`${inviteLinks.useCount} + 1` })
        .where(eq(inviteLinks.id, invite.id));

      const joinMsgId = crypto.randomUUID();
      // Post system message to group chat
      await tx.insert(messages).values({
        id: joinMsgId,
        groupId: invite.groupId,
        authorId: null,
        body: `${user.username} joined the group.`,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId: invite.groupId,
        message: {
          id: joinMsgId,
          body: `${user.username} joined the group.`,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "member_joined",
        groupId: invite.groupId,
        username: user.username,
      });
    });

    revalidatePath(`/group/${invite.groupId}`);
    return { success: true, groupId: invite.groupId };
  } catch (error) {
    console.error("Failed to join group:", error);
    return { success: false, error: "Failed to join the group. Please try again." };
  }
}

export async function createJoinRequestAction(groupId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  // Check if already active member
  const [existingMember] = await db
    .select({ id: groupMembers.id, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (existingMember && existingMember.status === "active") {
    return { success: true };
  }

  // Check existing join request
  const [existingReq] = await db
    .select()
    .from(joinRequests)
    .where(and(eq(joinRequests.groupId, groupId), eq(joinRequests.userId, user.id)))
    .limit(1);

  if (existingReq) {
    if (existingReq.status === "pending") {
      return { success: false, error: "You already have a pending join request for this group." };
    }
    await db
      .update(joinRequests)
      .set({ status: "pending", createdAt: new Date(), reviewedBy: null, reviewedAt: null })
      .where(eq(joinRequests.id, existingReq.id));
  } else {
    await db.insert(joinRequests).values({
      id: crypto.randomUUID(),
      groupId,
      userId: user.id,
      status: "pending",
    });
  }

  const reqMsgId = crypto.randomUUID();
  const body = `${user.username} requested to join the group.`;
  await db.insert(messages).values({
    id: reqMsgId,
    groupId,
    authorId: null,
    body,
    type: "system",
  });

  await broadcastWsEvent({
    type: "new_message",
    groupId,
    message: {
      id: reqMsgId,
      body,
      type: "system",
      createdAt: new Date().toISOString(),
      authorId: null,
      authorUsername: null,
    },
  });

  await broadcastWsEvent({
    type: "join_request_created",
    groupId,
    username: user.username,
  });

  revalidatePath(`/group/${groupId}`);
  revalidatePath("/groups");
  return { success: true };
}

export async function reviewJoinRequestAction(
  groupId: string,
  requestId: string,
  decision: "approved" | "declined"
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const [adminCheck] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (!adminCheck || adminCheck.role !== "admin") {
    return { success: false, error: "Only admins can review join requests" };
  }

  const [req] = await db
    .select({
      id: joinRequests.id,
      groupId: joinRequests.groupId,
      userId: joinRequests.userId,
      status: joinRequests.status,
      username: users.username,
    })
    .from(joinRequests)
    .innerJoin(users, eq(joinRequests.userId, users.id))
    .where(and(eq(joinRequests.id, requestId), eq(joinRequests.groupId, groupId)))
    .limit(1);

  if (!req) {
    return { success: false, error: "Join request not found" };
  }

  if (req.status !== "pending") {
    return { success: false, error: `Request is already ${req.status}` };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(joinRequests)
        .set({
          status: decision,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(joinRequests.id, requestId));

      if (decision === "approved") {
        const [existingMember] = await tx
          .select({ id: groupMembers.id })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, req.userId)))
          .limit(1);

        if (existingMember) {
          await tx
            .update(groupMembers)
            .set({ status: "active", role: "member" })
            .where(eq(groupMembers.id, existingMember.id));
        } else {
          await tx.insert(groupMembers).values({
            id: crypto.randomUUID(),
            groupId,
            userId: req.userId,
            role: "member",
            status: "active",
          });
        }

        const approvedMsgId = crypto.randomUUID();
        const body = `${user.username} approved @${req.username}'s request to join.`;
        await tx.insert(messages).values({
          id: approvedMsgId,
          groupId,
          authorId: null,
          body,
          type: "system",
        });

        await broadcastWsEvent({
          type: "new_message",
          groupId,
          message: {
            id: approvedMsgId,
            body,
            type: "system",
            createdAt: new Date().toISOString(),
            authorId: null,
            authorUsername: null,
          },
        });

        await broadcastWsEvent({
          type: "member_joined",
          groupId,
          username: req.username,
        });
      }

      await broadcastWsEvent({
        type: "join_request_reviewed",
        groupId,
        username: req.username,
        status: decision,
      });
    });

    revalidatePath(`/group/${groupId}`);
    revalidatePath("/groups");
    return { success: true };
  } catch (error) {
    console.error("Failed to review join request:", error);
    return { success: false, error: "Failed to process join request" };
  }
}

export async function updateGroupAction(
  groupId: string,
  name: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only admins can update group settings" };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "Group name is required" };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(groups)
        .set({
          name: trimmedName,
          description: description?.trim() || null,
        })
        .where(eq(groups.id, groupId));

      const msgId = crypto.randomUUID();
      const body = `${user.username} updated the group settings.`;
      await tx.insert(messages).values({
        id: msgId,
        groupId,
        authorId: null,
        body,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId,
        message: {
          id: msgId,
          body,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "refresh",
        groupId,
      });
    });

    revalidatePath(`/group/${groupId}`);
    revalidatePath("/groups");
    return { success: true };
  } catch (error) {
    console.error("Failed to update group:", error);
    return { success: false, error: "Failed to update group" };
  }
}

export async function transferAdminAction(
  groupId: string,
  newAdminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const [membership] = await db
    .select({ role: groupMembers.role, id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only the current group admin can transfer admin rights" };
  }

  const [targetMember] = await db
    .select({ id: groupMembers.id, username: users.username })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, newAdminUserId), eq(groupMembers.status, "active")))
    .limit(1);

  if (!targetMember) {
    return { success: false, error: "Target member not found in this group" };
  }

  try {
    await db.transaction(async (tx) => {
      // Step down current admin to member
      await tx
        .update(groupMembers)
        .set({ role: "member" })
        .where(eq(groupMembers.id, membership.id));

      // Promote new admin
      await tx
        .update(groupMembers)
        .set({ role: "admin" })
        .where(eq(groupMembers.id, targetMember.id));

      const msgId = crypto.randomUUID();
      const body = `${user.username} transferred group admin rights to @${targetMember.username}.`;
      await tx.insert(messages).values({
        id: msgId,
        groupId,
        authorId: null,
        body,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId,
        message: {
          id: msgId,
          body,
          type: "system",
          createdAt: new Date().toISOString(),
          authorId: null,
          authorUsername: null,
        },
      });

      await broadcastWsEvent({
        type: "refresh",
        groupId,
      });
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to transfer admin rights:", error);
    return { success: false, error: "Failed to transfer admin rights" };
  }
}

export async function leaveGroupAction(groupId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  // 1. Verify membership
  const [membership] = await db
    .select({ id: groupMembers.id, role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id), eq(groupMembers.status, "active")))
    .limit(1);

  if (!membership) {
    return { success: false, error: "You are not an active member of this group" };
  }

  // 2. Fetch all active members, expenses and confirmed settlements for balance calculation
  const members = await db
    .select({ id: users.id, username: users.username })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));

  const rawExpenses = await db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      paidByUserId: expenses.paidByUserId,
    })
    .from(expenses)
    .where(eq(expenses.groupId, groupId));

  const expIds = rawExpenses.map((e) => e.id);
  const splits = expIds.length > 0
    ? await db
        .select({
          expenseId: expenseSplits.expenseId,
          userId: expenseSplits.userId,
          owedAmount: expenseSplits.owedAmount,
        })
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, expIds))
    : [];

  const rawSettlements = await db
    .select({
      id: settlements.id,
      amount: settlements.amount,
      paidByUserId: settlements.paidByUserId,
      receivedByUserId: settlements.receivedByUserId,
      status: settlements.status,
    })
    .from(settlements)
    .where(eq(settlements.groupId, groupId));

  const splitsByExp = new Map<string, { userId: string; owedAmount: string | number }[]>();
  for (const s of splits) {
    const list = splitsByExp.get(s.expenseId) || [];
    list.push(s);
    splitsByExp.set(s.expenseId, list);
  }

  const { balances } = calculateBalancesAndSettlements(
    members,
    rawExpenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      paidByUserId: e.paidByUserId,
      splits: splitsByExp.get(e.id) || [],
    })),
    rawSettlements
  );

  const myBalance = balances.find((b) => b.userId === user.id)?.netBalance || 0;
  if (Math.abs(myBalance) > 0.01) {
    const formatted = Math.abs(myBalance).toFixed(2);
    if (myBalance > 0) {
      return {
        success: false,
        error: `You cannot leave this group because you are owed ₹${formatted}. Settle up with other members before leaving.`,
      };
    } else {
      return {
        success: false,
        error: `You cannot leave this group because you owe ₹${formatted}. Please settle your balance before leaving.`,
      };
    }
  }

  // 3. If admin, check if other active members exist
  if (membership.role === "admin") {
    const otherActiveMembers = members.filter((m) => m.id !== user.id);
    if (otherActiveMembers.length > 0) {
      return {
        success: false,
        error: "As the group admin, you must transfer your admin role to another member before leaving.",
      };
    }
  }

  // 4. Mark membership as inactive
  await db.transaction(async (tx) => {
    await tx
      .update(groupMembers)
      .set({ status: "inactive" })
      .where(eq(groupMembers.id, membership.id));

    const leaveMsgId = crypto.randomUUID();
    const body = `${user.username} left the group.`;
    await tx.insert(messages).values({
      id: leaveMsgId,
      groupId,
      authorId: null,
      body,
      type: "system",
    });

    await broadcastWsEvent({
      type: "new_message",
      groupId,
      message: {
        id: leaveMsgId,
        body,
        type: "system",
        createdAt: new Date().toISOString(),
        authorId: null,
        authorUsername: null,
      },
    });

    await broadcastWsEvent({
      type: "refresh",
      groupId,
    });
  });

  revalidatePath("/groups");
  return { success: true };
}

export async function deleteGroupAction(groupId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only admins can delete a group" };
  }

  try {
    await db.delete(groups).where(eq(groups.id, groupId));
    revalidatePath("/groups");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete group:", error);
    return { success: false, error: "Failed to delete group" };
  }
}
