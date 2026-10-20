import { eq, and, or, desc, gt, isNull, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  groups,
  groupMembers,
  users,
  expenses,
  expenseSplits,
  settlements,
  inviteLinks,
  joinRequests,
  directInvites,
  messages,
} from "@/db/schema";
import { calculateBalancesAndSettlements } from "@/lib/balances";

export async function getUserGroups(userId: string) {
  const memberships = await db
    .select({
      groupId: groupMembers.groupId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      groupName: groups.name,
      groupDescription: groups.description,
      createdAt: groups.createdAt,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")))
    .orderBy(desc(groups.createdAt));

  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.groupId);

  // Count active members per group
  const memberCounts = await db
    .select({
      groupId: groupMembers.groupId,
      count: sql<number>`count(${groupMembers.id})::int`,
    })
    .from(groupMembers)
    .where(and(inArray(groupMembers.groupId, groupIds), eq(groupMembers.status, "active")))
    .groupBy(groupMembers.groupId);

  const countMap = new Map<string, number>();
  memberCounts.forEach((c) => countMap.set(c.groupId, c.count));

  // Fetch timestamp of latest incoming message (authored by someone else or system)
  const messageStats = await db
    .select({
      groupId: messages.groupId,
      lastIncomingMessageAt: sql<Date | null>`max(${messages.createdAt}) filter (where ${messages.authorId} is null or ${messages.authorId} != ${userId})`,
    })
    .from(messages)
    .where(inArray(messages.groupId, groupIds))
    .groupBy(messages.groupId);

  const messageMap = new Map<string, Date | null>();
  messageStats.forEach((m) => messageMap.set(m.groupId, m.lastIncomingMessageAt));

  // Count pending join requests for groups where user is admin
  const adminGroupIds = memberships.filter((m) => m.role === "admin").map((m) => m.groupId);

  const pendingJoinCounts =
    adminGroupIds.length > 0
      ? await db
          .select({
            groupId: joinRequests.groupId,
            count: sql<number>`count(${joinRequests.id})::int`,
          })
          .from(joinRequests)
          .where(
            and(inArray(joinRequests.groupId, adminGroupIds), eq(joinRequests.status, "pending"))
          )
          .groupBy(joinRequests.groupId)
      : [];

  const pendingJoinMap = new Map<string, number>();
  pendingJoinCounts.forEach((c) => pendingJoinMap.set(c.groupId, c.count));

  // Count pending settlements requiring affirmation from current user
  const pendingSettlementCounts = await db
    .select({
      groupId: settlements.groupId,
      count: sql<number>`count(${settlements.id})::int`,
    })
    .from(settlements)
    .where(
      and(
        inArray(settlements.groupId, groupIds),
        eq(settlements.status, "pending"),
        sql`(${settlements.createdByUserId} = ${settlements.paidByUserId} AND ${settlements.receivedByUserId} = ${userId}) OR (${settlements.createdByUserId} = ${settlements.receivedByUserId} AND ${settlements.paidByUserId} = ${userId})`
      )
    )
    .groupBy(settlements.groupId);

  const pendingSettlementMap = new Map<string, number>();
  pendingSettlementCounts.forEach((s) => pendingSettlementMap.set(s.groupId, s.count));

  return memberships.map((m) => {
    const pendingJoinRequestsCount = pendingJoinMap.get(m.groupId) || 0;
    const pendingSettlementsCount = pendingSettlementMap.get(m.groupId) || 0;
    return {
      id: m.groupId,
      name: m.groupName,
      description: m.groupDescription,
      role: m.role,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      memberCount: countMap.get(m.groupId) || 1,
      lastIncomingMessageAt: messageMap.get(m.groupId) || null,
      pendingJoinRequestsCount,
      pendingSettlementsCount,
      pendingActionCount: pendingJoinRequestsCount + pendingSettlementsCount,
    };
  });
}

export async function getGroupDetails(groupId: string, userId: string) {
  // 1. Check current user membership
  const membership = await db
    .select({
      role: groupMembers.role,
      status: groupMembers.status,
    })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (membership.length === 0 || membership[0].status !== "active") {
    return null;
  }

  const currentUserRole = membership[0].role;

  // 2. Fetch group
  const group = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);

  if (group.length === 0) return null;

  // 3. Fetch all members (active and departed). Departed members must stay in
  //    the balance math so transactions referencing them are never dropped.
  const allMembers = await db
    .select({
      id: users.id,
      username: users.username,
      role: groupMembers.role,
      status: groupMembers.status,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const members = allMembers
    .filter((m) => m.status === "active")
    .map(({ id, username, role, joinedAt }) => ({ id, username, role, joinedAt }));

  // 4. Fetch expenses with payer and splits
  const rawExpenses = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      paidByUserId: expenses.paidByUserId,
      expenseDate: expenses.expenseDate,
      createdBy: expenses.createdBy,
      createdAt: expenses.createdAt,
      payerUsername: users.username,
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.paidByUserId, users.id))
    .where(eq(expenses.groupId, groupId))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

  const expenseIds = rawExpenses.map((e) => e.id);
  const splits =
    expenseIds.length > 0
      ? await db
          .select({
            id: expenseSplits.id,
            expenseId: expenseSplits.expenseId,
            userId: expenseSplits.userId,
            owedAmount: expenseSplits.owedAmount,
            username: users.username,
          })
          .from(expenseSplits)
          .innerJoin(users, eq(expenseSplits.userId, users.id))
          .where(inArray(expenseSplits.expenseId, expenseIds))
      : [];

  const splitsByExpenseId = new Map<string, typeof splits>();
  for (const s of splits) {
    const list = splitsByExpenseId.get(s.expenseId) || [];
    list.push(s);
    splitsByExpenseId.set(s.expenseId, list);
  }

  const detailedExpenses = rawExpenses.map((e) => ({
    ...e,
    splits: splitsByExpenseId.get(e.id) || [],
  }));

  // 5. Fetch settlements
  const rawSettlements = await db
    .select({
      id: settlements.id,
      amount: settlements.amount,
      paidByUserId: settlements.paidByUserId,
      receivedByUserId: settlements.receivedByUserId,
      status: settlements.status,
      createdByUserId: settlements.createdByUserId,
      confirmedAt: settlements.confirmedAt,
      rejectedAt: settlements.rejectedAt,
      settledAt: settlements.settledAt,
      createdAt: settlements.createdAt,
    })
    .from(settlements)
    .where(eq(settlements.groupId, groupId))
    .orderBy(desc(settlements.settledAt), desc(settlements.createdAt));

  const memberNameMap = new Map(allMembers.map((m) => [m.id, m.username]));

  const detailedSettlements = rawSettlements.map((s) => ({
    ...s,
    payerUsername: memberNameMap.get(s.paidByUserId) || "Unknown",
    recipientUsername: memberNameMap.get(s.receivedByUserId) || "Unknown",
    creatorUsername: memberNameMap.get(s.createdByUserId || "") || "Unknown",
  }));

  // 6. Compute balances and settlements (only confirmed settlements count towards net balances)
  const { balances: allBalances, suggestedSettlements } = calculateBalancesAndSettlements(
    allMembers.map((m) => ({
      id: m.id,
      username: m.username,
      isActive: m.status === "active",
    })),
    detailedExpenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      paidByUserId: e.paidByUserId,
      splits: e.splits.map((s) => ({ userId: s.userId, owedAmount: s.owedAmount })),
    })),
    rawSettlements.map((s) => ({
      id: s.id,
      amount: s.amount,
      paidByUserId: s.paidByUserId,
      receivedByUserId: s.receivedByUserId,
      status: s.status,
    }))
  );

  // Departed members only appear as "ghosts" while they still hold a residual.
  const balances = allBalances.filter((b) => b.isActive || Math.round(b.netBalance * 100) !== 0);

  // 7. If admin, fetch active invite links, pending join requests & direct invites
  let activeInvites: {
    id: string;
    token: string;
    createdAt: Date;
    useCount: number;
    maxUses: number | null;
    expiresAt: Date | null;
    requiresApproval: boolean;
  }[] = [];
  let pendingJoinRequests: {
    id: string;
    userId: string;
    username: string;
    createdAt: Date;
  }[] = [];
  let directInvitesForGroup: {
    id: string;
    token: string;
    status: string;
    createdAt: Date;
    expiresAt: Date | null;
    inviteeUsername: string;
    inviterUsername: string;
  }[] = [];

  if (currentUserRole === "admin") {
    activeInvites = await db
      .select({
        id: inviteLinks.id,
        token: inviteLinks.token,
        createdAt: inviteLinks.createdAt,
        useCount: inviteLinks.useCount,
        maxUses: inviteLinks.maxUses,
        expiresAt: inviteLinks.expiresAt,
        requiresApproval: inviteLinks.requiresApproval,
      })
      .from(inviteLinks)
      .where(and(eq(inviteLinks.groupId, groupId), sql`${inviteLinks.revokedAt} IS NULL`))
      .orderBy(desc(inviteLinks.createdAt));

    pendingJoinRequests = await db
      .select({
        id: joinRequests.id,
        userId: joinRequests.userId,
        username: users.username,
        createdAt: joinRequests.createdAt,
      })
      .from(joinRequests)
      .innerJoin(users, eq(joinRequests.userId, users.id))
      .where(and(eq(joinRequests.groupId, groupId), eq(joinRequests.status, "pending")))
      .orderBy(desc(joinRequests.createdAt));

    const inviteeUsers = alias(users, "direct_invitee");
    directInvitesForGroup = await db
      .select({
        id: directInvites.id,
        token: directInvites.token,
        status: directInvites.status,
        createdAt: directInvites.createdAt,
        expiresAt: directInvites.expiresAt,
        inviteeUsername: inviteeUsers.username,
        inviterUsername: users.username,
      })
      .from(directInvites)
      .innerJoin(users, eq(directInvites.inviterId, users.id))
      .innerJoin(inviteeUsers, eq(directInvites.inviteeId, inviteeUsers.id))
      .where(
        and(
          eq(directInvites.groupId, groupId),
          sql`NOT EXISTS (
            SELECT 1 FROM "group_members" gm
            WHERE gm."group_id" = ${directInvites.groupId}
              AND gm."user_id" = ${directInvites.inviteeId}
              AND gm."status" = 'active'
          )`
        )
      )
      .orderBy(desc(directInvites.createdAt));
  }

  return {
    group: group[0],
    currentUserRole,
    members,
    expenses: detailedExpenses,
    settlements: detailedSettlements,
    balances,
    suggestedSettlements,
    activeInvites,
    pendingJoinRequests,
    directInvites: directInvitesForGroup,
  };
}

