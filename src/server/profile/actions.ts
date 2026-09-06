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

  // Picture bytes live in the database (User.avatarData/avatarMime).
  // `avatar` (legacy data-URL/remote-URL string) is only cleared, never written.
  let clearAvatar = false;
  let avatarData: Buffer | null | undefined;
  let avatarMime: string | null | undefined;
  if (removeAvatar) {
    clearAvatar = true;
    avatarData = null;
    avatarMime = null;
  } else if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "Profile picture must be an image file." };
    if (file.size > MAX_AVATAR_BYTES) return { error: "Profile picture must be under 500 KB." };
    avatarData = Buffer.from(await file.arrayBuffer());
    avatarMime = file.type;
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      displayName: parsed.data.displayName,
      ...(clearAvatar ? { avatar: null, avatarData: null, avatarMime: null } : {}),
      ...(avatarData !== undefined ? { avatarData, avatarMime } : {}),
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
