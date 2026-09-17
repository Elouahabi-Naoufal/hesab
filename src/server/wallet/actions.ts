"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { parseDHToCentimes } from "@/domain/money";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function depositAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const raw = formData.get("amount") as string;

  try {
    const amountCt = parseDHToCentimes(raw, { minCentimes: 1, field: "Amount" });

    const wallet = await prisma.wallet.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, balanceCt: amountCt },
      update: { balanceCt: { increment: amountCt } },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEPOSIT",
        amountCt,
        balanceBeforeCt: wallet.balanceCt - amountCt,
        balanceAfterCt: wallet.balanceCt,
        description: `Deposited ${(amountCt / 100).toFixed(2)} DH`,
      },
    });

    revalidatePath("/wallet");
    revalidatePath("/dashboard");
  } catch {
    const t = await getTranslations("errors");
    throw new Error(t("amountPositive"));
  }

  redirect("/wallet");
}

export async function getWalletAction() {
  const session = await requireSession();
  const wallet = await prisma.wallet.findUnique({
    where: { userId: session.userId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!wallet) {
    return { balanceCt: 0, transactions: [] };
  }
  return {
    balanceCt: wallet.balanceCt,
    transactions: wallet.transactions.map(t => ({
      id: t.id,
      type: t.type,
      amountCt: t.amountCt,
      balanceBeforeCt: t.balanceBeforeCt,
      balanceAfterCt: t.balanceAfterCt,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}