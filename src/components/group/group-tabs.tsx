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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Receipt, ArrowLeftRight, Users, Settings } from "lucide-react";
import { GroupSettingsDialog } from "@/components/group/group-settings-dialog";
import { cn } from "cn";
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
}: GroupTabsProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "expenses" | "balances">("chat");
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

  const handleTabChange = (val: "chat" | "expenses" | "balances") => {
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
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Room Header with Clickable Members Trigger */}
      <div className="border-border/80 flex flex-col gap-4 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-xl font-black text-white shadow-sm">
            {group.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
                {group.name}
              </h1>
              <Badge
                variant={currentUserRole === "admin" ? "default" : "secondary"}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                  currentUserRole === "admin"
                    ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {currentUserRole}
              </Badge>
            </div>

            {group.description && (
              <p className="text-muted-foreground mt-1 max-w-xl text-xs leading-relaxed sm:text-sm">
                {group.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMembersModalOpen(true)}
            className="border-border/80 hover:bg-muted/80 relative h-9 cursor-pointer gap-2 rounded-xl px-3.5 text-xs font-bold shadow-2xs"
          >
            <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              {members.length} {members.length === 1 ? "Member" : "Members"}
            </span>
            {currentUserRole === "admin" && pendingJoinRequests.length > 0 && (
              <span
                className="relative ml-0.5 flex h-2.5 w-2.5"
                title={`${pendingJoinRequests.length} join request(s) awaiting your approval`}
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="ring-background relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-2" />
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsModalOpen(true)}
            className="border-border/80 hover:bg-muted/80 h-9 cursor-pointer gap-2 rounded-xl px-3 text-xs font-bold shadow-2xs"
            title="Group Settings"
          >
            <Settings className="text-muted-foreground h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Interactive Tabs Strip (Chat, Expenses, Balances) */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Group tabs"
          className="bg-muted/50 border-border/80 flex h-12 min-w-max items-center justify-start gap-1 rounded-2xl border p-1.5 shadow-2xs sm:w-full sm:gap-1.5"
        >
          {/* Chat Tab */}
          <button
            type="button"
            role="tab"
            id="tab-chat"
            aria-controls="tabpanel-chat"
            aria-selected={activeTab === "chat"}
            onClick={() => handleTabChange("chat")}
            className={cn(
              "relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all select-none sm:gap-2 sm:px-4",
              activeTab === "chat"
                ? "bg-card text-foreground border-border/60 border shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
            <span className="hidden sm:inline">& Activity</span>
            {chatUnreadCount > 0 && activeTab !== "chat" && (
              <span className="relative ml-0.5 flex h-2 w-2" title={`${chatUnreadCount} unread`}>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </button>

          {/* Expenses Tab */}
          <button
            type="button"
            role="tab"
            id="tab-expenses"
            aria-controls="tabpanel-expenses"
            aria-selected={activeTab === "expenses"}
            onClick={() => handleTabChange("expenses")}
            className={cn(
              "relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all select-none sm:gap-2 sm:px-4",
              activeTab === "expenses"
                ? "bg-card text-foreground border-border/60 border shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Expenses</span>
            <span className="bg-muted-foreground/15 py-0.2 rounded-full px-1.5 text-[10px] font-bold">
              {expenses.length}
            </span>
          </button>

          {/* Balances Tab */}
          <button
            type="button"
            role="tab"
            id="tab-balances"
            aria-controls="tabpanel-balances"
            aria-selected={activeTab === "balances"}
            onClick={() => handleTabChange("balances")}
            className={cn(
              "relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all select-none sm:gap-2 sm:px-4",
              activeTab === "balances"
                ? "bg-card text-foreground border-border/60 border shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Balances</span>
            {pendingSettlementConfirmations.length > 0 && activeTab !== "balances" && (
              <span
                className="relative ml-0.5 flex h-2 w-2"
                title={`${pendingSettlementConfirmations.length} settlement(s) awaiting your affirmation`}
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
          </button>
        </div>
      </div>

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
