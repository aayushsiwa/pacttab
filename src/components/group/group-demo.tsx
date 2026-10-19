"use client";

import { useEffect, useMemo, useState } from "react";
import { GroupHeader } from "@/components/group/group-header";
import { GroupTabStrip, type GroupTab } from "@/components/group/group-tab-strip";
import { ChatView } from "@/components/group/chat-view";
import { ExpensesView, type ExpenseItem } from "@/components/group/expenses-view";
import { BalancesView, type SettlementItem } from "@/components/group/balances-view";
import { DemoModeProvider, type DemoActions } from "@/providers/demo-mode";
import type { CreateExpenseInput } from "@/hooks/mutations/use-expenses";
import type { ChatMessage } from "@/hooks/use-group-socket";
import {
  calculateBalancesAndSettlements,
  calculateEqualSplits,
  calculateExactSplits,
  calculatePercentageSplits,
  calculateShareSplits,
} from "@/lib/balances";

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

const memberById = (id: string) => demoMembers.find((m) => m.id === id);

function equalSplitExpense(
  id: string,
  description: string,
  amount: number,
  paidByUserId: string,
  createdAt: Date
): ExpenseItem {
  return {
    id,
    description,
    amount,
    paidByUserId,
    payerUsername: memberById(paidByUserId)?.username ?? "",
    expenseDate: createdAt,
    createdBy: paidByUserId,
    createdAt,
    splits: calculateEqualSplits(
      amount,
      demoMembers.map((m) => m.id)
    ).map((split, i) => ({
      id: `${id}-s${i}`,
      userId: split.userId,
      owedAmount: split.owedAmount,
      username: memberById(split.userId)?.username ?? null,
    })),
  };
}

function toDemoSplits(
  expenseId: string,
  splits: { userId: string; owedAmount: number }[]
): ExpenseItem["splits"] {
  return splits.map((split, i) => ({
    id: `${expenseId}-s${i}`,
    userId: split.userId,
    owedAmount: split.owedAmount,
    username: memberById(split.userId)?.username ?? null,
  }));
}

function computeSplits(input: {
  amount: number;
  participantUserIds: string[];
  splitType: CreateExpenseInput["splitType"];
  customSplits?: string | null;
}): { userId: string; owedAmount: number }[] {
  try {
    const custom = input.customSplits
      ? (JSON.parse(input.customSplits) as { userId: string }[])
      : null;
    if (custom) {
      if (input.splitType === "exact") {
        return calculateExactSplits(input.amount, custom as { userId: string; amount: number }[]);
      }
      if (input.splitType === "percentage") {
        return calculatePercentageSplits(
          input.amount,
          custom as { userId: string; percentage: number }[]
        );
      }
      if (input.splitType === "shares") {
        return calculateShareSplits(input.amount, custom as { userId: string; shares: number }[]);
      }
    }
  } catch {
    // Fall through to equal split
  }
  return calculateEqualSplits(input.amount, input.participantUserIds);
}

/* --- Autoplay script content --- */
// Fixed absolute timestamps for SSR'd content: server and client must serialize the
// same dates, or React reports a hydration mismatch.
const START_MESSAGES: ChatMessage[] = [
  {
    id: "m-1",
    type: "system",
    body: "🌴 Group created by @maya — welcome to Goa Road Trip 2026",
    createdAt: new Date("2026-10-17T21:00:00.000Z"),
    authorId: null,
    authorUsername: null,
  },
  {
    id: "m-2",
    type: "user",
    body: "Hostel is booked! Split added to Expenses 🏨",
    createdAt: new Date("2026-10-17T23:30:00.000Z"),
    authorId: "u-maya",
    authorUsername: "maya",
  },
];