export async function getUserPendingJoinRequests(userId: string) {
  return db
    .select({
      id: joinRequests.id,
      groupId: joinRequests.groupId,
      groupName: groups.name,
      groupDescription: groups.description,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .innerJoin(groups, eq(joinRequests.groupId, groups.id))
    .where(and(eq(joinRequests.userId, userId), eq(joinRequests.status, "pending")))
    .orderBy(desc(joinRequests.createdAt));
}

export async function getUserPendingDirectInvites(userId: string) {
  return db
    .select({
      id: directInvites.id,
      groupId: directInvites.groupId,
      groupName: groups.name,
      groupDescription: groups.description,
      token: directInvites.token,
      inviterUsername: users.username,
      expiresAt: directInvites.expiresAt,
      createdAt: directInvites.createdAt,
    })
    .from(directInvites)
    .innerJoin(groups, eq(directInvites.groupId, groups.id))
    .innerJoin(users, eq(directInvites.inviterId, users.id))
    .where(
      and(
        eq(directInvites.inviteeId, userId),
        eq(directInvites.status, "pending"),
        or(isNull(directInvites.expiresAt), gt(directInvites.expiresAt, new Date())),
        sql`NOT EXISTS (
          SELECT 1 FROM "group_members" gm
          WHERE gm."group_id" = ${directInvites.groupId}
            AND gm."user_id" = ${userId}
            AND gm."status" = 'active'
        )`
      )
    )
    .orderBy(desc(directInvites.createdAt));
}

export async function getInviteLinkByToken(token: string) {
  const [row] = await db
    .select({ id: inviteLinks.id })
    .from(inviteLinks)
    .where(eq(inviteLinks.token, token))
    .limit(1);
  return row ?? null;
}

export async function getUserPendingAdminActionsCount(userId: string): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`count(${joinRequests.id})::int`,
    })
    .from(joinRequests)
    .innerJoin(
      groupMembers,
      and(
        eq(joinRequests.groupId, groupMembers.groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.role, "admin"),
        eq(groupMembers.status, "active")
      )
    )
    .where(eq(joinRequests.status, "pending"));

  return result[0]?.count || 0;
}

