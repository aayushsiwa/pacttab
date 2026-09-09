"use server";

import { z } from "zod";
import crypto from "crypto";
import { eq, and, isNull, or, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { groups, groupMembers, inviteLinks, messages, users } from "@/db/schema";
import { requireUser, getCurrentUser } from "@/lib/auth";

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
    return { error: validation.error.errors[0]?.message || "Invalid group details" };
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

export async function createInviteLinkAction(groupId: string): Promise<{ success: boolean; token?: string; error?: string }> {
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

  try {
    await db.insert(inviteLinks).values({
      id: crypto.randomUUID(),
      groupId,
      token,
      createdBy: user.id,
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true, token };
  } catch (error) {
    console.error("Failed to create invite link:", error);
    return { success: false, error: "Failed to generate invite link" };
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

export async function joinGroupAction(token: string): Promise<{ success: boolean; groupId?: string; error?: string }> {
  const user = await requireUser();

  const now = new Date();
  const validInvites = await db
    .select({
      id: inviteLinks.id,
      groupId: inviteLinks.groupId,
      groupName: groups.name,
      useCount: inviteLinks.useCount,
      maxUses: inviteLinks.maxUses,
    })
    .from(inviteLinks)
    .innerJoin(groups, eq(inviteLinks.groupId, groups.id))
    .where(
      and(
        eq(inviteLinks.token, token),
        isNull(inviteLinks.revokedAt),
        or(isNull(inviteLinks.expiresAt), gt(inviteLinks.expiresAt, now))
      )
    )
    .limit(1);

  if (validInvites.length === 0) {
    return { success: false, error: "This invite link is invalid or has expired." };
  }

  const invite = validInvites[0];

  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return { success: false, error: "This invite link has reached its maximum usage limit." };
  }

  // Check if already a member
  const existingMember = await db
    .select({ id: groupMembers.id, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, invite.groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (existingMember.length > 0) {
    if (existingMember[0].status === "active") {
      return { success: true, groupId: invite.groupId };
    }
    // Re-activate if inactive
    await db
      .update(groupMembers)
      .set({ status: "active" })
      .where(eq(groupMembers.id, existingMember[0].id));

    revalidatePath(`/group/${invite.groupId}`);
    return { success: true, groupId: invite.groupId };
  }

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

      // Post system message to group chat
      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        groupId: invite.groupId,
        authorId: null,
        body: `${user.username} joined the group.`,
        type: "system",
      });
    });

    revalidatePath(`/group/${invite.groupId}`);
    return { success: true, groupId: invite.groupId };
  } catch (error) {
    console.error("Failed to join group:", error);
    return { success: false, error: "Failed to join the group. Please try again." };
  }
}
