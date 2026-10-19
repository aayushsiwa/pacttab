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

describe("MemberBalance expense vs settlement metrics", () => {
  const pair = [
    { id: "alice", username: "alice" },
    { id: "bob", username: "bob" },
  ];

  it("keeps expense totals free of settlement pollution (Alice/Bob example)", () => {
    // Alice pays ₹1000 for lunch, split ₹500 / ₹500. Bob later repays Alice ₹500.
    const expenses = [
      {
        id: "e1",
        amount: 1000,
        paidByUserId: "alice",
        splits: calculateEqualSplits(1000, ["alice", "bob"]),
      },
    ];
    const settlements = [
      {
        id: "s1",
        amount: 500,
        paidByUserId: "bob",
        receivedByUserId: "alice",
        status: "confirmed",
      },
    ];

    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      pair,
      expenses,
      settlements
    );
    const alice = balances.find((b) => b.userId === "alice")!;
    const bob = balances.find((b) => b.userId === "bob")!;

    // Spending and consumption reflect only real expenses.
    expect(alice.totalExpensePaid).toBe(1000);
    expect(alice.totalExpenseShare).toBe(500);
    expect(alice.settlementsReceived).toBe(500);
    expect(alice.settlementsSent).toBe(0);

    expect(bob.totalExpensePaid).toBe(0);
    expect(bob.totalExpenseShare).toBe(500);
    expect(bob.settlementsSent).toBe(500);
    expect(bob.settlementsReceived).toBe(0);

    // Net position is unchanged from the legacy paid - owed accounting.
    expect(alice.netBalance).toBe(0);
    expect(bob.netBalance).toBe(0);
    expect(suggestedSettlements).toHaveLength(0);
  });

  it("holds net = paid + sent − share − received while ignoring non-confirmed settlements", () => {
    const expenses = [
      {
        id: "e1",
        amount: "300.00",
        paidByUserId: "bob",
        splits: calculateEqualSplits(300, ["alice", "bob"]),
      },
    ];
    const settlements = [
      { id: "s1", amount: 50, paidByUserId: "alice", receivedByUserId: "bob", status: "confirmed" },
      { id: "s2", amount: 40, paidByUserId: "bob", receivedByUserId: "alice", status: "pending" },
    ];

    const { balances } = calculateBalancesAndSettlements(pair, expenses, settlements);

    for (const b of balances) {
      const expected =
        centsOf(b.totalExpensePaid) +
        centsOf(b.settlementsSent) -
        (centsOf(b.totalExpenseShare) + centsOf(b.settlementsReceived));
      expect(centsOf(b.netBalance)).toBe(expected);
    }

    // The pending ₹40 must not move any settlement metric.
    const alice = balances.find((b) => b.userId === "alice")!;
    const bob = balances.find((b) => b.userId === "bob")!;
    expect(alice.settlementsSent).toBe(50);
    expect(alice.settlementsReceived).toBe(0);
    expect(bob.settlementsReceived).toBe(50);
    expect(bob.settlementsSent).toBe(0);
  });
});

