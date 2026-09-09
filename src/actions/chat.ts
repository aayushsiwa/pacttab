"use server";

import crypto from "crypto";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { messages, groupMembers, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function sendMessageAction(
  groupId: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();

  const trimmed = body.trim();
  if (!trimmed) {
    return { success: false, error: "Message cannot be empty" };
  }

  // Verify membership
  const membership = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, user.id),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (membership.length === 0) {
    return { success: false, error: "You are not an active member of this group" };
  }

  try {
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      groupId,
      authorId: user.id,
      body: trimmed,
      type: "user",
    });

    revalidatePath(`/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { success: false, error: "Failed to send message" };
  }
}

export async function getGroupMessages(groupId: string) {
  const user = await requireUser();

  // Verify membership
  const membership = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, user.id),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (membership.length === 0) {
    throw new Error("Unauthorized");
  }

  const result = await db
    .select({
      id: messages.id,
      body: messages.body,
      type: messages.type,
      createdAt: messages.createdAt,
      authorId: messages.authorId,
      authorUsername: users.username,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(eq(messages.groupId, groupId))
    .orderBy(asc(messages.createdAt));

  return result;
}
