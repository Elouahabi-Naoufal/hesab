"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import { parseDHToCentimes } from "@/domain/money";
import { creditWalletTx } from "./ledger";
import { errMsg } from "@/lib/utils";

async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId, balance: 0 } });
  }
  return wallet;
}

export async function getWalletBalance() {
  const session = await requireSession();
  const wallet = await getOrCreateWallet(session.userId);
  return wallet.balance;
}

export async function getWalletWithTransactions() {
  const session = await requireSession();
  const wallet = await getOrCreateWallet(session.userId);
  const txs = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { wallet, transactions: txs };
}

export async function depositAction(formData: FormData) {
  const session = await requireSession();
  // DH-denominated input (e.g. "50" or "7.50"); min 0.01 DH, rejects zero/negative/garbage
  let amount: number;
  try {
    amount = parseDHToCentimes(formData.get("amount") as string, { minCentimes: 1, field: "Deposit amount" });
  } catch (e: unknown) {
    return { error: errMsg(e) };
  }

  await prisma.$transaction(async (tx) => {
    await creditWalletTx(tx, session.userId, amount, { type: "DEPOSIT", description: "Wallet deposit" });
  });

  revalidatePath("/wallet");
  revalidatePath("/profile");
  return { success: true };
}
