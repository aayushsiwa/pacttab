export interface MemberBalance {
  userId: string;
  username: string;
  netBalance: number; // positive = owed money, negative = owes money
  totalPaid: number;
  totalOwed: number;
}

export interface SuggestedSettlement {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  amount: number;
}

/**
 * Split an amount equally among participants with exact penny distribution.
 */
export function calculateEqualSplits(
  totalAmount: number,
  participantIds: string[]
): { userId: string; owedAmount: number }[] {
  if (participantIds.length === 0) return [];
  const totalCents = Math.round(totalAmount * 100);
  const count = participantIds.length;
  const baseCents = Math.floor(totalCents / count);
  let remainderCents = totalCents % count;

  return participantIds.map((userId) => {
    let cents = baseCents;
    if (remainderCents > 0) {
      cents += 1;
      remainderCents -= 1;
    }
    return {
      userId,
      owedAmount: cents / 100,
    };
  });
}

/**
 * Split an amount by exact rupee amounts with verification.
 */
export function calculateExactSplits(
  totalAmount: number,
  splits: { userId: string; amount: number }[]
): { userId: string; owedAmount: number }[] {
  if (splits.length === 0) return [];
  const targetCents = Math.round(totalAmount * 100);
  const sumCents = splits.reduce((sum, s) => sum + Math.round(s.amount * 100), 0);

  if (sumCents !== targetCents) {
    const diff = (targetCents - sumCents) / 100;
    throw new Error(
      `Exact split total (₹${(sumCents / 100).toFixed(2)}) must equal total expense amount (₹${totalAmount.toFixed(2)}). Difference: ₹${diff.toFixed(2)}`
    );
  }

  return splits.map((s) => ({
    userId: s.userId,
    owedAmount: Math.round(s.amount * 100) / 100,
  }));
}

/**
 * Split an amount by percentages with penny-accurate residual distribution.
 */
