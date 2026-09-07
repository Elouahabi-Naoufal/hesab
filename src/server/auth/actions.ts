"use server";
import { prisma } from "@/lib/prisma";
import { generatePublicUserId } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "./session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric and underscore"),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  displayName: z.string().min(2).max(50),
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

export async function registerAction(formData: FormData) {
  const t = await getTranslations("errors");
  const raw = {
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    displayName: formData.get("displayName") as string,
  };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path?.[0] ?? "");
    if (field === "username") return { error: t("usernameChars") };
    if (field === "displayName") return { error: t("displayNameLen") };
    return { error: t("invalidInput") };
  }
  const { username, email, password, displayName } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return { error: t("userExists") };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const publicId = generatePublicUserId();

  const user = await prisma.user.create({
    data: { username, email, passwordHash, displayName, publicId },
  });

  const token = await createSession({
    userId: user.id,
    publicId: user.publicId,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
  });

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/dashboard");
}

export async function loginAction(formData: FormData) {
  const t = await getTranslations("errors");
  const raw = {
    emailOrUsername: formData.get("emailOrUsername") as string,
    password: formData.get("password") as string,
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: t("invalidInput") };
  }
  const { emailOrUsername, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
  });
  if (!user) return { error: t("invalidCredentials") };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { error: t("invalidCredentials") };

  const token = await createSession({
    userId: user.id,
    publicId: user.publicId,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
  });

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(safeReturnUrl(formData.get("returnUrl")));
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}

function safeReturnUrl(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  // Locale-prefixed (/en/...) or plain internal paths only — never external.
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value || "/dashboard";
}
