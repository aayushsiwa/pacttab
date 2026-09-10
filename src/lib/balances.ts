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
 * Calculates member balances and simplified debt repayments.
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
    { username: string; totalPaid: number; totalOwed: number; netBalance: number }
  >();

  for (const m of members) {
    memberMap.set(m.id, {
      username: m.username,
      totalPaid: 0,
      totalOwed: 0,
      netBalance: 0,
    });
  }

  // 1. Process Expenses & Splits
  for (const exp of expenses) {
    const paidAmount = Number(exp.amount);
    const payer = memberMap.get(exp.paidByUserId);
    if (payer) {
      payer.totalPaid += paidAmount;
    }

    for (const split of exp.splits) {
      const owed = Number(split.owedAmount);
      const debtor = memberMap.get(split.userId);
      if (debtor) {
        debtor.totalOwed += owed;
      }
    }
  }

  // 2. Process Settlements (only confirmed settlements impact balances)
  for (const set of settlements) {
    if (set.status && set.status !== "confirmed") {
      continue;
    }
    const setAmount = Number(set.amount);
    const payer = memberMap.get(set.paidByUserId);
    const recipient = memberMap.get(set.receivedByUserId);

    // Payer has paid back debt, so their net balance increases (less debt / more credit)
    if (payer) {
      payer.totalPaid += setAmount;
    }
    // Recipient has received repayment, so their net balance decreases (less credit)
    if (recipient) {
      recipient.totalOwed += setAmount;
    }
  }

  // Calculate net balances
  const balances: MemberBalance[] = [];
  for (const [userId, data] of memberMap.entries()) {
    const net = Math.round((data.totalPaid - data.totalOwed) * 100) / 100;
    balances.push({
      userId,
      username: data.username,
      netBalance: net,
      totalPaid: Math.round(data.totalPaid * 100) / 100,
      totalOwed: Math.round(data.totalOwed * 100) / 100,
    });
  }

  // 3. Greedy debt simplification algorithm
  // Debtor owes money (netBalance < 0)
  // Creditor is owed money (netBalance > 0)
  const debtors: { userId: string; username: string; amount: number }[] = [];
  const creditors: { userId: string; username: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.netBalance < -0.009) {
      debtors.push({ userId: b.userId, username: b.username, amount: -b.netBalance });
    } else if (b.netBalance > 0.009) {
      creditors.push({ userId: b.userId, username: b.username, amount: b.netBalance });
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const suggestedSettlements: SuggestedSettlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amount = Math.min(debtor.amount, creditor.amount);
    const roundedAmount = Math.round(amount * 100) / 100;

    if (roundedAmount > 0) {
      suggestedSettlements.push({
        fromUserId: debtor.userId,
        fromUsername: debtor.username,
        toUserId: creditor.userId,
        toUsername: creditor.username,
        amount: roundedAmount,
      });
    }

    debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;

    if (debtor.amount <= 0.009) dIdx++;
    if (creditor.amount <= 0.009) cIdx++;
  }

  return { balances, suggestedSettlements };
}
