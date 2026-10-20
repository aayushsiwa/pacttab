import crypto from "crypto";
import { eq, and, isNull, sql, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  groups,
  groupMembers,
  inviteLinks,
  joinRequests,
  directInvites,
  messages,
  expenses,
  expenseSplits,
  settlements,
  users,
} from "@/db/schema";
import { calculateBalancesAndSettlements } from "@/lib/balances";
import { broadcastWsEvent } from "@/lib/ws-hub";
import { groupDetailsSchema, directInviteSchema } from "@/lib/group-validation";
import type { ApiUser } from "@/lib/api-auth";

// Reserved routes and words disallowed as custom invite slugs
const RESERVED_SLUGS = new Set([
  "api",
  "login",
  "signup",
  "groups",
  "group",
  "join",
  "admin",
  "settings",
  "manifest",
  "favicon",
  "offline",
  "help",
  "about",
]);

export interface GroupActionResult {
  success: boolean;
  error?: string;
  status?: number;
}

export interface CreateGroupResult extends GroupActionResult {
  groupId?: string;
}

export interface JoinGroupResult extends GroupActionResult {
  groupId?: string;
  groupName?: string;
  canRequestJoin?: boolean;
  pendingApproval?: boolean;
}

export interface InviteLinkResult extends GroupActionResult {
  token?: string;
}

export interface DirectInviteResult extends GroupActionResult {
  inviteId?: string;
  token?: string;
  inviteeUsername?: string;
}

export interface ResolvedDirectInvite {
  id: string;
  groupId: string;
  groupName: string;
  inviterUsername: string;
  inviteeId: string;
  inviteeUsername: string;
  status: string;
  expiresAt: Date | null;
}

const DIRECT_INVITE_EXPIRY_HOURS = 7 * 24;

export async function createGroup(
  user: ApiUser,
  input: { name: unknown; description?: unknown }
): Promise<CreateGroupResult> {
  const validation = groupDetailsSchema.safeParse({
    name: input.name,
    description: input.description || undefined,
  });

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid group details",
    };
  }

  const groupId = crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const inviteToken = crypto.randomBytes(16).toString("hex");
  const messageId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(groups).values({
        id: groupId,
        name: validation.data.name,
        description: validation.data.description || null,
        createdBy: user.id,
      });

      await tx.insert(groupMembers).values({
        id: crypto.randomUUID(),
        groupId,
        userId: user.id,
        role: "admin",
        status: "active",
      });

      await tx.insert(inviteLinks).values({
        id: inviteId,
        groupId,
        token: inviteToken,
        createdBy: user.id,
      });

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
    return { success: false, error: "Failed to create group. Please try again.", status: 500 };
  }

  return { success: true, groupId };
}

export async function updateGroup(
  user: ApiUser,
  groupId: string,
  input: { name: unknown; description?: unknown }
): Promise<GroupActionResult> {
  const validation = groupDetailsSchema.safeParse({
    name: input.name,
    description: input.description,
  });

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid group details",
    };
  }

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, user.id),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only admins can update group settings", status: 403 };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(groups)
        .set({
          name: validation.data.name,
          description:
            validation.data.description === undefined
              ? undefined
              : validation.data.description || null,
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

      await broadcastWsEvent({ type: "refresh", groupId });
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to update group:", error);
    return { success: false, error: "Failed to update group", status: 500 };
  }
}

export async function deleteGroup(user: ApiUser, groupId: string): Promise<GroupActionResult> {
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, user.id),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only admins can delete a group", status: 403 };
  }

  try {
    await db.delete(groups).where(eq(groups.id, groupId));
    return { success: true };
  } catch (error) {
    console.error("Failed to delete group:", error);
    return { success: false, error: "Failed to delete group", status: 500 };
  }
}

