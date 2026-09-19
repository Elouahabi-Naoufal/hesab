"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import fs from "fs";
import path from "path";

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50),
});

function avatarPath(userId: string): string {
  return path.join(process.cwd(), "data", "avatars", `${userId}.png`);
}

async function ensureAvatarDir() {
  const dir = path.join(process.cwd(), "data", "avatars");
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function updateProfileAction(formData: FormData) {
  const session = await requireSession();
  const t = await getTranslations("errors");
  const raw = {
    displayName: formData.get("displayName") as string,
  };
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: t("displayNameLen") };

  const removeAvatar = formData.get("removeAvatar") === "on";
  const file = formData.get("avatarFile");

  if (removeAvatar) {
    const p = avatarPath(session.userId);
    try { await fs.promises.unlink(p); } catch {}
  } else if (file instanceof File && file.size > 0) {
    try {
      if (!file.type.startsWith("image/")) return { error: t("avatarImageOnly") };
      const mb = file.size / 1024 / 1024;
      if (mb > 3) return { error: `Image is ${mb.toFixed(1)} MB — must be under 3 MB. Take a screenshot and upload that instead.` };
      await ensureAvatarDir();
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.promises.writeFile(avatarPath(session.userId), buffer);
    } catch {
      return { error: "Could not save the image. Try taking a screenshot and uploading that instead." };
    }
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      displayName: parsed.data.displayName,
      ...(removeAvatar ? { avatar: null } : {}),
      ...(file instanceof File && file.size > 0 ? { avatar: `/api/avatar/${session.userId}` } : {}),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getProfile() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, displayName: true, publicId: true, avatar: true, isAdmin: true, createdAt: true },
  });
  if (!user) throw new Error("User not found");
  return user;
}
