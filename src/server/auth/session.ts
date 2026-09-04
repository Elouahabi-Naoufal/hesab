import * as jose from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-use-long-random-string-32-chars-min";
const secret = new TextEncoder().encode(JWT_SECRET);
const alg = "HS256";

export interface SessionPayload {
  userId: string;
  publicId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export async function createSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  const jwt = await new jose.SignJWT(payload as any)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  return jwt;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user;
}