export async function createInviteLink(
  user: ApiUser,
  groupId: string,
  options?: {
    expiresInHours?: number | null;
    maxUses?: number | null;
    requiresApproval?: boolean;
    customSlug?: string | null;
  }
): Promise<InviteLinkResult> {
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can generate invite links", status: 403 };
  }

  let token: string;
  const rawSlug = options?.customSlug?.trim();

  if (rawSlug) {
    const slug = rawSlug.toLowerCase();

    if (!/^[a-z0-9_-]{3,50}$/.test(slug)) {
      return {
        success: false,
        error:
          "Custom invite code must be 3–50 characters and contain only letters, numbers, hyphens, and underscores.",
      };
    }

    if (RESERVED_SLUGS.has(slug)) {
      return {
        success: false,
        error: `The invite code "${slug}" is reserved. Please choose another code.`,
      };
    }

    const [existing] = await db
      .select({ id: inviteLinks.id })
      .from(inviteLinks)
      .where(eq(inviteLinks.token, slug))
      .limit(1);

    if (existing) {
      return {
        success: false,
        error: `The invite code "${slug}" is already in use. Please choose another.`,
      };
    }

    token = slug;
  } else {
    token = crypto.randomBytes(16).toString("hex");
  }

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

    return { success: true, token };
  } catch (error) {
    console.error("Failed to create invite link:", error);
    return { success: false, error: "Failed to create invite link", status: 500 };
  }
}

export async function rotateInviteLink(
  user: ApiUser,
  groupId: string,
  oldInviteId?: string
): Promise<InviteLinkResult> {
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can rotate invite links", status: 403 };
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

    return { success: true, token };
  } catch (error) {
    console.error("Failed to rotate invite link:", error);
    return { success: false, error: "Failed to rotate invite link", status: 500 };
  }
}

export async function revokeInviteLink(
  user: ApiUser,
  groupId: string,
  inviteId: string
): Promise<GroupActionResult> {
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can revoke invite links", status: 403 };
  }

  try {
    await db
      .update(inviteLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(inviteLinks.id, inviteId), eq(inviteLinks.groupId, groupId)));

    return { success: true };
  } catch (error) {
    console.error("Failed to revoke invite link:", error);
    return { success: false, error: "Failed to revoke invite link", status: 500 };
  }
}

export async function createDirectInvite(
  user: ApiUser,
  groupId: string,
  input: { username: unknown }
): Promise<DirectInviteResult> {
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, user.id),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can invite members by username", status: 403 };
  }

  const validation = directInviteSchema.safeParse({ username: input.username });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid username",
      status: 400,
    };
  }

  const normalizedUsername = validation.data.username.toLowerCase();

  const [invitee] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(
      and(sql`lower(${users.username}) = ${normalizedUsername}`, eq(users.needsUsername, false))
    )
    .limit(1);

  if (!invitee) {
    return { success: false, error: "User not found", status: 404 };
  }

  if (invitee.id === user.id) {
    return { success: false, error: "You cannot invite yourself", status: 400 };
  }

  const [existingMember] = await db
    .select({ id: groupMembers.id, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, invitee.id)))
    .limit(1);

  if (existingMember && existingMember.status === "active") {
    return {
      success: false,
      error: "That user is already a member of this group",
      status: 409,
    };
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + DIRECT_INVITE_EXPIRY_HOURS * 3600 * 1000);

  const [existingInvite] = await db
    .select({
      id: directInvites.id,
      status: directInvites.status,
      expiresAt: directInvites.expiresAt,
    })
    .from(directInvites)
    .where(and(eq(directInvites.groupId, groupId), eq(directInvites.inviteeId, invitee.id)))
    .limit(1);

  if (existingInvite && existingInvite.status === "pending") {
    const stillValid = existingInvite.expiresAt === null || existingInvite.expiresAt > new Date();
    if (stillValid) {
      return {
        success: false,
        error: `@${invitee.username} already has a pending invite for this group`,
        status: 409,
      };
    }
  }

  try {
    let inviteId: string;

    if (existingInvite) {
      inviteId = existingInvite.id;
      await db
        .update(directInvites)
        .set({
          inviterId: user.id,
          token,
          status: "pending",
          expiresAt,
          createdAt: new Date(),
        })
        .where(eq(directInvites.id, inviteId));
    } else {
      inviteId = crypto.randomUUID();
      await db.insert(directInvites).values({
        id: inviteId,
        groupId,
        inviterId: user.id,
        inviteeId: invitee.id,
        token,
        expiresAt,
      });
    }

    return { success: true, inviteId, token, inviteeUsername: invitee.username };
  } catch (error) {
    console.error("Failed to create direct invite:", error);
    return { success: false, error: "Failed to send invite. Please try again.", status: 500 };
  }
}

