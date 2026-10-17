import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { messages, groupMembers } from "@/db/schema";
import { broadcastWsEvent } from "@/lib/ws-hub";
import type { ApiUser } from "@/lib/api-auth";

export interface ChatActionResult {
  success: boolean;
  error?: string;
}

export async function sendMessage(
  user: ApiUser,
  groupId: string,
  body: string
): Promise<ChatActionResult> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { success: false, error: "Message cannot be empty" };
  }

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

  const messageId = crypto.randomUUID();

  try {
    await db.insert(messages).values({
      id: messageId,
      groupId,
      authorId: user.id,
      body: trimmed,
      type: "user",
    });

    await broadcastWsEvent({
      type: "new_message",
      groupId,
      message: {
        id: messageId,
        body: trimmed,
        type: "user",
        createdAt: new Date().toISOString(),
        authorId: user.id,
        authorUsername: user.username,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send message:", error);
    return { success: false, error: "Failed to send message" };
  }
}