export function calculatePercentageSplits(
  totalAmount: number,
  splits: { userId: string; percentage: number }[]
): { userId: string; owedAmount: number }[] {
  if (splits.length === 0) return [];
  const sumPercent = splits.reduce((sum, s) => sum + s.percentage, 0);

  if (Math.abs(sumPercent - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100%. Current sum: ${sumPercent.toFixed(2)}%`);
  }

  const targetCents = Math.round(totalAmount * 100);
  const computed = splits.map((s) => {
    const exactCents = (s.percentage / 100) * targetCents;
    const floorCents = Math.floor(exactCents);
    const fraction = exactCents - floorCents;
    return {
      userId: s.userId,
      cents: floorCents,
      fraction,
    };
  });

  const allocatedCents = computed.reduce((sum, item) => sum + item.cents, 0);
  let remainderCents = targetCents - allocatedCents;

  // Sort by highest fraction to distribute leftover pennies
  const sortedIndices = computed
    .map((item, index) => ({ index, fraction: item.fraction }))
    .sort((a, b) => b.fraction - a.fraction);

  let i = 0;
  while (remainderCents > 0 && i < sortedIndices.length) {
    computed[sortedIndices[i].index].cents += 1;
    remainderCents--;
    i++;
  }

  return computed.map((c) => ({
    userId: c.userId,
    owedAmount: c.cents / 100,
  }));
}

/**
 * Split an amount by shares / weights with penny-accurate residual distribution.
 */
export function calculateShareSplits(
  totalAmount: number,
  splits: { userId: string; shares: number }[]
): { userId: string; owedAmount: number }[] {
  if (splits.length === 0) return [];
  const totalShares = splits.reduce((sum, s) => sum + Math.max(0, s.shares), 0);

  if (totalShares <= 0) {
    throw new Error("Total shares must be greater than zero");
  }

  const targetCents = Math.round(totalAmount * 100);
  const computed = splits.map((s) => {
    const exactCents = (Math.max(0, s.shares) / totalShares) * targetCents;
    const floorCents = Math.floor(exactCents);
    const fraction = exactCents - floorCents;
    return {
      userId: s.userId,
      cents: floorCents,
      fraction,
    };
  });

  const allocatedCents = computed.reduce((sum, item) => sum + item.cents, 0);
  let remainderCents = targetCents - allocatedCents;

  const sortedIndices = computed
    .map((item, index) => ({ index, fraction: item.fraction }))
    .sort((a, b) => b.fraction - a.fraction);

  let i = 0;
  while (remainderCents > 0 && i < sortedIndices.length) {
    computed[sortedIndices[i].index].cents += 1;
    remainderCents--;
    i++;
  }

  return computed.map((c) => ({
    userId: c.userId,
    owedAmount: c.cents / 100,
  }));
}

/**
 * Convert a rupee amount into an integer number of paise (cents).
 * All aggregation happens in cents so float drift can never distribute an
 * extra/missing paise across members.
 */
function toCents(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

/**
 * Calculates member balances and simplified debt repayments.
 *
 * All accumulation, per-member nets, debtor/creditor classification and the
 * greedy simplification loop operate on integer cents. Rupee floats are only
 * produced at the output boundary, which keeps the group exactly zero-sum:
 * `Σ netBalance === 0` and the suggested settlements settle every paise.
 */
export function calculateBalancesAndSettlements(
  members: { id: string; username: string }[],
  expenses: {
    id: string;
    amount: string | number;
    paidByUserId: string;
    splits: { userId: string; owedAmount: string | number }[];
  }[],
  settlements: {
    id: string;
    amount: string | number;
    paidByUserId: string;
    receivedByUserId: string;
    status?: string;
  }[]
): {
  balances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
} {
  const memberMap = new Map<
    string,
    { username: string; totalPaidCents: number; totalOwedCents: number }
  >();

  for (const m of members) {
    memberMap.set(m.id, {
      username: m.username,
      totalPaidCents: 0,
      totalOwedCents: 0,
    });
  }

  // 1. Process Expenses & Splits
  for (const exp of expenses) {
    const paidCents = toCents(exp.amount);
    const payer = memberMap.get(exp.paidByUserId);
    if (payer) {
      payer.totalPaidCents += paidCents;
    }

    for (const split of exp.splits) {
      const debtor = memberMap.get(split.userId);
      if (debtor) {
        debtor.totalOwedCents += toCents(split.owedAmount);
      }
    }
  }

  // 2. Process Settlements (only confirmed settlements impact balances)
  for (const set of settlements) {
    if (set.status && set.status !== "confirmed") {
      continue;
    }
    const setCents = toCents(set.amount);
    const payer = memberMap.get(set.paidByUserId);
    const recipient = memberMap.get(set.receivedByUserId);

    // Payer has paid back debt, so their net balance increases (less debt / more credit)
    if (payer) {
      payer.totalPaidCents += setCents;
    }
    // Recipient has received repayment, so their net balance decreases (less credit)
    if (recipient) {
      recipient.totalOwedCents += setCents;
    }
  }

  // Net balances stay in cents; convert to rupees only when building the DTO.
  const balances: MemberBalance[] = [];
  const debtors: { userId: string; username: string; amountCents: number }[] = [];
  const creditors: { userId: string; username: string; amountCents: number }[] = [];

  for (const [userId, data] of memberMap.entries()) {
    const netCents = data.totalPaidCents - data.totalOwedCents;
    const netBalance = netCents / 100;

    balances.push({
      userId,
      username: data.username,
      netBalance,
      totalPaid: data.totalPaidCents / 100,
      totalOwed: data.totalOwedCents / 100,
    });

    // 3. Classify: debtor owes money (netCents < 0), creditor is owed money (netCents > 0)
    if (netCents < 0) {
      debtors.push({ userId, username: data.username, amountCents: -netCents });
    } else if (netCents > 0) {
      creditors.push({ userId, username: data.username, amountCents: netCents });
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.amountCents - a.amountCents);
  creditors.sort((a, b) => b.amountCents - a.amountCents);

  const suggestedSettlements: SuggestedSettlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  // Greedy simplification: every step transfers whole cents, so once
  // Σ debtors === Σ creditors the loop drains both sides exactly.
  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amountCents = Math.min(debtor.amountCents, creditor.amountCents);

    if (amountCents > 0) {
      suggestedSettlements.push({
        fromUserId: debtor.userId,
        fromUsername: debtor.username,
        toUserId: creditor.userId,
        toUsername: creditor.username,
        amount: amountCents / 100,
      });
    }

    debtor.amountCents -= amountCents;
    creditor.amountCents -= amountCents;

    if (debtor.amountCents === 0) dIdx++;
    if (creditor.amountCents === 0) cIdx++;
  }

  return { balances, suggestedSettlements };
}