export async function respondToDirectInvite(
  user: ApiUser,
  inviteId: string,
  decision: "accepted" | "declined"
): Promise<GroupActionResult> {
  const inviteeUsers = alias(users, "direct_invitee_users");
  const inviterUsers = alias(users, "direct_invite_inviter_users");

  const [invite] = await db
    .select({
      id: directInvites.id,
      groupId: directInvites.groupId,
      inviterId: directInvites.inviterId,
      inviteeId: directInvites.inviteeId,
      status: directInvites.status,
      expiresAt: directInvites.expiresAt,
      inviterUsername: inviterUsers.username,
    })
    .from(directInvites)
    .innerJoin(inviterUsers, eq(directInvites.inviterId, inviterUsers.id))
    .innerJoin(inviteeUsers, eq(directInvites.inviteeId, inviteeUsers.id))
    .where(eq(directInvites.id, inviteId))
    .limit(1);

  if (!invite) {
    return { success: false, error: "Invite not found", status: 404 };
  }

  if (invite.inviteeId !== user.id) {
    return { success: false, error: "You can only respond to invites sent to you", status: 403 };
  }

  if (invite.status !== "pending") {
    return { success: false, error: `This invite is already ${invite.status}`, status: 409 };
  }

  const [membership] = await db
    .select({ status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, invite.groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (membership && membership.status === "active") {
    await db.delete(directInvites).where(eq(directInvites.id, inviteId));
    return { success: true };
  }

  if (invite.expiresAt !== null && invite.expiresAt < new Date()) {
    await db.delete(directInvites).where(eq(directInvites.id, inviteId));
    return { success: false, error: "This invite has expired", status: 409 };
  }

  if (decision === "declined") {
    try {
      await db.delete(directInvites).where(eq(directInvites.id, inviteId));
      return { success: true };
    } catch (error) {
      console.error("Failed to decline direct invite:", error);
      return { success: false, error: "Failed to decline invite", status: 500 };
    }
  }

  const inviteConsumedError = new Error("This invite is no longer pending");
  try {
    await db.transaction(async (tx) => {
      const [consumedInvite] = await tx
        .delete(directInvites)
        .where(and(eq(directInvites.id, inviteId), eq(directInvites.status, "pending")))
        .returning({ id: directInvites.id });

      if (!consumedInvite) throw inviteConsumedError;

      const [existingMember] = await tx
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, invite.groupId), eq(groupMembers.userId, user.id)))
        .limit(1);

      if (existingMember) {
        await tx
          .update(groupMembers)
          .set({ status: "active", role: "member" })
          .where(eq(groupMembers.id, existingMember.id));
      } else {
        await tx.insert(groupMembers).values({
          id: crypto.randomUUID(),
          groupId: invite.groupId,
          userId: user.id,
          role: "member",
          status: "active",
        });
      }

      const acceptMsgId = crypto.randomUUID();
      const body = `${user.username} accepted the invite from @${invite.inviterUsername}.`;
      await tx.insert(messages).values({
        id: acceptMsgId,
        groupId: invite.groupId,
        authorId: null,
        body,
        type: "system",
      });

      await broadcastWsEvent({
        type: "new_message",
        groupId: invite.groupId,
        message: {
          id: acceptMsgId,
          body,
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

    return { success: true };
  } catch (error) {
    if (error === inviteConsumedError) {
      return { success: false, error: inviteConsumedError.message, status: 409 };
    }
    console.error("Failed to accept direct invite:", error);
    return { success: false, error: "Failed to accept invite. Please try again.", status: 500 };
  }
}

export async function revokeDirectInvite(
  user: ApiUser,
  groupId: string,
  inviteId: string
): Promise<GroupActionResult> {
  const membership = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, user.id),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (membership.length === 0 || membership[0].role !== "admin") {
    return { success: false, error: "Only admins can revoke invites", status: 403 };
  }

  const [invite] = await db
    .select({ id: directInvites.id, status: directInvites.status })
    .from(directInvites)
    .where(and(eq(directInvites.id, inviteId), eq(directInvites.groupId, groupId)))
    .limit(1);

  if (!invite) {
    return { success: false, error: "Invite not found", status: 404 };
  }

  if (invite.status !== "pending") {
    return { success: false, error: `Invite is already ${invite.status}`, status: 409 };
  }

  try {
    await db.update(directInvites).set({ status: "revoked" }).where(eq(directInvites.id, inviteId));
    return { success: true };
  } catch (error) {
    console.error("Failed to revoke direct invite:", error);
    return { success: false, error: "Failed to revoke invite", status: 500 };
  }
}

export async function resolveDirectInviteByToken(
  token: string
): Promise<ResolvedDirectInvite | null> {
  const inviteeUsers = alias(users, "direct_invitee_users");
  const inviterUsers = alias(users, "direct_invite_inviter_users");

  const [invite] = await db
    .select({
      id: directInvites.id,
      groupId: directInvites.groupId,
      groupName: groups.name,
      inviterUsername: inviterUsers.username,
      inviteeId: directInvites.inviteeId,
      inviteeUsername: inviteeUsers.username,
      status: directInvites.status,
      expiresAt: directInvites.expiresAt,
    })
    .from(directInvites)
    .innerJoin(groups, eq(directInvites.groupId, groups.id))
    .innerJoin(inviterUsers, eq(directInvites.inviterId, inviterUsers.id))
    .innerJoin(inviteeUsers, eq(directInvites.inviteeId, inviteeUsers.id))
    .where(eq(directInvites.token, token))
    .limit(1);

  if (!invite) return null;

  if (invite.status === "pending" && invite.expiresAt !== null && invite.expiresAt < new Date()) {
    await db.delete(directInvites).where(eq(directInvites.id, invite.id));
    return { ...invite, status: "expired" };
  }

  return invite;
}

export async function joinGroup(token: string, user: ApiUser): Promise<JoinGroupResult> {
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
    return { success: false, error: "This invite link is invalid or does not exist.", status: 404 };
  }

  const invite = validInvites[0];

  if (invite.revokedAt !== null) {
    return { success: false, error: "This invite link has been revoked by an admin.", status: 404 };
  }

  const existingMember = await db
    .select({ id: groupMembers.id, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, invite.groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (existingMember.length > 0) {
    const staleDirectInvites = and(
      eq(directInvites.groupId, invite.groupId),
      eq(directInvites.inviteeId, user.id)
    );

    if (existingMember[0].status === "active") {
      await db.delete(directInvites).where(staleDirectInvites);
      return { success: true, groupId: invite.groupId, groupName: invite.groupName };
    }
    await db
      .update(groupMembers)
      .set({ status: "active", role: "member" })
      .where(eq(groupMembers.id, existingMember[0].id));
    await db.delete(directInvites).where(staleDirectInvites);

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
    }

    return {
      success: false,
      pendingApproval: true,
      groupId: invite.groupId,
      groupName: invite.groupName,
      error:
        "This group requires admin approval. Your join request has been submitted to the admin.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(groupMembers).values({
        id: crypto.randomUUID(),
        groupId: invite.groupId,
        userId: user.id,
        role: "member",
        status: "active",
      });

      await tx
        .delete(directInvites)
        .where(
          and(eq(directInvites.groupId, invite.groupId), eq(directInvites.inviteeId, user.id))
        );

      await tx
        .update(inviteLinks)
        .set({ useCount: sql`${inviteLinks.useCount} + 1` })
        .where(eq(inviteLinks.id, invite.id));

      const joinMsgId = crypto.randomUUID();
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

    return { success: true, groupId: invite.groupId };
  } catch (error) {
    console.error("Failed to join group:", error);
    return { success: false, error: "Failed to join the group. Please try again.", status: 500 };
  }
}

export async function createJoinRequest(
  user: ApiUser,
  groupId: string
): Promise<GroupActionResult> {
  const [existingMember] = await db
    .select({ id: groupMembers.id, status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (existingMember && existingMember.status === "active") {
    return { success: true };
  }

  const [existingReq] = await db
    .select()
    .from(joinRequests)
    .where(and(eq(joinRequests.groupId, groupId), eq(joinRequests.userId, user.id)))
    .limit(1);

  if (existingReq) {
    if (existingReq.status === "pending") {
      return {
        success: false,
        error: "You already have a pending join request for this group.",
        status: 409,
      };
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

  return { success: true };
}

export async function reviewJoinRequest(
  user: ApiUser,
  groupId: string,
  requestId: string,
  decision: "approved" | "declined"
): Promise<GroupActionResult> {
  const [adminCheck] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (!adminCheck || adminCheck.role !== "admin") {
    return { success: false, error: "Only admins can review join requests", status: 403 };
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
    return { success: false, error: "Join request not found", status: 404 };
  }

  if (req.status !== "pending") {
    return { success: false, error: `Request is already ${req.status}`, status: 409 };
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

        await tx
          .delete(directInvites)
          .where(and(eq(directInvites.groupId, groupId), eq(directInvites.inviteeId, req.userId)));

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

    return { success: true };
  } catch (error) {
    console.error("Failed to review join request:", error);
    return { success: false, error: "Failed to process join request", status: 500 };
  }
}

export async function transferAdmin(
  user: ApiUser,
  groupId: string,
  newAdminUserId: string
): Promise<GroupActionResult> {
  const [membership] = await db
    .select({ role: groupMembers.role, id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return {
      success: false,
      error: "Only the current group admin can transfer admin rights",
      status: 403,
    };
  }

  const [targetMember] = await db
    .select({ id: groupMembers.id, username: users.username })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, newAdminUserId),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (!targetMember) {
    return { success: false, error: "Target member not found in this group", status: 404 };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(groupMembers)
        .set({ role: "member" })
        .where(eq(groupMembers.id, membership.id));

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

      await broadcastWsEvent({ type: "refresh", groupId });
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to transfer admin rights:", error);
    return { success: false, error: "Failed to transfer admin rights", status: 500 };
  }
}

class LeaveGroupBlocked extends Error {
  constructor(readonly result: GroupActionResult) {
    super("leave-group-blocked");
  }
}

export async function leaveGroup(user: ApiUser, groupId: string): Promise<GroupActionResult> {
  const [membership] = await db
    .select({ id: groupMembers.id, role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, user.id),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);

  if (!membership) {
    return { success: false, error: "You are not an active member of this group", status: 403 };
  }

  try {
    await db.transaction(async (tx) => {
      // Serialize with confirmSettlement so a payment cannot be confirmed
      // between the balance re-check and the membership write (TOCTOU).
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${groupId}))`);

      const [current] = await tx
        .select({ id: groupMembers.id, role: groupMembers.role })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, user.id),
            eq(groupMembers.status, "active")
          )
        )
        .limit(1);

      if (!current) {
        throw new LeaveGroupBlocked({
          success: false,
          error: "You are not an active member of this group",
          status: 403,
        });
      }

      const allMembers = await tx
        .select({ id: users.id, username: users.username, status: groupMembers.status })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.userId, users.id))
        .where(eq(groupMembers.groupId, groupId));

      const rawExpenses = await tx
        .select({
          id: expenses.id,
          amount: expenses.amount,
          paidByUserId: expenses.paidByUserId,
        })
        .from(expenses)
        .where(eq(expenses.groupId, groupId));

      const expIds = rawExpenses.map((e) => e.id);
      const splits =
        expIds.length > 0
          ? await tx
              .select({
                expenseId: expenseSplits.expenseId,
                userId: expenseSplits.userId,
                owedAmount: expenseSplits.owedAmount,
              })
              .from(expenseSplits)
              .where(inArray(expenseSplits.expenseId, expIds))
          : [];

      const splitsByExp = new Map<string, { userId: string; owedAmount: string | number }[]>();
      for (const s of splits) {
        const list = splitsByExp.get(s.expenseId) || [];
        list.push(s);
        splitsByExp.set(s.expenseId, list);
      }

      const rawSettlements = await tx
        .select({
          id: settlements.id,
          amount: settlements.amount,
          paidByUserId: settlements.paidByUserId,
          receivedByUserId: settlements.receivedByUserId,
          status: settlements.status,
        })
        .from(settlements)
        .where(eq(settlements.groupId, groupId));

      const { balances } = calculateBalancesAndSettlements(
        allMembers.map((m) => ({
          id: m.id,
          username: m.username,
          isActive: m.status === "active",
        })),
        rawExpenses.map((e) => ({
          id: e.id,
          amount: e.amount,
          paidByUserId: e.paidByUserId,
          splits: splitsByExp.get(e.id) || [],
        })),
        rawSettlements
      );

      const myBalance = balances.find((b) => b.userId === user.id)?.netBalance || 0;
      const myBalanceCents = Math.round(myBalance * 100);
      if (myBalanceCents !== 0) {
        const formatted = (Math.abs(myBalanceCents) / 100).toFixed(2);
        if (myBalanceCents > 0) {
          throw new LeaveGroupBlocked({
            success: false,
            error: `You cannot leave this group because you are owed ₹${formatted}. Settle up with other members before leaving.`,
          });
        }
        throw new LeaveGroupBlocked({
          success: false,
          error: `You cannot leave this group because you owe ₹${formatted}. Please settle your balance before leaving.`,
        });
      }

      if (current.role === "admin") {
        const otherActiveMembers = allMembers.filter(
          (m) => m.status === "active" && m.id !== user.id
        );
        if (otherActiveMembers.length === 0) {
          throw new LeaveGroupBlocked({
            success: false,
            error:
              "You are the only active member of this group. Delete the group instead of leaving it.",
          });
        }
        throw new LeaveGroupBlocked({
          success: false,
          error:
            "As the group admin, promote another member to admin before you can leave. You can do that in Group Settings.",
        });
      }

      // Pending settlements cannot be confirmed once a party is inactive, so
      // cancel the leaver's pending rows to avoid orphaned affirmations.
      await tx
        .update(settlements)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(settlements.groupId, groupId),
            eq(settlements.status, "pending"),
            or(eq(settlements.paidByUserId, user.id), eq(settlements.receivedByUserId, user.id))
          )
        );

      await tx
        .update(directInvites)
        .set({ status: "revoked" })
        .where(
          and(
            eq(directInvites.groupId, groupId),
            eq(directInvites.status, "pending"),
            eq(directInvites.inviterId, user.id)
          )
        );

      await tx
        .update(directInvites)
        .set({ status: "revoked" })
        .where(
          and(
            eq(directInvites.groupId, groupId),
            eq(directInvites.status, "pending"),
            eq(directInvites.inviteeId, user.id)
          )
        );

      await tx
        .update(groupMembers)
        .set({ status: "inactive" })
        .where(eq(groupMembers.id, current.id));

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

      await broadcastWsEvent({ type: "refresh", groupId });
    });

    return { success: true };
  } catch (error) {
    if (error instanceof LeaveGroupBlocked) {
      return error.result;
    }
    console.error("Failed to leave group:", error);
    return { success: false, error: "Failed to leave group", status: 500 };
  }
}
