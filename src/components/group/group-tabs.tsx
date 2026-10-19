"use client";

import { useState } from "react";
import { ChatView } from "@/components/group/chat-view";
import { ExpensesView } from "@/components/group/expenses-view";
import { BalancesView, type SettlementItem } from "@/components/group/balances-view";
import { MembersView } from "@/components/group/members-view";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users } from "lucide-react";
import { GroupSettingsDialog } from "@/components/group/group-settings-dialog";
import { GroupHeader } from "@/components/group/group-header";
import { GroupTabStrip, type GroupTab } from "@/components/group/group-tab-strip";
import type { MemberBalance, SuggestedSettlement } from "@/lib/balances";

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
}

interface GroupMemberItem {
  id: string;
  username: string;
  role: string;
  joinedAt: Date;
}

interface MessageItem {
  id: string;
  body: string;
  type: string;
  createdAt: Date;
  authorId: string | null;
  authorUsername: string | null;
}

interface ExpenseItem {
  id: string;
  description: string;
  amount: string | number;
  paidByUserId: string;
  expenseDate: Date;
  createdBy: string;
  createdAt: Date;
  payerUsername: string;
  splits: {
    id: string;
    expenseId: string;
    userId: string;
    owedAmount: string | number;
    username: string | null;
  }[];
}

interface InviteItem {
  id: string;
  token: string;
  createdAt: Date;
  useCount: number;
  maxUses: number | null;
  expiresAt: Date | null;
  requiresApproval: boolean;
}

interface PendingJoinRequestItem {
  id: string;
  userId: string;
  username: string;
  createdAt: Date;
}

interface DirectInviteItem {
  id: string;
  token: string;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
  inviteeUsername: string;
  inviterUsername: string;
}

interface GroupTabsProps {
  group: GroupInfo;
  groupId: string;
  currentUserId: string;
  currentUsername: string;
  currentUserRole: string;
  members: GroupMemberItem[];
  messages: MessageItem[];
  expenses: ExpenseItem[];
  settlements: SettlementItem[];
  balances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
  activeInvites: InviteItem[];
  pendingJoinRequests?: PendingJoinRequestItem[];
  directInvites?: DirectInviteItem[];
}

export function GroupTabs({
  group,
  groupId,
  currentUserId,
  currentUsername,
  currentUserRole,
  members,
  messages,
  expenses,
  settlements,
  balances,
  suggestedSettlements,
  activeInvites,
  pendingJoinRequests = [],
  directInvites = [],
}: GroupTabsProps) {
  const [activeTab, setActiveTab] = useState<GroupTab>("chat");
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const myBalance = balances.find((b) => b.userId === currentUserId)?.netBalance || 0;

  const pendingSettlementConfirmations = settlements.filter((s) => {
    if (s.status !== "pending") return false;
    const counterpartyUserId =
      s.createdByUserId === s.paidByUserId ? s.receivedByUserId : s.paidByUserId;
    return counterpartyUserId === currentUserId;
  });

  const handleTabChange = (val: GroupTab) => {
    setActiveTab(val);
    if (val === "chat") {
      setChatUnreadCount(0);
    }
  };

  return (
    <div className="space-y-2">
      {/* Group Settings Modal */}
      <GroupSettingsDialog
        isOpen={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
        groupId={groupId}
        groupName={group.name}
        groupDescription={group.description}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        members={members}
        userNetBalance={myBalance}
      />

      {/* Members & Invites Modal */}
      <Dialog open={isMembersModalOpen} onOpenChange={setIsMembersModalOpen}>
        <DialogContent className="border-border/80 bg-background max-h-[85vh] gap-0 overflow-y-auto rounded-2xl p-0 shadow-xl sm:max-w-xl md:max-w-fit">
          <DialogHeader className="border-border/70 bg-background/95 sticky top-0 z-10 border-b p-2 backdrop-blur-sm md:p-5 md:pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Group Members & Invites</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1 text-xs">
              Active members and invite links for{" "}
              <strong className="text-foreground">{group.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="w-full p-5">
            <MembersView
              groupId={groupId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              members={members}
              invites={activeInvites}
              pendingJoinRequests={pendingJoinRequests}
              directInvites={directInvites}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Room Header with Clickable Members Trigger */}
      <GroupHeader
        group={group}
        currentUserRole={currentUserRole}
        membersCount={members.length}
        pendingJoinRequestsCount={pendingJoinRequests.length}
        onMembersClick={() => setIsMembersModalOpen(true)}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
      />

      {/* Interactive Tabs Strip (Chat, Expenses, Balances) */}
      <GroupTabStrip
        activeTab={activeTab}
        onTabChange={handleTabChange}
        expenseCount={expenses.length}
        chatUnreadCount={chatUnreadCount}
        pendingSettlementCount={pendingSettlementConfirmations.length}
      />

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id="tabpanel-chat"
        aria-labelledby="tab-chat"
        className={activeTab === "chat" ? "block" : "hidden"}
      >
        <ChatView
          groupId={groupId}
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          members={members}
          initialMessages={messages}
          onUnreadChange={setChatUnreadCount}
        />
      </div>

      <div
        role="tabpanel"
        id="tabpanel-expenses"
        aria-labelledby="tab-expenses"
        className={activeTab === "expenses" ? "block" : "hidden"}
      >
        <ExpensesView
          groupId={groupId}
          groupName={group.name}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          members={members}
          expenses={expenses}
        />
      </div>

      <div
        role="tabpanel"
        id="tabpanel-balances"
        aria-labelledby="tab-balances"
        className={activeTab === "balances" ? "block" : "hidden"}
      >
        <BalancesView
          groupId={groupId}
          currentUserId={currentUserId}
          members={members}
          balances={balances}
          suggestedSettlements={suggestedSettlements}
          settlements={settlements}
        />
      </div>
    </div>
  );
}
