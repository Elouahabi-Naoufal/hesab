"use server";
import { prisma } from "@/lib/prisma";
import { generatePublicUserId } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "./session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
  const raw = {
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    displayName: formData.get("displayName") as string,
  };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(i => i.message).join(", ") };
  }
  const { username, email, password, displayName } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return { error: "User with this email or username already exists" };
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
  const raw = {
    emailOrUsername: formData.get("emailOrUsername") as string,
    password: formData.get("password") as string,
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }
  const { emailOrUsername, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
  });
  if (!user) return { error: "Invalid credentials" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { error: "Invalid credentials" };

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

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}
