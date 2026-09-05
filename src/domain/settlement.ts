/**
 * Settlement Engine - Pure domain logic, no framework dependencies
 * Deterministic, integer centimes only
 *
 * Calculates settlement for an OUTING (not a group).
 * Aggregates responsibility from activities (FIXED usage + VARIABLE line items)
 * and payments from activity payments.
 */

export type Centimes = number;

export interface SettlementMember {
  userId: string;
  displayName?: string;
}

export interface ActivityInput {
  id: string;
  name: string;
  pricingModel: "FIXED" | "VARIABLE";
  status: string;
  // For FIXED: usage records with participants
  usageRecords?: {
    id: string;
    totalCentimes: Centimes;
    status: string;
    participantIds: string[];
  }[];
  // For VARIABLE: line items per participant
  lineItems?: {
    userId: string;
    priceCentimes: Centimes;
  }[];
  // Payments for this activity
  payments: {
    userId: string;
    amountCentimes: Centimes;
  }[];
}

export interface OutingInput {
  members: SettlementMember[];
  activities: ActivityInput[];
}

export interface MemberBalance {
  userId: string;
  displayName?: string;
  totalPaid: Centimes;
  totalResponsibility: Centimes;
  netBalance: Centimes; // positive = should receive, negative = owes
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
  memberBalances: MemberBalance[];
  transfers: Transfer[];
  incompleteActivityIds: string[];
  isComplete: boolean;
}

/**
 * Calculate settlement for an outing.
 * Pure function - deterministic.
 */
export function calculateSettlement(input: OutingInput): SettlementResult {
  const { members, activities } = input;

  // Initialize balances
  const balanceMap = new Map<string, MemberBalance>();
  for (const m of members) {
    balanceMap.set(m.userId, {
      userId: m.userId,
      displayName: m.displayName,
      totalPaid: 0,
      totalResponsibility: 0,
      netBalance: 0,
    });
  }

  let totalExpenses = 0;
  let totalPaid = 0;
  let totalUnrecorded = 0;
  const incompleteActivityIds: string[] = [];

  for (const activity of activities) {
    let activityResponsibility = 0;
    let activityPaid = 0;
    let hasUnrecordedPayments = false;

    if (activity.pricingModel === "FIXED") {
      // Process usage records (exclude disputed ones)
      for (const record of (activity.usageRecords || [])) {
        if (record.status === "DISPUTED") continue;

        if (record.participantIds.length === 0) continue;
        const sharePerPerson = Math.floor(record.totalCentimes / record.participantIds.length);

        for (const pid of record.participantIds) {
          const b = balanceMap.get(pid);
          if (!b) throw new Error(`Unknown user in usage record: ${pid}`);
          b.totalResponsibility += sharePerPerson;
        }
        activityResponsibility += sharePerPerson * record.participantIds.length;
      }
    } else {
      // VARIABLE: sum line items
      for (const item of (activity.lineItems || [])) {
        const b = balanceMap.get(item.userId);
        if (!b) throw new Error(`Unknown user in line item: ${item.userId}`);
        b.totalResponsibility += item.priceCentimes;
        activityResponsibility += item.priceCentimes;
      }
    }

    // Process payments
    for (const pay of activity.payments) {
      const b = balanceMap.get(pay.userId);
      if (!b) throw new Error(`Unknown user in payment: ${pay.userId}`);
      b.totalPaid += pay.amountCentimes;
      activityPaid += pay.amountCentimes;
    }

    totalExpenses += activityResponsibility;
    totalPaid += activityPaid;

    // Check if payments are complete for this activity
    if (activity.payments.length === 0 && activityResponsibility > 0) {
      totalUnrecorded += activityResponsibility;
      incompleteActivityIds.push(activity.id);
      hasUnrecordedPayments = true;
    } else if (activityPaid !== activityResponsibility && activityResponsibility > 0) {
      // Partial payments — still incomplete
      if (activityPaid < activityResponsibility) {
        totalUnrecorded += activityResponsibility - activityPaid;
        incompleteActivityIds.push(activity.id);
        hasUnrecordedPayments = true;
      }
    }
  }

  // Calculate net balances
  const memberBalances: MemberBalance[] = [];
  for (const b of balanceMap.values()) {
    b.netBalance = b.totalPaid - b.totalResponsibility;
    memberBalances.push(b);
  }

  // Validate completeness
  const isComplete = incompleteActivityIds.length === 0;
  const positiveSum = memberBalances.filter(b => b.netBalance > 0).reduce((s, b) => s + b.netBalance, 0);
  const negativeSum = memberBalances.filter(b => b.netBalance < 0).reduce((s, b) => s + Math.abs(b.netBalance), 0);

  if (isComplete && positiveSum !== negativeSum) {
    throw new Error(`Settlement invariant violated: positive ${positiveSum} != negative ${negativeSum}`);
  }

  const transfers = simplifyDebts(memberBalances);

  return {
    totalExpenses,
    totalPaid,
    totalUnrecorded,
    memberBalances,
    transfers,
    incompleteActivityIds,
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
  const creditors = balances
    .filter(b => b.netBalance > 0)
    .map(b => ({ userId: b.userId, displayName: b.displayName, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter(b => b.netBalance < 0)
    .map(b => ({ userId: b.userId, displayName: b.displayName, amount: Math.abs(b.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

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
 * Generate explanation for a settlement.
 * Shows per-person: paid, responsible, net, and resulting transfer.
 */
export function explainSettlement(
  transfers: Transfer[],
  memberBalances: MemberBalance[],
  userMap?: Map<string, string>
): string {
  const lines: string[] = [];

  for (const b of memberBalances) {
    const name = userMap?.get(b.userId) || b.userId;
    const paid = (b.totalPaid / 100).toFixed(2);
    const resp = (b.totalResponsibility / 100).toFixed(2);
    const net = b.netBalance;
    const netStr = net >= 0 ? `+${(net / 100).toFixed(2)}` : (net / 100).toFixed(2);

    lines.push(`${name}:`);
    lines.push(`  Paid: ${paid} DH`);
    lines.push(`  Responsible for: ${resp} DH`);
    lines.push(`  Net: ${netStr} DH`);
    lines.push("");
  }

  if (transfers.length > 0) {
    lines.push("Transfers:");
    for (const t of transfers) {
      const from = userMap?.get(t.fromUserId) || t.fromUserId;
      const to = userMap?.get(t.toUserId) || t.toUserId;
      const amount = (t.amountCentimes / 100).toFixed(2);
      lines.push(`  ${from} -> ${to}: ${amount} DH`);
    }
  } else {
    lines.push("Everyone is settled up!");
  }

  return lines.join("\n");
}
