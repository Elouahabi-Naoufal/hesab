"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50),
});

const MAX_AVATAR_BYTES = 500 * 1024; // 500 KB — keeps the SQLite row lean

export async function updateProfileAction(formData: FormData) {
  const session = await requireSession();
  const raw = {
    displayName: formData.get("displayName") as string,
  };
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const removeAvatar = formData.get("removeAvatar") === "on";
  const file = formData.get("avatarFile");

  let avatar: string | null | undefined;
  if (removeAvatar) {
    avatar = null;
  } else if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "Profile picture must be an image file." };
    if (file.size > MAX_AVATAR_BYTES) return { error: "Profile picture must be under 500 KB." };
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    avatar = `data:${file.type};base64,${bytes}`;
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      displayName: parsed.data.displayName,
      ...(avatar !== undefined ? { avatar } : {}),
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
