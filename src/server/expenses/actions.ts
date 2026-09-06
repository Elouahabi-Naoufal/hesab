"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";

export async function createExpenseAction() {
  return { error: "Expenses are now handled through Activities. Use activity creation instead." };
}

export async function deleteExpenseAction() {
  return { error: "Not applicable with the new activity-based model." };
}
