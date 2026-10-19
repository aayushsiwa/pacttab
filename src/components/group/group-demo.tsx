"use client";

import { useState } from "react";
import { GroupHeader } from "@/components/group/group-header";
import { GroupTabStrip, type GroupTab } from "@/components/group/group-tab-strip";
import { ChatView } from "@/components/group/chat-view";
import { ExpensesView, type ExpenseItem } from "@/components/group/expenses-view";
import { BalancesView, type SettlementItem } from "@/components/group/balances-view";
import { calculateBalancesAndSettlements, calculateEqualSplits } from "@/lib/balances";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const demoGroup = {
  id: "demo-preview",
  name: "Goa Road Trip 2026",
  description:
    "Beach days, scooter rentals, and seafood — every rupee settled in one private room.",
};

const demoMembers = [
  { id: "u-maya", username: "maya", role: "admin", joinedAt: minutesAgo(60 * 24 * 14) },
  { id: "u-arjun", username: "arjun", role: "member", joinedAt: minutesAgo(60 * 24 * 14) },
  { id: "u-rohit", username: "rohit", role: "member", joinedAt: minutesAgo(60 * 24 * 14) },
  { id: "u-priya", username: "priya", role: "member", joinedAt: minutesAgo(60 * 24 * 6) },
];

const currentUserId = "u-maya";
const currentUsername = "maya";
const currentUserRole = "admin";

function equalSplitExpense(
  id: string,
  description: string,
  amount: number,
  paidByUserId: string,
  minutesSince: number
): ExpenseItem {
  const payer = demoMembers.find((m) => m.id === paidByUserId);
  return {
    id,
    description,
    amount,
    paidByUserId,
    payerUsername: payer?.username ?? "",
    expenseDate: minutesAgo(minutesSince),
    createdBy: paidByUserId,
    createdAt: minutesAgo(minutesSince),
    splits: calculateEqualSplits(
      amount,
      demoMembers.map((m) => m.id)
    ).map((split, i) => ({
      id: `${id}-s${i}`,
      userId: split.userId,
      owedAmount: split.owedAmount,
      username: demoMembers.find((m) => m.id === split.userId)?.username ?? null,
    })),
  };
}

const demoExpenses: ExpenseItem[] = [
  equalSplitExpense("e-hostel", "Hostel Check-in", 2150, "u-maya", 60 * 26),
  equalSplitExpense("e-shack", "Beach Shack Seafood", 1800, "u-maya", 60 * 25),
  equalSplitExpense("e-scooters", "Scooter Rentals", 900, "u-rohit", 60 * 23),
];

const demoSettlements: SettlementItem[] = [
  {
    id: "s-1",
    amount: 600,
    paidByUserId: "u-arjun",
    receivedByUserId: "u-maya",
    status: "pending",
    createdByUserId: "u-arjun",
    confirmedAt: null,
    rejectedAt: null,
    settledAt: minutesAgo(70),
    payerUsername: "arjun",
    recipientUsername: "maya",
    creatorUsername: "arjun",
  },
];

const demoMessages = [
  {
    id: "m-1",
    type: "system",
    body: "🌴 Group created by @maya — welcome to Goa Road Trip 2026",
    createdAt: minutesAgo(60 * 28),
    authorId: null,
    authorUsername: null,
  },
  {
    id: "m-2",
    type: "user",
    body: "Hostel is booked! Split added to Expenses 🏨",
    createdAt: minutesAgo(60 * 26),
    authorId: "u-maya",
    authorUsername: "maya",
  },
  {
    id: "m-3",
    type: "user",
    body: "Scooters are ready for tomorrow 🛵 Heading to the beach now",
    createdAt: minutesAgo(60 * 23),
    authorId: "u-rohit",
    authorUsername: "rohit",
  },
  {
    id: "m-4",
    type: "user",
    body: "Paid ₹600 via UPI @maya! Let's head to dinner 🍕",
    createdAt: minutesAgo(68),
    authorId: "u-arjun",
    authorUsername: "arjun",
  },
];

export function GroupDemo() {
  const [activeTab, setActiveTab] = useState<GroupTab>("chat");

  const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
    demoMembers,
    demoExpenses,
    demoSettlements
  );

  const pendingSettlementCount = demoSettlements.filter((s) => s.status === "pending").length;

  return (
    <div className="border-border/80 bg-card/80 relative rounded-2xl border p-4 shadow-lg backdrop-blur-sm sm:p-6">
      <div className="space-y-2">
        <GroupHeader
          group={demoGroup}
          currentUserRole={currentUserRole}
          membersCount={demoMembers.length}
        />

        <GroupTabStrip
          activeTab={activeTab}
          onTabChange={setActiveTab}
          expenseCount={demoExpenses.length}
          pendingSettlementCount={pendingSettlementCount}
        />

        <div
          role="tabpanel"
          id="tabpanel-chat"
          aria-labelledby="tab-chat"
          inert={activeTab !== "chat"}
          className={activeTab === "chat" ? "block" : "hidden"}
        >
          <ChatView
            groupId={demoGroup.id}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            members={demoMembers}
            initialMessages={demoMessages}
            enableRealtime={false}
          />
        </div>

        <div
          role="tabpanel"
          id="tabpanel-expenses"
          aria-labelledby="tab-expenses"
          inert={activeTab !== "expenses"}
          className={activeTab === "expenses" ? "block" : "hidden"}
        >
          <ExpensesView
            groupId={demoGroup.id}
            groupName={demoGroup.name}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            members={demoMembers}
            expenses={demoExpenses}
          />
        </div>

        <div
          role="tabpanel"
          id="tabpanel-balances"
          aria-labelledby="tab-balances"
          inert={activeTab !== "balances"}
          className={activeTab === "balances" ? "block" : "hidden"}
        >
          <BalancesView
            groupId={demoGroup.id}
            currentUserId={currentUserId}
            members={demoMembers}
            balances={balances}
            suggestedSettlements={suggestedSettlements}
            settlements={demoSettlements}
          />
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-center text-[10px] font-semibold tracking-wide">
        Tabs are interactive — sign up to explore the full app
      </p>
    </div>
  );
}
