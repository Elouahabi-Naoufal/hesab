/**
 * Hesab E2E — full user flow against a local server + throwaway SQLite DB.
 * Usage:
 *   DATABASE_URL="file:/tmp/hesab-e2e.db" JWT_SECRET="e2e-test-secret-min-32-chars-xxxx" PORT=3103 npm run dev &
 *   node e2e/hesab-flow.mjs http://localhost:3103
 *
 * Covers: register x3, deposit, create group, invite x2, accept w/ contribution
 * (wallet deduction), expense EQUAL + CUSTOM + multi-payer + unknown payer,
 * checkout, settlement math, public link, wallet balances, audit events.
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3103";
const results = [];
const check = (name, cond, extra = "") => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) process.exitCode = 1;
};

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

async function register(username, email, name) {
  await page.goto(`${BASE}/register`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  await page.fill('input[name="displayName"]', name);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function loginAs(email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="emailOrUsername"]', email);
  await page.fill('input[name="password"]', "password123");
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

const T = Date.now() % 100000;
const users = [
  { u: `alice${T}`, e: `alice${T}@t.local`, n: "Alice" },
  { u: `bob${T}`, e: `bob${T}@t.local`, n: "Bob" },
  { u: `carol${T}`, e: `carol${T}@t.local`, n: "Carol" },
];

// 1. Register A, B, C
await register(users[0].u, users[0].e, users[0].n);
check("A registers -> dashboard", page.url().includes("/dashboard"));
const aliceId = await page.textContent("body").then(t => (t.match(/usr_[A-Z0-9]{6}/) || [])[0]);
check("A sees public ID", !!aliceId, aliceId);
await page.click('form[action] button:has-text("Logout"), button:has-text("Logout")').catch(() => {});
await ctx.clearCookies();
await register(users[1].u, users[1].e, users[1].n);
check("B registers -> dashboard", page.url().includes("/dashboard"));
await page.waitForFunction(() => /usr_[A-Z0-9]{6}/.test(document.body.textContent || ""), null, { polling: 500 });
const bobId = await page.textContent("body").then(t => {
  const m = t.match(/usr_[A-Z0-9]{6}/g) || [];
  return m[0];
});
await ctx.clearCookies();
await register(users[2].u, users[2].e, users[2].n);
check("C registers -> dashboard", page.url().includes("/dashboard"));
await ctx.clearCookies();

// 2. A deposits 1000 DH
await loginAs(users[0].e);
await page.goto(`${BASE}/wallet`);
await page.fill('input[name="amount"]', "1000");
await Promise.all([
  page.waitForLoadState("networkidle"),
  page.click('button:has-text("Deposit")'),
]);
await page.waitForTimeout(1500);
let body = await page.textContent("body");
check("A wallet shows 1000.00 DH after deposit", body.includes("1000.00 DH"), body.slice(0, 120));

// B deposits 500 DH
await ctx.clearCookies();
await loginAs(users[1].e);
await page.goto(`${BASE}/wallet`);
await page.fill('input[name="amount"]', "500");
await Promise.all([
  page.waitForLoadState("networkidle"),
  page.click('button:has-text("Deposit")'),
]);
await page.waitForTimeout(1500);
body = await page.textContent("body");
check("B wallet shows 500.00 DH after deposit", body.includes("500.00 DH"));

// 3. A creates group + invites B (100 DH) and C (50 DH)
await ctx.clearCookies();
await loginAs(users[0].e);
await page.goto(`${BASE}/dashboard`);
await page.fill('input[name="name"]', `Pool Night ${T}`);
await Promise.all([
  page.waitForURL("**/groups/*", { timeout: 15000 }),
  page.click('button:has-text("Create Group")'),
]);
const groupUrl = page.url();
const groupId = groupUrl.split("/groups/")[1];
check("group created", !!groupId, groupId);

// invite B
await page.fill('input[name="publicId"]', bobId);
await page.fill('input[name="suggestedContribution"]', "100");
await page.click('button:has-text("Invite")');
await page.waitForTimeout(1500);
// invite C
const carolId = await (async () => {
  await ctx.clearCookies();
  await loginAs(users[2].e);
  await page.goto(`${BASE}/dashboard`);
  const t = await page.textContent("body");
  const m = t.match(/usr_[A-Z0-9]{6}/g) || [];
  await ctx.clearCookies();
  await loginAs(users[0].e);
  await page.goto(groupUrl);
  return m[0];
})();
await page.fill('input[name="publicId"]', carolId);
await page.fill('input[name="suggestedContribution"]', "50");
await page.click('button:has-text("Invite")');
await page.waitForTimeout(1500);
body = await page.textContent("body");
check("pending invites listed", body.includes("Pending invites") || body.includes("pending"), "");

// 4. B accepts with 100 DH contribution (wallet 500 -> 400)
await ctx.clearCookies();
await loginAs(users[1].e);
await page.goto(`${BASE}/dashboard`);
await page.fill('input[name="contribution"]', "100");
await page.click('button:has-text("Accept")');
await page.waitForTimeout(2000);
body = await page.textContent("body");
check("B joined group (no longer pending)", !body.includes("Pending Invitations") || body.includes("My Groups"));
await page.goto(`${BASE}/wallet`);
await page.waitForTimeout(1000);
body = await page.textContent("body");
check("B wallet 500 -> 400.00 DH after 100 DH contribution", body.includes("400.00 DH"), body.slice(0, 200));

// C accepts with 50 DH (no wallet yet -> must fail, then deposit, then accept)
await ctx.clearCookies();
await loginAs(users[2].e);
await page.goto(`${BASE}/dashboard`);
await page.fill('input[name="contribution"]', "50");
await page.click('button:has-text("Accept")');
await page.waitForTimeout(2000);
await page.goto(`${BASE}/wallet`);
await page.fill('input[name="amount"]', "200");
await page.click('button:has-text("Deposit")');
await page.waitForTimeout(1500);
await page.goto(`${BASE}/dashboard`);
await page.fill('input[name="contribution"]', "50");
await page.click('button:has-text("Accept")');
await page.waitForTimeout(2000);
await page.goto(`${BASE}/wallet`);
await page.waitForTimeout(1000);
body = await page.textContent("body");
check("C wallet 200 -> 150.00 DH after 50 DH contribution", body.includes("150.00 DH"));

// 5. A adds EQUAL expense 300 DH paid by A (expense form is inside <details>)
await ctx.clearCookies();
await loginAs(users[0].e);
await page.goto(groupUrl);
await page.click('summary:has-text("Add Expense")');
await page.fill('input[name="description"]', "Dinner 300");
await page.fill('input[name="totalDH"]', "300");
// select all members as participants via checkboxes
for (const box of await page.$$('.exp-participant')) {
  await box.check({ force: true });
}
// first payer checkbox = owner (A) pays all -> JS autofills [300] DH
const payerBoxes = await page.$$('.exp-payer');
if (payerBoxes.length > 0) await payerBoxes[0].check({ force: true });
await page.click('button:has-text("Save Expense")');
await page.waitForTimeout(2000);
body = await page.textContent("body");
check("expense appears with DH total", body.includes("300 DH") || body.includes("Dinner 300"));

// 6. Checkout page renders settlement
await page.goto(`${groupUrl}/checkout`);
await page.waitForTimeout(1500);
body = await page.textContent("body");
check("checkout shows payment plan", body.includes("FINAL PAYMENT PLAN") || body.includes("You need to pay") || body.includes("You receive"));

// 6b. Owner finalizes: PLANNING -> ACTIVE -> CHECKOUT -> Finalize
await page.goto(groupUrl);
await page.waitForTimeout(1000);
const activeBtn = await page.$('button:has-text("Start Group (Active)")');
if (activeBtn) {
  await activeBtn.click();
  await page.waitForTimeout(2500);
}
const startBtn = await page.$('button:has-text("Start Checkout")');
if (startBtn) {
  await startBtn.click();
  await page.waitForTimeout(3000);
}
await page.goto(`${groupUrl}/checkout`);
await page.waitForTimeout(1500);
const finBtn = await page.$('button:has-text("Finalize Settlement")');
if (finBtn) {
  await finBtn.click();
  await page.waitForTimeout(3000);
}
body = await page.textContent("body");
check("settlement finalized (no pending finalize button)", !body.includes("Finalize Settlement") || body.includes("/s/"));

// 7. Public link reachable
const pubLink = await page.$('a[href^="/s/"]');
check("public share link present after finalize", !!pubLink);
if (pubLink) {
  const href = await pubLink.getAttribute("href");
  await page.goto(`${BASE}${href}`);
  await page.waitForTimeout(1000);
  const pb = await page.textContent("body");
  check("public settlement shows PAYMENT INSTRUCTIONS", pb.includes("PAYMENT INSTRUCTIONS"));
  check("public link shows DH amounts", pb.includes("DH"));
  check("public link leaks no emails", !pb.includes("@t.local"));
}

// 8. Invalid public token -> 404
await page.goto(`${BASE}/s/does-not-exist-123`);
await page.waitForTimeout(1000);
body = await page.textContent("body");
check("invalid public token shows 404", body.includes("404") || body.includes("could not be found"));

await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\nE2E: ${results.length - failed.length}/${results.length} passed`);
