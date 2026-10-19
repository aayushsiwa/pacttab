import { describe, it, expect } from "vitest";
import {
  calculateBalancesAndSettlements,
  calculateEqualSplits,
  calculateShareSplits,
} from "../src/lib/balances";

const members = [
  { id: "u0", username: "alice" },
  { id: "u1", username: "bob" },
  { id: "u2", username: "carol" },
  { id: "u3", username: "dave" },
];

function centsOf(value: number): number {
  return Math.round(value * 100);
}

/**
 * Applies the suggested settlements to the balances and returns the residual
 * net (in cents) of every member. A fully settling plan leaves all zeroes.
 */
function residualAfterSettlements(
  balances: { userId: string; netBalance: number }[],
  suggestedSettlements: { fromUserId: string; toUserId: string; amount: number }[]
): number[] {
  const net = new Map(balances.map((b) => [b.userId, centsOf(b.netBalance)]));
  for (const s of suggestedSettlements) {
    net.set(s.fromUserId, (net.get(s.fromUserId) ?? 0) + centsOf(s.amount));
    net.set(s.toUserId, (net.get(s.toUserId) ?? 0) - centsOf(s.amount));
  }
  return [...net.values()];
}

describe("calculateBalancesAndSettlements (integer cents)", () => {
  it("regression: sub-cent amounts no longer orphan a paise via per-member rounding", () => {
    // Raw amounts with sub-cent precision are compared against cent-rounded
    // splits. Independently rounding each member's net used to leave Σ netBalance
    // at -₹0.01 and strand a paise in the suggestions.
    const expenses = [
      {
        id: "e0",
        amount: 45.997,
        paidByUserId: "u0",
        splits: [
          { userId: "u0", owedAmount: 23 },
          { userId: "u1", owedAmount: 23 },
        ],
      },
      {
        id: "e1",
        amount: 47.234,
        paidByUserId: "u2",
        splits: [
          { userId: "u0", owedAmount: 15.75 },
          { userId: "u1", owedAmount: 15.74 },
          { userId: "u3", owedAmount: 15.74 },
        ],
      },
      {
        id: "e2",
        amount: 78.875,
        paidByUserId: "u1",
        splits: [
          { userId: "u0", owedAmount: 39.44 },
          { userId: "u3", owedAmount: 39.44 },
        ],
      },
      {
        id: "e3",
        amount: 41.823,
        paidByUserId: "u3",
        splits: [
          { userId: "u0", owedAmount: 20.91 },
          { userId: "u1", owedAmount: 20.91 },
        ],
      },
    ];

    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      members,
      expenses,
      []
    );

    const netCents = balances.map((b) => centsOf(b.netBalance));
    expect(netCents.reduce((a, c) => a + c, 0)).toBe(0);

    const debtorCents = netCents.filter((c) => c < 0).reduce((a, c) => a - c, 0);
    const suggestedCents = suggestedSettlements.reduce((a, s) => a + centsOf(s.amount), 0);
    expect(suggestedCents).toBe(debtorCents);
    expect(residualAfterSettlements(balances, suggestedSettlements).every((c) => c === 0)).toBe(
      true
    );
  });

  it("suggested settlements fully settle the group with no leftover cent", () => {
    const expenses = [
      {
        id: "e0",
        amount: "100.00",
        paidByUserId: "u0",
        splits: calculateEqualSplits(100, ["u0", "u1", "u2"]),
      },
      {
        id: "e1",
        amount: "10.00",
        paidByUserId: "u1",
        splits: calculateEqualSplits(10, ["u0", "u2", "u3"]),
      },
      {
        id: "e2",
        amount: "33.01",
        paidByUserId: "u2",
        splits: calculateEqualSplits(33.01, ["u1", "u3"]),
      },
    ];

    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      members,
      expenses,
      []
    );

    const netCents = balances.map((b) => centsOf(b.netBalance));
    expect(netCents.reduce((a, c) => a + c, 0)).toBe(0);

    const debtorCents = netCents.filter((c) => c < 0).reduce((a, c) => a - c, 0);
    const creditorCents = netCents.filter((c) => c > 0).reduce((a, c) => a + c, 0);
    const suggestedCents = suggestedSettlements.reduce((a, s) => a + centsOf(s.amount), 0);
    expect(debtorCents).toBe(creditorCents);
    expect(suggestedCents).toBe(debtorCents);
    expect(residualAfterSettlements(balances, suggestedSettlements).every((c) => c === 0)).toBe(
      true
    );
  });

  it("stays exactly zero-sum and fully settles across randomized fixtures", () => {
    // Deterministic LCG so failures are reproducible.
    let seed = 0x5eed;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };

    for (let round = 0; round < 200; round++) {
      const expenses: {
        id: string;
        amount: number;
        paidByUserId: string;
        splits: { userId: string; owedAmount: number }[];
      }[] = [];

      const expenseCount = 1 + Math.floor(rand() * 40);
      for (let i = 0; i < expenseCount; i++) {
        const amount = Math.round(rand() * 500000 + 1) / 100;
        const payer = members[Math.floor(rand() * members.length)].id;
        const participants = members.filter(() => rand() > 0.2).map((m) => m.id);
        if (participants.length === 0) continue;

        const splits =
          rand() < 0.5
            ? calculateEqualSplits(amount, participants)
            : calculateShareSplits(
                amount,
                participants.map((id) => ({ userId: id, shares: 1 + Math.floor(rand() * 9) }))
              );

        expenses.push({ id: `e${i}`, amount, paidByUserId: payer, splits });
      }

      const settlements: {
        id: string;
        amount: number;
        paidByUserId: string;
        receivedByUserId: string;
        status: string;
      }[] = [];
      const settlementCount = Math.floor(rand() * 6);
      for (let i = 0; i < settlementCount; i++) {
        const from = members[Math.floor(rand() * members.length)].id;
        const to = members[Math.floor(rand() * members.length)].id;
        if (from === to) continue;
        settlements.push({
          id: `s${i}`,
          amount: Math.round(rand() * 200000) / 100,
          paidByUserId: from,
          receivedByUserId: to,
          status: rand() < 0.7 ? "confirmed" : "pending",
        });
      }

      const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
        members,
        expenses,
        settlements
      );

      const netCents = balances.map((b) => centsOf(b.netBalance));
      expect(netCents.reduce((a, c) => a + c, 0)).toBe(0);

      const debtorCents = netCents.filter((c) => c < 0).reduce((a, c) => a - c, 0);
      const suggestedCents = suggestedSettlements.reduce((a, s) => a + centsOf(s.amount), 0);
      expect(suggestedCents).toBe(debtorCents);
      expect(residualAfterSettlements(balances, suggestedSettlements).every((c) => c === 0)).toBe(
        true
      );

      // Every emitted amount is a whole number of paise and strictly positive.
      for (const s of suggestedSettlements) {
        expect(Number.isInteger(centsOf(s.amount))).toBe(true);
        expect(centsOf(s.amount)).toBeGreaterThan(0);
      }
    }
  });
});