describe("Settlement simplification (exact-match pre-pass)", () => {
  it.each([
    {
      name: "keeps pure greedy when exact-pair plans are longer",
      debtors: [25, 16, 10, 2],
      creditors: [15, 10, 8, 8, 8, 4],
      expected: 7,
    },
    {
      name: "selects a shorter subset plan for a small group",
      debtors: [50, 30, 11],
      creditors: [25, 21, 20, 13, 12],
      expected: 6,
    },
    {
      name: "selects a shorter subset plan with debtors and creditors reversed",
      debtors: [25, 21, 20, 13, 12],
      creditors: [50, 30, 11],
      expected: 6,
    },
    {
      name: "allows subset search at 20 non-zero balances, ignoring zero balances",
      debtors: [50, 30, 11, ...Array<number>(6).fill(1000)],
      creditors: [25, 21, 20, 13, 12, ...Array<number>(6).fill(1000)],
      expected: 12,
    },
    {
      name: "falls back to greedy plans above 20 non-zero balances",
      debtors: [50, 30, 11, ...Array<number>(5).fill(1000), 2000],
      creditors: [25, 21, 20, 13, 12, ...Array<number>(5).fill(1000), 1000, 1000],
      expected: 14,
    },
    {
      name: "keeps pure greedy available above the subset search limit",
      debtors: [25, 16, 10, 2, ...Array<number>(6).fill(1000)],
      creditors: [15, 10, 8, 8, 8, 4, ...Array<number>(6).fill(1000)],
      expected: 13,
    },
  ])("$name", ({ debtors, creditors, expected }) => {
    // The bank has zero net balance; these confirmed transfers produce the
    // specified integer-cent balances without depending on expense splitting.
    const netCents = [...debtors.map((amount) => -amount), ...creditors];
    const groupMembers = netCents.map((_, i) => ({ id: `m${i}`, username: `m${i}` }));
    const settlements = netCents.map((amount, i) => ({
      id: `s${i}`,
      amount: Math.abs(amount) / 100,
      paidByUserId: amount > 0 ? `m${i}` : "bank",
      receivedByUserId: amount > 0 ? "bank" : `m${i}`,
      status: "confirmed",
    }));
    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      [...groupMembers, { id: "bank", username: "bank" }],
      [],
      settlements
    );

    expect(suggestedSettlements).toHaveLength(expected);
    expect(residualAfterSettlements(balances, suggestedSettlements).every((c) => c === 0)).toBe(
      true
    );
  });

  const members = [
    { id: "d1", username: "D1" },
    { id: "d2", username: "D2" },
    { id: "d3", username: "D3" },
    { id: "c1", username: "C1" },
    { id: "c2", username: "C2" },
  ];

  it("extracts exact-matching pairs before greedy (issue example)", () => {
    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      members,
      [
        { id: "e1", amount: 50, paidByUserId: "c2", splits: [{ userId: "d1", owedAmount: 50 }] },
        { id: "e2", amount: 40, paidByUserId: "c1", splits: [{ userId: "d2", owedAmount: 40 }] },
        { id: "e3", amount: 30, paidByUserId: "c1", splits: [{ userId: "d3", owedAmount: 30 }] },
      ],
      []
    );

    expect(suggestedSettlements).toHaveLength(3);
    expect(suggestedSettlements[0]).toEqual({
      fromUserId: "d1",
      fromUsername: "D1",
      toUserId: "c2",
      toUsername: "C2",
      amount: 50,
    });

    const netCents = balances.map((b) => Math.round(b.netBalance * 100));
    expect(netCents.reduce((a, c) => a + c, 0)).toBe(0);
  });

  it("produces identical result when no exact pairs exist (fallback to greedy)", () => {
    const { balances: b1, suggestedSettlements: s1 } = calculateBalancesAndSettlements(
      members,
      [
        {
          id: "e1",
          amount: 120,
          paidByUserId: "c1",
          splits: [
            { userId: "d1", owedAmount: 50 },
            { userId: "d2", owedAmount: 40 },
            { userId: "d3", owedAmount: 30 },
          ],
        },
        { id: "e4", amount: 50, paidByUserId: "c2", splits: [{ userId: "d1", owedAmount: 50 }] },
      ],
      []
    );
    const { balances: b2, suggestedSettlements: s2 } = calculateBalancesAndSettlements(
      members,
      [
        {
          id: "e1",
          amount: 120,
          paidByUserId: "c1",
          splits: [
            { userId: "d1", owedAmount: 50 },
            { userId: "d2", owedAmount: 40 },
            { userId: "d3", owedAmount: 30 },
          ],
        },
        { id: "e4", amount: 50, paidByUserId: "c2", splits: [{ userId: "d1", owedAmount: 50 }] },
      ],
      []
    );
    expect(s1.length).toBe(s2.length);
    expect(s1).toEqual(s2);
    expect(b1.map((x) => Math.round(x.netBalance * 100))).toEqual(
      b2.map((x) => Math.round(x.netBalance * 100))
    );
  });

  it("handles multiple identical pairs independently", () => {
    const members2 = [
      { id: "a1", username: "A1" },
      { id: "a2", username: "A2" },
      { id: "p1", username: "P1" },
      { id: "p2", username: "P2" },
    ];
    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      members2,
      [
        { id: "e1", amount: 10, paidByUserId: "p1", splits: [{ userId: "a1", owedAmount: 10 }] },
        { id: "e2", amount: 10, paidByUserId: "p2", splits: [{ userId: "a2", owedAmount: 10 }] },
      ],
      []
    );
    expect(suggestedSettlements).toHaveLength(2);
    const cents = balances.map((b) => Math.round(b.netBalance * 100));
    expect(cents.reduce((a, c) => a + c, 0)).toBe(0);
  });

  it("settles a debtor whose balance equals a subset of creditors (1↔many)", () => {
    // D1 owes 150 = C1's 100 + C2's 50, so D1 can cover both in one block.
    const { suggestedSettlements } = calculateBalancesAndSettlements(
      members,
      [
        { id: "e1", amount: 100, paidByUserId: "c1", splits: [{ userId: "d1", owedAmount: 100 }] },
        { id: "e2", amount: 50, paidByUserId: "c2", splits: [{ userId: "d1", owedAmount: 50 }] },
      ],
      []
    );
    expect(suggestedSettlements).toHaveLength(2);
    expect(suggestedSettlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromUserId: "d1", toUserId: "c1", amount: 100 }),
        expect.objectContaining({ fromUserId: "d1", toUserId: "c2", amount: 50 }),
      ])
    );
  });

  it("beats pure greedy when a creditor is covered by a subset of debtors", () => {
    // Balances: debtors 1,1,2,3; creditors 3,4. Greedy fragments into 5
    // transfers; the subset pass covers creditor 4 as 3+1 and creditor 3 as 3.
    const sixMembers = [
      { id: "d1", username: "D1" },
      { id: "d2", username: "D2" },
      { id: "d3", username: "D3" },
      { id: "d4", username: "D4" },
      { id: "c1", username: "C1" },
      { id: "c2", username: "C2" },
    ];
    const expenses = [
      // C1 paid 3 -> D4 owes C1 3
      { id: "e1", amount: 3, paidByUserId: "c1", splits: [{ userId: "d4", owedAmount: 3 }] },
      // C2 paid 4 -> D1 1, D2 1, D3 2
      {
        id: "e2",
        amount: 4,
        paidByUserId: "c2",
        splits: [
          { userId: "d1", owedAmount: 1 },
          { userId: "d2", owedAmount: 1 },
          { userId: "d3", owedAmount: 2 },
        ],
      },
    ];

    const { balances, suggestedSettlements } = calculateBalancesAndSettlements(
      sixMembers,
      expenses,
      []
    );

    expect(suggestedSettlements).toHaveLength(4);
    // C1's exact ₹3 pair with D4 is still taken.
    expect(suggestedSettlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromUserId: "d4", toUserId: "c1", amount: 3 }),
      ])
    );
    // And C2's ₹4 is covered by D3 (2), D1 (1) and D2 (1) as one block.
    expect(suggestedSettlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromUserId: "d3", toUserId: "c2", amount: 2 }),
        expect.objectContaining({ fromUserId: "d1", toUserId: "c2", amount: 1 }),
        expect.objectContaining({ fromUserId: "d2", toUserId: "c2", amount: 1 }),
      ])
    );
    expect(balances.map((b) => Math.round(b.netBalance * 100)).reduce((a, c) => a + c, 0)).toBe(0);
  });

  it("never produces more transactions than pure greedy (fuzz)", () => {
    const fuzzMembers = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, username: `m${i}` }));
    let seed = 0xc0ffee;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };

    for (let round = 0; round < 300; round++) {
      // Build arbitrary integer-cent debtor/creditor weights via settlements.
      const settlements: {
        id: string;
        amount: number;
        paidByUserId: string;
        receivedByUserId: string;
        status: string;
      }[] = [];
      const bank = { id: "bank", username: "bank" };
      let id = 0;
      for (const m of fuzzMembers) {
        if (rand() < 0.5) {
          // m is a creditor: bank paid, m received (owed increases => net negative),
          // so instead make bank receive from m to push m positive.
          settlements.push({
            id: `s${id++}`,
            amount: 1 + Math.floor(rand() * 9),
            paidByUserId: m.id,
            receivedByUserId: bank.id,
            status: "confirmed",
          });
        } else {
          settlements.push({
            id: `s${id++}`,
            amount: 1 + Math.floor(rand() * 9),
            paidByUserId: bank.id,
            receivedByUserId: m.id,
            status: "confirmed",
          });
        }
      }

      const result = calculateBalancesAndSettlements([bank, ...fuzzMembers], [], settlements);
      const plan = result.suggestedSettlements.length;

      // Reference pure greedy over the same non-zero balances.
      const debtors = result.balances
        .filter((b) => Math.round(b.netBalance * 100) < 0)
        .map((b) => -Math.round(b.netBalance * 100))
        .sort((a, b) => b - a);
      const creditors = result.balances
        .filter((b) => Math.round(b.netBalance * 100) > 0)
        .map((b) => Math.round(b.netBalance * 100))
        .sort((a, b) => b - a);
      let di = 0;
      let ci = 0;
      let greedy = 0;
      while (di < debtors.length && ci < creditors.length) {
        const pay = Math.min(debtors[di], creditors[ci]);
        debtors[di] -= pay;
        creditors[ci] -= pay;
        greedy++;
        if (debtors[di] === 0) di++;
        if (creditors[ci] === 0) ci++;
      }

      expect(plan).toBeLessThanOrEqual(greedy);

      const residual = new Map(
        result.balances.map((b) => [b.userId, Math.round(b.netBalance * 100)])
      );
      for (const s of result.suggestedSettlements) {
        residual.set(s.fromUserId, (residual.get(s.fromUserId) ?? 0) + Math.round(s.amount * 100));
        residual.set(s.toUserId, (residual.get(s.toUserId) ?? 0) - Math.round(s.amount * 100));
      }
      for (const v of residual.values()) expect(v).toBe(0);
    }
  });
});
