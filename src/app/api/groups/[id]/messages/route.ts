import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { messages, groupMembers, users } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: groupId } = await props.params;

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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

  return NextResponse.json(result);
}
