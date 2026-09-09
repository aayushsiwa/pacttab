"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatView } from "@/components/group/chat-view";
import { ExpensesView } from "@/components/group/expenses-view";
import { BalancesView } from "@/components/group/balances-view";
import { MembersView } from "@/components/group/members-view";
import { MessageSquare, Receipt, ArrowLeftRight, Users } from "lucide-react";
import type { MemberBalance, SuggestedSettlement } from "@/lib/balances";

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

interface SettlementItem {
  id: string;
  amount: string | number;
  paidByUserId: string;
  receivedByUserId: string;
  settledAt: Date;
  createdAt: Date;
  payerUsername: string;
  recipientUsername: string;
}

interface InviteItem {
  id: string;
  token: string;
  createdAt: Date;
  useCount: number;
  maxUses: number | null;
}

interface GroupTabsProps {
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
}

export function GroupTabs({
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
}: GroupTabsProps) {
  const [activeTab, setActiveTab] = useState("chat");
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (val === "chat") {
      setChatUnreadCount(0);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
      <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabsList className="h-12 min-w-max sm:w-full justify-start rounded-2xl bg-muted/50 p-1.5 gap-1 sm:gap-1.5 border border-border/80 shadow-2xs">
          <TabsTrigger
            value="chat"
            className="relative h-9 rounded-xl px-3 sm:px-4 font-bold text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 sm:gap-2 shrink-0"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
            <span className="hidden sm:inline">& Activity</span>
            {chatUnreadCount > 0 && (
              <span className="relative flex h-2 w-2 ml-0.5" title={`${chatUnreadCount} unread`}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="expenses"
            className="h-9 rounded-xl px-3 sm:px-4 font-bold text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 sm:gap-2 shrink-0"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Expenses</span>
            <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-bold">
              {expenses.length}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="balances"
            className="h-9 rounded-xl px-3 sm:px-4 font-bold text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 sm:gap-2 shrink-0"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Balances</span>
          </TabsTrigger>

          <TabsTrigger
            value="members"
            className="h-9 rounded-xl px-3 sm:px-4 font-bold text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all gap-1.5 sm:gap-2 shrink-0"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Members</span>
            <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-bold">
              {members.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="chat" className="mt-0 outline-none">
        <ChatView
          groupId={groupId}
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          members={members}
          initialMessages={messages}
          onUnreadChange={setChatUnreadCount}
        />
      </TabsContent>

      <TabsContent value="expenses" className="mt-0 outline-none">
        <ExpensesView
          groupId={groupId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          members={members}
          expenses={expenses}
        />
      </TabsContent>

      <TabsContent value="balances" className="mt-0 outline-none">
        <BalancesView
          groupId={groupId}
          currentUserId={currentUserId}
          members={members}
          balances={balances}
          suggestedSettlements={suggestedSettlements}
          settlements={settlements}
        />
      </TabsContent>

      <TabsContent value="members" className="mt-0 outline-none">
        <MembersView
          groupId={groupId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          members={members}
          invites={activeInvites}
        />
      </TabsContent>
    </Tabs>
  );
}
