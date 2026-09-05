import { prisma } from "@/lib/prisma";
import { formatDH } from "@/domain/money";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Transaction client passed into ledger helpers (works for $transaction callbacks). */
export type LedgerTx = Prisma.TransactionClient;
/** Either a root client or a transaction client. */
export type LedgerDb = PrismaClient | Prisma.TransactionClient;

/**
 * Framework-free wallet ledger core. All balance mutations in the app MUST go
 * through here so the WalletTransaction ledger stays authoritative.
 *
 * Mathematical model:
 * - balance is a cache; SUM(transactions.amount) per wallet is the truth.
 * - Every mutation writes exactly one transaction row in the same DB tx.
 * - NO OVERDRAFT: deduct throws when balance < amount. Callers run this
 *   inside prisma.$transaction; SQLite serializes writers, so two concurrent
 *   deducts cannot both succeed (second sees the decremented balance).
 */
export async function getOrCreateWalletTx(tx: LedgerTx, userId: string) {
  let wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) wallet = await tx.wallet.create({ data: { userId, balance: 0 } });
  return wallet;
}

/** Credit wallet (deposit / refund). Amount must be > 0. */
export async function creditWalletTx(
  tx: LedgerTx,
  userId: string,
  amount: number,
  opts: { type: "DEPOSIT" | "REFUND"; description: string; groupId?: string }
) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Credit amount must be positive.");
  const wallet = await getOrCreateWalletTx(tx, userId);
  await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, amount, type: opts.type, description: opts.description, groupId: opts.groupId ?? null },
  });
  return wallet;
}

/** Deduct from wallet. Throws Insufficient-wallet error when balance < amount. */
export async function deductWalletTx(
  tx: LedgerTx,
  userId: string,
  amount: number,
  opts: { type: "CONTRIBUTION"; description: string; groupId?: string }
) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Deduct amount must be >= 0.");
  if (amount === 0) return getOrCreateWalletTx(tx, userId);
  const wallet = await getOrCreateWalletTx(tx, userId);
  if (wallet.balance < amount) {
    throw new Error(
      `Insufficient wallet: need ${formatDH(amount)} but you have ${formatDH(wallet.balance)}. Deposit at /wallet.`
    );
  }
  await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, amount: -amount, type: opts.type, description: opts.description, groupId: opts.groupId ?? null },
  });
  return wallet;
}

/** Ledger audit: every wallet's cached balance must equal its transaction sum. */
export async function auditLedger(db: LedgerDb = prisma): Promise<Array<{ userId: string; balance: number; ledgerSum: number }>> {
  const wallets = await db.wallet.findMany({ include: { transactions: true } });
  return wallets
    .map((w: { userId: string; balance: number; transactions: Array<{ amount: number }> }) => ({
      userId: w.userId,
      balance: w.balance,
      ledgerSum: w.transactions.reduce((s: number, t: { amount: number }) => s + t.amount, 0),
    }))
    .filter((r: { userId: string; balance: number; ledgerSum: number }) => r.balance !== r.ledgerSum);
}
