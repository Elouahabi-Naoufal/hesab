import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { creditWalletTx, deductWalletTx, auditLedger } from "./ledger";

// Real SQLite integration: temp file DB, schema pushed via `prisma db push`.
// Exercises the exact ledger helpers used by deposit/accept/refund actions.
const dir = mkdtempSync(join(tmpdir(), "hesab-ledger-test-"));
const DB_URL = `file:${join(dir, "test.db")}`;
let db: PrismaClient;

beforeAll(() => {
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: DB_URL },
    cwd: join(__dirname, "..", "..", ".."),
    stdio: "pipe",
  });
  db = new PrismaClient({ datasources: { db: { url: DB_URL } } });
}, 120000);

afterAll(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

async function makeUser(userId: string) {
  await db.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      publicId: `usr_${userId.toUpperCase().slice(0, 6)}`,
      username: `u_${userId}`,
      email: `${userId}@test.local`,
      passwordHash: "x",
      displayName: userId,
    },
  });
}

describe("Case D — deposit 1000 DH, contribute 500 DH", () => {
  it("wallet 1000 -> 500, member contribution recorded, ledger balances", async () => {
    const userId = "caseD-user";
    await makeUser(userId);
    await db.$transaction(async (tx) => {
      await creditWalletTx(tx, userId, 100000, { type: "DEPOSIT", description: "test deposit" });
    });
    await db.$transaction(async (tx) => {
      await deductWalletTx(tx, userId, 50000, { type: "CONTRIBUTION", description: "test contrib", groupId: "g1" });
    });
    const wallet = await db.wallet.findUnique({ where: { userId } });
    expect(wallet!.balance).toBe(50000);
    const sum = await db.walletTransaction.aggregate({ where: { walletId: wallet!.id }, _sum: { amount: true } });
    expect(sum._sum.amount).toBe(50000); // ledger == balance
    expect(await auditLedger(db)).toEqual([]);
  });
});

describe("Case E — 100 DH wallet, two concurrent 80 DH deducts", () => {
  it("exactly one succeeds, final balance 20 DH, no overdraft", async () => {
    const userId = "caseE-user";
    await makeUser(userId);
    await db.$transaction(async (tx) => {
      await creditWalletTx(tx, userId, 10000, { type: "DEPOSIT", description: "test deposit" });
    });
    const attempt = () =>
      db.$transaction(async (tx) => {
        await deductWalletTx(tx, userId, 8000, { type: "CONTRIBUTION", description: "race", groupId: "g2" });
        return "ok";
      });
    const results = await Promise.allSettled([attempt(), attempt()]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(String((failed[0] as PromiseRejectedResult).reason?.message || failed[0])).toMatch(/Insufficient wallet|database is locked|busy/i);
    const wallet = await db.wallet.findUnique({ where: { userId } });
    expect(wallet!.balance).toBe(2000); // 100 - 80, never -60
    expect(wallet!.balance).toBeGreaterThanOrEqual(0);
    expect(await auditLedger(db)).toEqual([]);
  });
});

describe("deposit validation + double-deduct protection", () => {
  it("rejects zero/negative credit", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await creditWalletTx(tx, "neg-user", 0, { type: "DEPOSIT", description: "x" });
      })
    ).rejects.toThrowError(/positive/);
    await expect(
      db.$transaction(async (tx) => {
        await creditWalletTx(tx, "neg-user", -100, { type: "DEPOSIT", description: "x" });
      })
    ).rejects.toThrowError(/positive/);
  });

  it("second identical deduct fails when funds are gone", async () => {
    const userId = "double-user";
    await makeUser(userId);
    await db.$transaction(async (tx) => {
      await creditWalletTx(tx, userId, 5000, { type: "DEPOSIT", description: "d" });
      await deductWalletTx(tx, userId, 5000, { type: "CONTRIBUTION", description: "c1", groupId: "g3" });
    });
    await expect(
      db.$transaction(async (tx) => {
        await deductWalletTx(tx, userId, 5000, { type: "CONTRIBUTION", description: "c2", groupId: "g3" });
      })
    ).rejects.toThrowError(/Insufficient wallet/);
    const wallet = await db.wallet.findUnique({ where: { userId } });
    expect(wallet!.balance).toBe(0);
    expect(await auditLedger(db)).toEqual([]);
  });
});
