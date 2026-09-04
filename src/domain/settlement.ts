/**
 * Settlement Engine - Pure domain logic, no framework dependencies
 * Deterministic, integer centimes only
 */

export type Centimes = number;

export interface SettlementMember {
  userId: string;
  displayName?: string;
}

export interface ExpenseInput {
  id: string;
  totalCentimes: Centimes;
  allocations: { userId: string; amountCentimes: Centimes }[];
  payments: { userId: string; amountCentimes: Centimes }[];
}

export interface SettlementInput {
  members: SettlementMember[];
  expenses: ExpenseInput[];
  contributions?: { userId: string; amountCentimes: Centimes }[];
}

export interface MemberBalance {
  userId: string;
  displayName?: string;
  totalPaid: Centimes;
  totalResponsibility: Centimes;
  netBalance: Centimes; // positive = should receive, negative = owes
  contribution?: Centimes;
}

export interface Transfer {
  fromUserId: string;
  toUserId: string;
  amountCentimes: Centimes;
  fromDisplayName?: string;
  toDisplayName?: string;
}

export interface SettlementResult {
  totalExpenses: Centimes;
  totalPaid: Centimes;
  totalUnrecorded: Centimes;
  totalContributions: Centimes;
  memberBalances: MemberBalance[];
  transfers: Transfer[];
  incompleteExpenseIds: string[];
  isComplete: boolean; // false if any expense has no payer recorded
}

/**
 * Calculate settlement from inputs
 * Pure function - deterministic
 */
export function calculateSettlement(input: SettlementInput): SettlementResult {
  const { members, expenses } = input;
  
  // Initialize balances
  const balanceMap = new Map<string, MemberBalance>();
  for (const m of members) {
    balanceMap.set(m.userId, {
      userId: m.userId,
      displayName: m.displayName,
      totalPaid: 0,
      totalResponsibility: 0,
      netBalance: 0,
      contribution: 0,
    });
  }

  // Contributions
  let totalContributions = 0;
  if (input.contributions) {
    for (const c of input.contributions) {
      const b = balanceMap.get(c.userId);
      if (b) {
        b.contribution = c.amountCentimes;
        totalContributions += c.amountCentimes;
      }
    }
  }

  // Aggregate from expenses
  let totalExpenses = 0;
  let totalPaid = 0;
  let totalUnrecorded = 0;
  const incompleteExpenseIds: string[] = [];

  for (const exp of expenses) {
    totalExpenses += exp.totalCentimes;

    // Validate invariants: allocations must always sum to total
    const allocSum = exp.allocations.reduce((s, a) => s + a.amountCentimes, 0);
    const paySum = exp.payments.reduce((s, p) => s + p.amountCentimes, 0);
    
    if (allocSum !== exp.totalCentimes) {
      throw new Error(`Expense ${exp.id}: allocation sum ${allocSum} != total ${exp.totalCentimes}`);
    }
    // Payments are OPTIONAL:
    // - If no payments recorded => unrecorded (unknown payer), not automatically 0
    // - If payments recorded => must sum to total (supports multiple payers)
    if (exp.payments.length === 0) {
      totalUnrecorded += exp.totalCentimes;
      incompleteExpenseIds.push(exp.id);
      // still count responsibility, but no paid amount
    } else if (paySum !== exp.totalCentimes) {
      throw new Error(`Expense ${exp.id}: payment sum ${paySum} != total ${exp.totalCentimes} (if payer is recorded, it must equal total for multiple payers)`);
    }

    for (const alloc of exp.allocations) {
      const b = balanceMap.get(alloc.userId);
      if (!b) throw new Error(`Unknown user in allocation: ${alloc.userId}`);
      b.totalResponsibility += alloc.amountCentimes;
    }

    for (const pay of exp.payments) {
      const b = balanceMap.get(pay.userId);
      if (!b) throw new Error(`Unknown user in payment: ${pay.userId}`);
      b.totalPaid += pay.amountCentimes;
      totalPaid += pay.amountCentimes;
    }
  }

  // Calculate net balances
  const memberBalances: MemberBalance[] = [];
  for (const b of balanceMap.values()) {
    b.netBalance = b.totalPaid - b.totalResponsibility;
    memberBalances.push(b);
  }

  // If any expense has unrecorded payer, settlement is incomplete
  // In that case sum(positive) != sum(|negative|) is expected: difference == unrecorded
  // We do NOT throw; we generate partial settlement and flag incomplete
  const positiveSum = memberBalances.filter(b => b.netBalance > 0).reduce((s, b) => s + b.netBalance, 0);
  const negativeSum = memberBalances.filter(b => b.netBalance < 0).reduce((s, b) => s + Math.abs(b.netBalance), 0);
  const isComplete = incompleteExpenseIds.length === 0;
  if (isComplete && positiveSum !== negativeSum) {
    throw new Error(`Settlement invariant violated: positive ${positiveSum} != negative ${negativeSum}`);
  }

  // Generate simplified transfers: match debtors to creditors
  // When incomplete, this will produce partial settlement (only matched portion)
  const transfers = simplifyDebts(memberBalances);

  // Validate after transfers all zero (simulation)
  // Not mutating original, just validation concept

  return {
    totalExpenses,
    totalPaid,
    totalUnrecorded,
    totalContributions,
    memberBalances,
    transfers,
    incompleteExpenseIds,
    isComplete,
  };
}

/**
 * Debt simplification algorithm
 * Greedy matching: largest debtor to largest creditor
 * Produces minimal number of transfers
 * Operates in integer centimes
 */
export function simplifyDebts(balances: MemberBalance[]): Transfer[] {
  // Clone and sort
  const creditors = balances
    .filter(b => b.netBalance > 0)
    .map(b => ({ userId: b.userId, displayName: b.displayName, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter(b => b.netBalance < 0)
    .map(b => ({ userId: b.userId, displayName: b.displayName, amount: Math.abs(b.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];

  let i = 0; // debtors index
  let j = 0; // creditors index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountCentimes: amount,
        fromDisplayName: debtor.displayName,
        toDisplayName: creditor.displayName,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transfers;
}

/**
 * Format settlement for WhatsApp sharing
 */
export function formatSettlementMessage(
  groupName: string,
  transfers: Transfer[],
  totalCentimes: number,
  userMap?: Map<string, string>
): string {
  const lines = transfers.map(t => {
    const from = userMap?.get(t.fromUserId) || t.fromDisplayName || t.fromUserId;
    const to = userMap?.get(t.toUserId) || t.toDisplayName || t.toUserId;
    const amount = (t.amountCentimes / 100).toFixed(0);
    return `${from} → ${to}: ${amount} DH`;
  });

  return `🎱 ${groupName}\n\nFinal settlement:\n\n${lines.join("\n")}\n\nTotal: ${(totalCentimes / 100).toFixed(0)} DH`;
}
