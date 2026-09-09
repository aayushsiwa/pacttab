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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
      <div className="border-b">
        <TabsList className="h-11 w-full justify-start rounded-none bg-transparent p-0 gap-6">
          <TabsTrigger
            value="chat"
            className="relative h-11 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2 text-sm"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Chat & Activity</span>
          </TabsTrigger>

          <TabsTrigger
            value="expenses"
            className="relative h-11 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2 text-sm"
          >
            <Receipt className="h-4 w-4" />
            <span>Expenses ({expenses.length})</span>
          </TabsTrigger>

          <TabsTrigger
            value="balances"
            className="relative h-11 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2 text-sm"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Balances</span>
          </TabsTrigger>

          <TabsTrigger
            value="members"
            className="relative h-11 rounded-none border-b-2 border-b-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none focus-visible:ring-0 data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none gap-2 text-sm"
          >
            <Users className="h-4 w-4" />
            <span>Members ({members.length})</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="chat" className="mt-0 outline-none">
        <ChatView
          groupId={groupId}
          currentUserId={currentUserId}
          initialMessages={messages}
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
