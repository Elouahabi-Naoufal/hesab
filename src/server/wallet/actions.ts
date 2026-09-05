"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

const depositSchema = z.object({
  amount: z.number().int().min(100).max(100000000), // 1 DH to 1M DH in centimes
});

export async function depositAction(formData: FormData) {
  const session = await requireSession();
  const amount = parseInt((formData.get("amount") as string) || "0", 10);
  const parsed = depositSchema.safeParse({ amount });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const wallet = await getOrCreateWallet(session.userId);

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: "DEPOSIT",
        description: "Wallet deposit",
      },
    });
  });

  revalidatePath("/wallet");
  revalidatePath("/profile");
  return { success: true };
}

export async function deductContributionTx(tx: any, userId: string, groupId: string, amount: number) {
  // Use within a transaction, tx is prisma transaction client
  let wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await tx.wallet.create({ data: { userId, balance: 0 } });
  }
  if (wallet.balance < amount) {
    throw new Error(`Insufficient wallet balance: ${wallet.balance} < ${amount}. Please deposit first at /wallet.`);
  }
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: amount } },
  });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: -amount,
      type: "CONTRIBUTION",
      description: `Contribution to group ${groupId}`,
      groupId,
    },
  });
  return wallet;
}
