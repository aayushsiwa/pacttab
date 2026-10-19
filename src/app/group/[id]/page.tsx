"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { useGroupDetail, useMessages } from "@/hooks/queries/use-groups";
import { useCurrentUser } from "@/hooks/queries/use-user";
import { GroupTabs } from "@/components/group/group-tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { GroupDetails, MessageItem } from "@/types/api";

interface GroupPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function GroupPage({ params }: GroupPageProps) {
  const [groupId, setGroupId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setGroupId(p.id));
  }, [params]);

  const {
    data: details,
    isLoading: detailsLoading,
    error: detailsError,
  } = useGroupDetail<GroupDetails>(groupId);
  const { data: messages, isLoading: messagesLoading } = useMessages<MessageItem[]>(groupId);
  const { data: user, isPending: userPending, error: userError } = useCurrentUser();

  if (!groupId) return null;

  if (detailsLoading || messagesLoading || userPending) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-6 text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium">Loading group...</p>
        </div>
      </div>
    );
  }

  if (detailsError || !details) {
    notFound();
  }

  if (userError || !user) {
    return <p role="alert">Failed to load current user. Please try again.</p>;
  }

  const groupForTabs = details.group
    ? { ...details.group, createdAt: new Date(details.group.createdAt) }
    : null;
  const membersForTabs = (details.members ?? []).map((m) => ({
    ...m,
    joinedAt: new Date(m.joinedAt),
  }));
  const expensesForTabs = (details.expenses ?? []).map((e) => ({
    ...e,
    amount: Number(e.amount),
    expenseDate: new Date(e.expenseDate),
    createdAt: new Date(e.createdAt),
    splits: e.splits.map((s) => ({ ...s, expenseId: e.id, owedAmount: Number(s.owedAmount) })),
  }));
  const settlementsForTabs = (details.settlements ?? []).map((s) => ({
    ...s,
    amount: Number(s.amount),
    createdByUserId: s.createdByUserId ?? undefined,
    confirmedAt: s.confirmedAt ? new Date(s.confirmedAt) : undefined,
    rejectedAt: s.rejectedAt ? new Date(s.rejectedAt) : undefined,
    settledAt: new Date(s.settledAt),
  }));
  const balancesForTabs = (details.balances ?? []).map((b) => ({
    ...b,
    totalExpensePaid: Number(b.totalExpensePaid),
    totalExpenseShare: Number(b.totalExpenseShare),
    settlementsSent: Number(b.settlementsSent),
    settlementsReceived: Number(b.settlementsReceived),
    netBalance: Number(b.netBalance),
  }));
  const suggestedSettlementsForTabs = (details.suggestedSettlements ?? []).map((s) => ({
    ...s,
    amount: Number(s.amount),
  }));
  const activeInvitesForTabs = (details.activeInvites ?? []).map((i) => ({
    ...i,
    createdAt: new Date(i.createdAt),
    expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
  }));
  const pendingJoinRequestsForTabs = (details.pendingJoinRequests ?? []).map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
  }));
  const directInvitesForTabs = (details.directInvites ?? []).map((i) => ({
    ...i,
    createdAt: new Date(i.createdAt),
    expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
  }));
  const messagesForTabs = (messages ?? []).map((m) => ({
    ...m,
    createdAt: typeof m.createdAt === "string" ? new Date(m.createdAt) : m.createdAt,
  }));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/groups">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Groups</span>
          </Button>
        </Link>
        <span className="text-muted-foreground hidden text-xs sm:inline-block">
          Private Room • Real-time Sync
        </span>
      </div>
      <GroupTabs
        group={groupForTabs!}
        groupId={groupId}
        currentUserId={user.id}
        currentUsername={user.username}
        currentUserRole={details.currentUserRole}
        members={membersForTabs}
        messages={messagesForTabs}
        expenses={expensesForTabs}
        settlements={settlementsForTabs}
        balances={balancesForTabs}
        suggestedSettlements={suggestedSettlementsForTabs}
        activeInvites={activeInvitesForTabs}
        pendingJoinRequests={pendingJoinRequestsForTabs}
        directInvites={directInvitesForTabs}
      />
    </div>
  );
}