const START_EXPENSES: ExpenseItem[] = [
  equalSplitExpense(
    "e-scooters",
    "Scooter Rentals",
    900,
    "u-rohit",
    new Date("2026-10-18T02:00:00.000Z")
  ),
  equalSplitExpense(
    "e-shack",
    "Beach Shack Seafood",
    1800,
    "u-maya",
    new Date("2026-10-18T00:00:00.000Z")
  ),
  equalSplitExpense(
    "e-hostel",
    "Hostel Check-in",
    2150,
    "u-maya",
    new Date("2026-10-17T23:00:00.000Z")
  ),
];

const incomingSettlement: SettlementItem = {
  id: "s-1",
  amount: 600,
  paidByUserId: "u-arjun",
  receivedByUserId: "u-maya",
  status: "pending",
  createdByUserId: "u-arjun",
  confirmedAt: null,
  rejectedAt: null,
  settledAt: new Date("2026-10-17T20:00:00.000Z"),
  payerUsername: "arjun",
  recipientUsername: "maya",
  creatorUsername: "arjun",
};

const scriptMessages = {
  rohit: {
    id: "m-rohit",
    type: "user",
    body: "Scooters are ready for tomorrow 🛵 Heading to the beach now",
    authorId: "u-rohit",
    authorUsername: "rohit",
  },
  arjun: {
    id: "m-arjun",
    type: "user",
    body: "Paid ₹600 via UPI @maya! Let's head to dinner 🍕",
    authorId: "u-arjun",
    authorUsername: "arjun",
  },
  wrap: {
    id: "m-wrap",
    type: "system",
    body: "✅ Trip wrapped — all balances settled!",
    authorId: null,
    authorUsername: null,
  },
} satisfies Record<string, Omit<ChatMessage, "createdAt">>;

