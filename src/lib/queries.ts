import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  groups,
  groupMembers,
  users,
  expenses,
  expenseSplits,
  settlements,
  inviteLinks,
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

  return memberships.map((m) => ({
    id: m.groupId,
    name: m.groupName,
    description: m.groupDescription,
    role: m.role,
    joinedAt: m.joinedAt,
    createdAt: m.createdAt,
    memberCount: countMap.get(m.groupId) || 1,
    lastIncomingMessageAt: messageMap.get(m.groupId) || null,
  }));
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
  const group = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (group.length === 0) return null;

  // 3. Fetch all active members
  const members = await db
    .select({
      id: users.id,
      username: users.username,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")));

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
  const splits = expenseIds.length > 0
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
      settledAt: settlements.settledAt,
      createdAt: settlements.createdAt,
    })
    .from(settlements)
    .where(eq(settlements.groupId, groupId))
    .orderBy(desc(settlements.settledAt), desc(settlements.createdAt));

  const memberNameMap = new Map(members.map((m) => [m.id, m.username]));

  const detailedSettlements = rawSettlements.map((s) => ({
    ...s,
    payerUsername: memberNameMap.get(s.paidByUserId) || "Unknown",
    recipientUsername: memberNameMap.get(s.receivedByUserId) || "Unknown",
  }));

  // 6. Compute balances and settlements
  const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
    members.map((m) => ({ id: m.id, username: m.username })),
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
    }))
  );

  // 7. If admin, fetch active invite links
  let activeInvites: { id: string; token: string; createdAt: Date; useCount: number; maxUses: number | null }[] = [];
  if (currentUserRole === "admin") {
    activeInvites = await db
      .select({
        id: inviteLinks.id,
        token: inviteLinks.token,
        createdAt: inviteLinks.createdAt,
        useCount: inviteLinks.useCount,
        maxUses: inviteLinks.maxUses,
      })
      .from(inviteLinks)
      .where(and(eq(inviteLinks.groupId, groupId), sql`${inviteLinks.revokedAt} IS NULL`))
      .orderBy(desc(inviteLinks.createdAt));
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
  };
}
