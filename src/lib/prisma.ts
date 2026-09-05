import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Enable WAL mode for SQLite for better concurrency
// Should be called once at startup
let walEnabled = false;
export async function enableWalMode() {
  if (walEnabled) return;
  try {
    // $queryRaw (not $executeRaw) because PRAGMA returns rows in SQLite
    await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON;");
    walEnabled = true;
  } catch (e) {
    console.warn("Failed to enable WAL mode", e);
  }
}

// Ensure data directory exists
import fs from "fs";
import path from "path";
export function ensureDataDir() {
  const dbUrl = process.env.DATABASE_URL || "file:./data/app.db";
  // Extract file path
  const match = dbUrl.match(/file:(.*)/);
  if (match) {
    const filePath = match[1].split("?")[0];
    // Resolve relative to cwd or absolute
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
