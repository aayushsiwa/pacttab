export interface MemberBalance {
  userId: string;
  username: string;
  netBalance: number; // positive = owed money, negative = owes money
  totalExpensePaid: number; // what the member actually spent on expenses
  totalExpenseShare: number; // what the member actually consumed
  settlementsSent: number; // repayments this member sent to others
  settlementsReceived: number; // repayments this member received from others
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

interface SettlementNode {
  userId: string;
  username: string;
  amountCents: number;
}

/**
 * Largest subset of distinct non-zero balances the exact-cover search will
 * consider. PactTab groups are flat/trip scale, so a small cap keeps the
 * subset-sum scan cheap while still capturing the common 1↔many wins.
 */
const MAX_EXACT_SUBSET = 4;

/** Maximum combined debtor/creditor count for synchronous subset search. */
const MAX_SUBSET_SEARCH_PARTICIPANTS = 20;

/**
 * Finds a subset of `nodes` (indices into the array, distinct, non-zero) whose
 * balances sum to exactly `targetCents`. Uses bounded DFS with a running sum,
 * pruning once the remaining budget cannot be met. `minSize` lets callers skip
 * trivial pair matches when they are handled by a separate pass. Returns the
 * smallest qualifying subset (fewest transfers) or null.
 */
function findExactSubset(
  nodes: SettlementNode[],
  targetCents: number,
  minSize: number
): number[] | null {
  const indices = nodes
    .map((n, i) => ({ i, amount: n.amountCents }))
    .filter((n) => n.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((n) => n.i);

  let best: number[] | null = null;
  const chosen: number[] = [];

  const dfs = (pos: number, remaining: number): void => {
    if (remaining === 0 && chosen.length >= minSize) {
      if (!best || chosen.length < best.length) best = [...chosen];
      return;
    }
    if (best && chosen.length >= best.length - 1) return;
    if (chosen.length >= MAX_EXACT_SUBSET) return;

    for (let k = pos; k < indices.length; k++) {
      const idx = indices[k];
      const amount = nodes[idx].amountCents;
      if (amount <= 0 || amount > remaining) continue;
      chosen.push(idx);
      dfs(k + 1, remaining - amount);
      chosen.pop();
      if (best && best.length === minSize) return;
    }
  };

  dfs(0, targetCents);
  return best;
}

/**
 * Pair pre-pass: a debtor and creditor with identical balances settle in one
 * transfer. Each match removes two parties, but can change the remaining greedy
 * matches, so callers compare against pure greedy. Matching on integer cents
 * makes equality exact.
 */
function matchExactPairs(
  debtors: SettlementNode[],
  creditors: SettlementNode[],
  out: SuggestedSettlement[]
): void {
  const creditorsByAmount = new Map<number, SettlementNode[]>();
  for (const c of creditors) {
    if (c.amountCents <= 0) continue;
    const list = creditorsByAmount.get(c.amountCents) || [];
    list.push(c);
    creditorsByAmount.set(c.amountCents, list);
  }

  for (const debtor of debtors) {
    if (debtor.amountCents <= 0) continue;
    const list = creditorsByAmount.get(debtor.amountCents);
    if (!list || list.length === 0) continue;

    const creditor = list.pop()!;
    if (list.length === 0) creditorsByAmount.delete(debtor.amountCents);

    out.push({
      fromUserId: debtor.userId,
      fromUsername: debtor.username,
      toUserId: creditor.userId,
      toUsername: creditor.username,
      amount: debtor.amountCents / 100,
    });
    debtor.amountCents = 0;
    creditor.amountCents = 0;
  }
}

/**
 * Subset pre-pass: settle a debtor whose balance exactly equals a `>2`-sized
 * subset of creditors (1↔many), and symmetrically a creditor covered by a
 * subset of debtors (many↔1). Pair matches are left to `matchExactPairs`.
 */
function matchExactSubsets(
  debtors: SettlementNode[],
  creditors: SettlementNode[],
  out: SuggestedSettlement[]
): void {
  for (const debtor of debtors) {
    if (debtor.amountCents <= 0) continue;
    const subset = findExactSubset(creditors, debtor.amountCents, 3);
    if (!subset) continue;

    for (const idx of subset) {
      const creditor = creditors[idx];
      out.push({
        fromUserId: debtor.userId,
        fromUsername: debtor.username,
        toUserId: creditor.userId,
        toUsername: creditor.username,
        amount: creditor.amountCents / 100,
      });
      creditor.amountCents = 0;
    }
    debtor.amountCents = 0;
  }

  for (const creditor of creditors) {
    if (creditor.amountCents <= 0) continue;
    const subset = findExactSubset(debtors, creditor.amountCents, 3);
    if (!subset) continue;

    for (const idx of subset) {
      const debtor = debtors[idx];
      out.push({
        fromUserId: debtor.userId,
        fromUsername: debtor.username,
        toUserId: creditor.userId,
        toUsername: creditor.username,
        amount: debtor.amountCents / 100,
      });
      debtor.amountCents = 0;
    }
    creditor.amountCents = 0;
  }
}

/**
 * Greedy simplification over the remainder: match largest debtor with largest
 * creditor, settle `min` each step. Each step zeroes at least one party, so the
 * plan is at most N−1 transfers once Σ debtors === Σ creditors.
 */
function greedySettle(
  debtors: SettlementNode[],
  creditors: SettlementNode[],
  out: SuggestedSettlement[]
): void {
  const activeDebtors = debtors
    .filter((d) => d.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);
  const activeCreditors = creditors
    .filter((c) => c.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);

  let dIdx = 0;
  let cIdx = 0;
  while (dIdx < activeDebtors.length && cIdx < activeCreditors.length) {
    const debtor = activeDebtors[dIdx];
    const creditor = activeCreditors[cIdx];
    const amountCents = Math.min(debtor.amountCents, creditor.amountCents);

    out.push({
      fromUserId: debtor.userId,
      fromUsername: debtor.username,
      toUserId: creditor.userId,
      toUsername: creditor.username,
      amount: amountCents / 100,
    });

    debtor.amountCents -= amountCents;
    creditor.amountCents -= amountCents;

    if (debtor.amountCents === 0) dIdx++;
    if (creditor.amountCents === 0) cIdx++;
  }
}

/**
 * Builds one full settlement plan from the classified debtors/creditors.
 * `withPairs` and `withSubsets` independently toggle the exact-match passes.
 * The input nodes are cloned so callers can reuse them.
 */
function buildPlan(
  debtors: SettlementNode[],
  creditors: SettlementNode[],
  withPairs: boolean,
  withSubsets: boolean
): SuggestedSettlement[] {
  const d = debtors.map((n) => ({ ...n }));
  const c = creditors.map((n) => ({ ...n }));
  const plan: SuggestedSettlement[] = [];
  if (withPairs) matchExactPairs(d, c, plan);
  if (withSubsets) matchExactSubsets(d, c, plan);
  greedySettle(d, c, plan);
  return plan;
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
    {
      username: string;
      expensePaidCents: number;
      expenseShareCents: number;
      settlementsSentCents: number;
      settlementsReceivedCents: number;
    }
  >();

  for (const m of members) {
    memberMap.set(m.id, {
      username: m.username,
      expensePaidCents: 0,
      expenseShareCents: 0,
      settlementsSentCents: 0,
      settlementsReceivedCents: 0,
    });
  }

  // 1. Process Expenses & Splits
  for (const exp of expenses) {
    const paidCents = toCents(exp.amount);
    const payer = memberMap.get(exp.paidByUserId);
    if (payer) {
      payer.expensePaidCents += paidCents;
    }

    for (const split of exp.splits) {
      const debtor = memberMap.get(split.userId);
      if (debtor) {
        debtor.expenseShareCents += toCents(split.owedAmount);
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

    // Payer has repaid debt, so their net balance increases (less debt / more credit)
    if (payer) {
      payer.settlementsSentCents += setCents;
    }
    // Recipient has received repayment, so their net balance decreases (less credit)
    if (recipient) {
      recipient.settlementsReceivedCents += setCents;
    }
  }

  // Net balances stay in cents; convert to rupees only when building the DTO.
  const balances: MemberBalance[] = [];
  const debtors: { userId: string; username: string; amountCents: number }[] = [];
  const creditors: { userId: string; username: string; amountCents: number }[] = [];

  for (const [userId, data] of memberMap.entries()) {
    // Settlement repayments still move the net position, but expense spending
    // and consumption stay isolated from them in the summary fields.
    const netCents =
      data.expensePaidCents +
      data.settlementsSentCents -
      (data.expenseShareCents + data.settlementsReceivedCents);

    balances.push({
      userId,
      username: data.username,
      netBalance: netCents / 100,
      totalExpensePaid: data.expensePaidCents / 100,
      totalExpenseShare: data.expenseShareCents / 100,
      settlementsSent: data.settlementsSentCents / 100,
      settlementsReceived: data.settlementsReceivedCents / 100,
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

  // 4. Compare pure greedy, pair + greedy, and (for small groups) pair + subset
  //    + greedy. Keeping the shortest guarantees no more transfers than pure
  //    greedy. Prefer the existing pair plan on ties.
  const baseGreedyPlan = buildPlan(debtors, creditors, false, false);
  const pairPlan = buildPlan(debtors, creditors, true, false);
  const greedyPlan = pairPlan.length <= baseGreedyPlan.length ? pairPlan : baseGreedyPlan;
  const subsetPlan =
    debtors.length + creditors.length <= MAX_SUBSET_SEARCH_PARTICIPANTS
      ? buildPlan(debtors, creditors, true, true)
      : greedyPlan;
  const suggestedSettlements = subsetPlan.length < greedyPlan.length ? subsetPlan : greedyPlan;

  return { balances, suggestedSettlements };
}
