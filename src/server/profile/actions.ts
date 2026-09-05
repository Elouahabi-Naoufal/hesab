"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50),
  avatar: z.string().url().optional().or(z.literal("")),
});

export async function updateProfileAction(formData: FormData) {
  const session = await requireSession();
  const raw = {
    displayName: formData.get("displayName") as string,
    avatar: (formData.get("avatar") as string) || undefined,
  };
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      displayName: parsed.data.displayName,
      avatar: parsed.data.avatar || null,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getProfile() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Error("User not found");
  return user;
}
