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
  const [activeTab, setActiveTab] = useState<"chat" | "expenses" | "balances">(
    "chat",
  );
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const myBalance = balances.find((b) => b.userId === currentUserId)?.netBalance || 0;

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
        <DialogContent className="sm:max-w-xl md:max-w-fit max-h-[85vh] overflow-y-auto p-0 gap-0 border-border/80 bg-background shadow-xl rounded-2xl">
          <DialogHeader className="p-2 md:p-5 md:pb-4 border-b border-border/70 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Group Members & Invites</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Active members and invite links for{" "}
              <strong className="text-foreground">{group.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 w-full">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/80">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-white font-black text-xl shadow-sm">
            {group.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {group.name}
              </h1>
              <Badge
                variant={currentUserRole === "admin" ? "default" : "secondary"}
                className={`text-[10px] uppercase font-bold tracking-wider rounded-full px-2.5 py-0.5 ${
                  currentUserRole === "admin"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {currentUserRole}
              </Badge>
            </div>

            {group.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
                {group.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMembersModalOpen(true)}
            className="gap-2 text-xs font-bold rounded-xl h-9 px-3.5 border-border/80 shadow-2xs hover:bg-muted/80 cursor-pointer"
          >
            <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              {members.length} {members.length === 1 ? "Member" : "Members"}
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsModalOpen(true)}
            className="gap-2 text-xs font-bold rounded-xl h-9 px-3 border-border/80 shadow-2xs hover:bg-muted/80 cursor-pointer"
            title="Group Settings"
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Interactive Tabs Strip (Chat, Expenses, Balances) */}
      <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Group tabs"
          className="h-12 min-w-max sm:w-full flex items-center justify-start rounded-2xl bg-muted/50 p-1.5 gap-1 sm:gap-1.5 border border-border/80 shadow-2xs"
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
              "relative h-9 rounded-xl px-3 sm:px-4 font-bold text-xs transition-all gap-1.5 sm:gap-2 shrink-0 flex items-center cursor-pointer select-none",
              activeTab === "chat"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
            <span className="hidden sm:inline">& Activity</span>
            {chatUnreadCount > 0 && activeTab !== "chat" && (
              <span
                className="relative flex h-2 w-2 ml-0.5"
                title={`${chatUnreadCount} unread`}
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
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
              "relative h-9 rounded-xl px-3 sm:px-4 font-bold text-xs transition-all gap-1.5 sm:gap-2 shrink-0 flex items-center cursor-pointer select-none",
              activeTab === "expenses"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40",
            )}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Expenses</span>
            <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-bold">
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
              "relative h-9 rounded-xl px-3 sm:px-4 font-bold text-xs transition-all gap-1.5 sm:gap-2 shrink-0 flex items-center cursor-pointer select-none",
              activeTab === "balances"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40",
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Balances</span>
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