export interface UnsettledGroup {
  groupId: string;
  groupName: string;
  netBalance: number;
}

/**
 * Lists active groups where the user still owes or is owed money. Used to block
 * account deletion so a hard delete can never rewrite other members' history.
 */
export async function getUserUnsettledGroups(userId: string): Promise<UnsettledGroup[]> {
  const memberships = await db
    .select({ groupId: groupMembers.groupId, groupName: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active")));

  const unsettled: UnsettledGroup[] = [];

  for (const membership of memberships) {
    const allMembers = await db
      .select({ id: users.id, username: users.username, status: groupMembers.status })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, membership.groupId));

    const rawExpenses = await db
      .select({ id: expenses.id, amount: expenses.amount, paidByUserId: expenses.paidByUserId })
      .from(expenses)
      .where(eq(expenses.groupId, membership.groupId));

    const expenseIds = rawExpenses.map((e) => e.id);
    const splits =
      expenseIds.length > 0
        ? await db
            .select({
              expenseId: expenseSplits.expenseId,
              userId: expenseSplits.userId,
              owedAmount: expenseSplits.owedAmount,
            })
            .from(expenseSplits)
            .where(inArray(expenseSplits.expenseId, expenseIds))
        : [];

    const splitsByExpenseId = new Map<string, typeof splits>();
    for (const split of splits) {
      const list = splitsByExpenseId.get(split.expenseId) || [];
      list.push(split);
      splitsByExpenseId.set(split.expenseId, list);
    }

    const rawSettlements = await db
      .select({
        id: settlements.id,
        amount: settlements.amount,
        paidByUserId: settlements.paidByUserId,
        receivedByUserId: settlements.receivedByUserId,
        status: settlements.status,
      })
      .from(settlements)
      .where(eq(settlements.groupId, membership.groupId));

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
        splits: splitsByExpenseId.get(e.id) || [],
      })),
      rawSettlements
    );

    const mine = balances.find((b) => b.userId === userId)?.netBalance ?? 0;
    if (Math.round(mine * 100) !== 0) {
      unsettled.push({
        groupId: membership.groupId,
        groupName: membership.groupName,
        netBalance: mine,
      });
    }
  }

  return unsettled;
}