export function GroupDemo() {
  const [activeTab, setActiveTab] = useState<GroupTab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>(START_MESSAGES);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(START_EXPENSES);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const demoActions = useMemo<DemoActions>(
    () => ({
      sendMessage: (data) => {
        setPaused(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: "user",
            body: data.body,
            createdAt: new Date(),
            authorId: currentUserId,
            authorUsername: currentUsername,
          },
        ]);
      },
      createExpense: (input) => {
        setPaused(true);
        const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setExpenses((prev) => [
          {
            id,
            description: input.description,
            amount: input.amount,
            paidByUserId: input.paidByUserId,
            payerUsername: memberById(input.paidByUserId)?.username ?? "member",
            expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
            createdBy: input.paidByUserId,
            createdAt: new Date(),
            splits: toDemoSplits(id, computeSplits(input)),
          },
          ...prev,
        ]);
      },
      updateExpense: (input) =>
        setExpenses((prev) =>
          prev.map((e) =>
            e.id === input.expenseId
              ? {
                  ...e,
                  description: input.description,
                  amount: input.amount,
                  paidByUserId: input.paidByUserId,
                  payerUsername: memberById(input.paidByUserId)?.username ?? e.payerUsername,
                  expenseDate: input.expenseDate ? new Date(input.expenseDate) : e.expenseDate,
                  splits: toDemoSplits(e.id, computeSplits(input)),
                }
              : e
          )
        ),
      deleteExpense: (input) => setExpenses((prev) => prev.filter((e) => e.id !== input.expenseId)),
      recordSettlement: (data) =>
        setSettlements((prev) => [
          {
            id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            amount: data.amount,
            paidByUserId: data.paidByUserId,
            receivedByUserId: data.receivedByUserId,
            status: "pending",
            createdByUserId: currentUserId,
            confirmedAt: null,
            rejectedAt: null,
            settledAt: new Date(),
            payerUsername: memberById(data.paidByUserId)?.username ?? "member",
            recipientUsername: memberById(data.receivedByUserId)?.username ?? "member",
            creatorUsername: currentUsername,
          },
          ...prev,
        ]),
      confirmSettlement: (input) =>
        setSettlements((prev) =>
          prev.map((s) =>
            s.id === input.settlementId && s.status === "pending"
              ? { ...s, status: "confirmed", confirmedAt: new Date(), settledAt: new Date() }
              : s
          )
        ),
      rejectSettlement: (input) =>
        setSettlements((prev) =>
          prev.map((s) =>
            s.id === input.settlementId && s.status === "pending"
              ? { ...s, status: "rejected", rejectedAt: new Date() }
              : s
          )
        ),
      cancelSettlement: (input) =>
        setSettlements((prev) =>
          prev.map((s) =>
            s.id === input.settlementId && s.status === "pending"
              ? { ...s, status: "cancelled", settledAt: new Date() }
              : s
          )
        ),
    }),
    []
  );

  // Autoplay "video" loop — resets at the end of each cycle, pauses on user interaction
  useEffect(() => {
    if (paused) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    at(2500, () =>
      setMessages((prev) => [...prev, { ...scriptMessages.rohit, createdAt: new Date() }])
    );
    at(5500, () => {
      setMessages((prev) => [...prev, { ...scriptMessages.arjun, createdAt: new Date() }]);
      setSettlements((prev) => [incomingSettlement, ...prev]);
    });
    at(10000, () => setActiveTab("expenses"));
    at(13500, () =>
      setExpenses((prev) => [
        equalSplitExpense("e-cab", "Sunset Point Cab", 700, "u-priya", new Date()),
        ...prev,
      ])
    );
    at(18000, () => setActiveTab("balances"));
    at(23000, () =>
      setSettlements((prev) =>
        prev.map((s) =>
          s.id === incomingSettlement.id && s.status === "pending"
            ? { ...s, status: "confirmed", confirmedAt: new Date(), settledAt: new Date() }
            : s
        )
      )
    );
    at(27500, () => setActiveTab("chat"));
    at(30500, () =>
      setMessages((prev) => [...prev, { ...scriptMessages.wrap, createdAt: new Date() }])
    );
    at(34500, () => {
      setMessages(START_MESSAGES);
      setExpenses(START_EXPENSES);
      setSettlements([]);
      setActiveTab("chat");
      setCycle((c) => c + 1);
    });

    return () => timers.forEach(clearTimeout);
  }, [paused, cycle]);

  const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
    demoMembers,
    expenses,
    settlements
  );

  const pendingSettlementCount = settlements.filter((s) => s.status === "pending").length;

  const handleTabChange = (tab: GroupTab) => {
    setPaused(true);
    setActiveTab(tab);
  };

  return (
    <div className="border-border/80 bg-card/80 relative rounded-2xl border p-4 shadow-lg backdrop-blur-sm sm:p-6">
      <DemoModeProvider actions={demoActions}>
        <div className="space-y-2">
          <GroupHeader
            group={demoGroup}
            currentUserRole={currentUserRole}
            membersCount={demoMembers.length}
          />

          <GroupTabStrip
            activeTab={activeTab}
            onTabChange={handleTabChange}
            expenseCount={expenses.length}
            pendingSettlementCount={pendingSettlementCount}
          />

          <div
            role="tabpanel"
            id="tabpanel-chat"
            aria-labelledby="tab-chat"
            className={activeTab === "chat" ? "block" : "hidden"}
          >
            <ChatView
              groupId={demoGroup.id}
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              members={demoMembers}
              initialMessages={messages}
              enableRealtime={false}
            />
          </div>

          <div
            role="tabpanel"
            id="tabpanel-expenses"
            aria-labelledby="tab-expenses"
            className={activeTab === "expenses" ? "block" : "hidden"}
          >
            <ExpensesView
              groupId={demoGroup.id}
              groupName={demoGroup.name}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              members={demoMembers}
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
              groupId={demoGroup.id}
              currentUserId={currentUserId}
              members={demoMembers}
              balances={balances}
              suggestedSettlements={suggestedSettlements}
              settlements={settlements}
            />
          </div>
        </div>
      </DemoModeProvider>
    </div>
  );
}
