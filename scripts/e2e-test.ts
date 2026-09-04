import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
const prisma = new PrismaClient();

function pub() { return `usr_${nanoid(6).toUpperCase()}`; }
function tok() { return nanoid(12); }

async function main() {
  console.log("=== E2E Test: Friday Pool Night ===");
  
  // Clean previous test data
  await prisma.settlementTransfer.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.expenseAllocation.deleteMany({});
  await prisma.expensePayment.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.activityMember.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.groupInvitation.deleteMany({});
  await prisma.activityEvent.deleteMany({});
  await prisma.group.deleteMany({ where: { name: "Friday Pool Night" } });
  await prisma.user.deleteMany({ where: { username: { in: ["naoufal_test", "mohamed_test", "yassine_test", "anour_test"] } } });

  // Create users
  const users = [];
  for (const [username, displayName, email] of [
    ["naoufal_test", "Naoufal", "naoufal_test@example.com"],
    ["mohamed_test", "Mohamed", "mohamed_test@example.com"],
    ["yassine_test", "Yassine", "yassine_test@example.com"],
    ["anour_test", "Anour", "anour_test@example.com"],
  ] as const) {
    const u = await prisma.user.create({
      data: {
        publicId: pub(),
        username,
        displayName,
        email,
        passwordHash: await bcrypt.hash("test123", 10),
      }
    });
    users.push(u);
    console.log(`Created user ${displayName} ${u.publicId}`);
  }
  const [naoufal, mohamed, yassine, anour] = users;

  // Create group by Naoufal
  const group = await prisma.group.create({
    data: {
      name: "Friday Pool Night",
      ownerId: naoufal.id,
      status: "PLANNING",
      publicToken: tok(),
    }
  });
  await prisma.groupMember.create({ data: { groupId: group.id, userId: naoufal.id, role: "OWNER", contribution: 10000 } });
  console.log(`Created group ${group.id}`);

  // Invite others
  for (const u of [mohamed, yassine, anour]) {
    const inv = await prisma.groupInvitation.create({
      data: {
        groupId: group.id,
        inviterId: naoufal.id,
        inviteePublicId: u.publicId,
        inviteeUserId: u.id,
        status: "PENDING",
        suggestedContribution: u.username.includes("yassine") ? 8000 : u.username.includes("anour") ? 7000 : 10000,
      }
    });
    // Accept
    await prisma.groupInvitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED" } });
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: u.id,
        role: "MEMBER",
        contribution: inv.suggestedContribution,
      }
    });
    console.log(`Invited and accepted ${u.displayName}`);
  }

  await prisma.group.update({ where: { id: group.id }, data: { status: "ACTIVE" } });

  // Create activities
  const table1 = await prisma.activity.create({
    data: { groupId: group.id, name: "Table 1", createdBy: naoufal.id }
  });
  for (const uid of [naoufal.id, mohamed.id, yassine.id]) {
    await prisma.activityMember.create({ data: { activityId: table1.id, userId: uid } });
  }
  console.log("Created Table 1");

  const table2 = await prisma.activity.create({
    data: { groupId: group.id, name: "Table 2", createdBy: naoufal.id }
  });
  for (const uid of [yassine.id, anour.id]) {
    await prisma.activityMember.create({ data: { activityId: table2.id, userId: uid } });
  }
  console.log("Created Table 2");

  // Expenses
  // Table1: 120 DH, paid by Naoufal, equal among 3
  const exp1 = await prisma.expense.create({
    data: {
      groupId: group.id,
      activityId: table1.id,
      description: "Pool Table 1",
      quantity: 1,
      unitPriceCentimes: 12000,
      totalCentimes: 12000,
      allocationMode: "EQUAL",
      createdBy: naoufal.id,
    }
  });
  for (const [uid, amt] of [[naoufal.id, 4000], [mohamed.id, 4000], [yassine.id, 4000]] as const) {
    await prisma.expenseAllocation.create({ data: { expenseId: exp1.id, userId: uid, amountCentimes: amt } });
  }
  await prisma.expensePayment.create({ data: { expenseId: exp1.id, userId: naoufal.id, amountCentimes: 12000 } });
  console.log("Created expense Table 1 120 DH");

  // Table2: 60 DH, paid by Yassine, equal among 2
  const exp2 = await prisma.expense.create({
    data: {
      groupId: group.id,
      activityId: table2.id,
      description: "Pool Table 2",
      quantity: 1,
      unitPriceCentimes: 6000,
      totalCentimes: 6000,
      allocationMode: "EQUAL",
      createdBy: naoufal.id,
    }
  });
  for (const [uid, amt] of [[yassine.id, 3000], [anour.id, 3000]] as const) {
    await prisma.expenseAllocation.create({ data: { expenseId: exp2.id, userId: uid, amountCentimes: amt } });
  }
  await prisma.expensePayment.create({ data: { expenseId: exp2.id, userId: yassine.id, amountCentimes: 6000 } });
  console.log("Created expense Table 2 60 DH");

  // Drinks: 40 DH, paid by Mohamed, equal among 4
  const exp3 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Drinks",
      quantity: 1,
      unitPriceCentimes: 4000,
      totalCentimes: 4000,
      allocationMode: "EQUAL",
      createdBy: naoufal.id,
    }
  });
  for (const uid of [naoufal.id, mohamed.id, yassine.id, anour.id]) {
    await prisma.expenseAllocation.create({ data: { expenseId: exp3.id, userId: uid, amountCentimes: 1000 } });
  }
  await prisma.expensePayment.create({ data: { expenseId: exp3.id, userId: mohamed.id, amountCentimes: 4000 } });
  console.log("Created expense Drinks 40 DH");

  // Calculate settlement via domain
  const { calculateSettlement } = await import("../src/domain/settlement");
  const members = await prisma.groupMember.findMany({ where: { groupId: group.id }, include: { user: true } });
  const expenses = await prisma.expense.findMany({ where: { groupId: group.id }, include: { allocations: true, payments: true } });
  const memberInput = members.map(m => ({ userId: m.userId, displayName: m.user.displayName }));
  const expenseInput = expenses.map(e => ({
    id: e.id,
    totalCentimes: e.totalCentimes,
    allocations: e.allocations.map(a => ({ userId: a.userId, amountCentimes: a.amountCentimes })),
    payments: e.payments.map(p => ({ userId: p.userId, amountCentimes: p.amountCentimes })),
  }));
  
  const result = calculateSettlement({ members: memberInput, expenses: expenseInput });
  console.log("\n=== Settlement Result ===");
  console.log(`Total expenses: ${result.totalExpenses / 100} DH`);
  console.log("Balances:");
  for (const b of result.memberBalances) {
    console.log(`  ${b.displayName}: paid ${b.totalPaid/100}, resp ${b.totalResponsibility/100}, balance ${b.netBalance/100}`);
  }
  console.log("Transfers:");
  for (const t of result.transfers) {
    const from = members.find(m => m.userId === t.fromUserId)?.user.displayName;
    const to = members.find(m => m.userId === t.toUserId)?.user.displayName;
    console.log(`  ${from} → ${to}: ${t.amountCentimes/100} DH`);
  }

  // Expected checks
  const naoufalBal = result.memberBalances.find(b => b.userId === naoufal.id)!;
  const mohamedBal = result.memberBalances.find(b => b.userId === mohamed.id)!;
  const yassineBal = result.memberBalances.find(b => b.userId === yassine.id)!;
  const anourBal = result.memberBalances.find(b => b.userId === anour.id)!;

  let ok = true;
  if (naoufalBal.totalResponsibility !== 5000) { console.error("FAIL naoufal resp", naoufalBal.totalResponsibility); ok=false; }
  if (mohamedBal.totalResponsibility !== 5000) { console.error("FAIL mohamed resp"); ok=false; }
  if (yassineBal.totalResponsibility !== 8000) { console.error("FAIL yassine resp"); ok=false; }
  if (anourBal.totalResponsibility !== 4000) { console.error("FAIL anour resp"); ok=false; }

  if (naoufalBal.netBalance !== 7000) { console.error("FAIL naoufal bal"); ok=false; }
  if (mohamedBal.netBalance !== -1000) { console.error("FAIL mohamed bal"); ok=false; }
  if (yassineBal.netBalance !== -2000) { console.error("FAIL yassine bal"); ok=false; }
  if (anourBal.netBalance !== -4000) { console.error("FAIL anour bal"); ok=false; }

  const hasAnourToNaoufal = result.transfers.some(t => t.fromUserId === anour.id && t.toUserId === naoufal.id && t.amountCentimes === 4000);
  const hasYassineToNaoufal = result.transfers.some(t => t.fromUserId === yassine.id && t.toUserId === naoufal.id && t.amountCentimes === 2000);
  const hasMohamedToNaoufal = result.transfers.some(t => t.fromUserId === mohamed.id && t.toUserId === naoufal.id && t.amountCentimes === 1000);
  if (!hasAnourToNaoufal || !hasYassineToNaoufal || !hasMohamedToNaoufal) {
    console.error("FAIL transfers mismatch");
    ok=false;
  }

  if (ok) {
    console.log("\n✓ All E2E checks PASSED");
  } else {
    console.log("\n✗ E2E checks FAILED");
    process.exit(1);
  }

  // Test persistence via settlement table
  const { generatePublicToken } = await import("../src/lib/utils");
  const settlement = await prisma.settlement.create({
    data: {
      groupId: group.id,
      totalExpenses: result.totalExpenses,
      totalPaid: result.totalPaid,
      totalContributions: 35000,
      publicToken: generatePublicToken(),
    }
  });
  for (const t of result.transfers) {
    await prisma.settlementTransfer.create({
      data: {
        settlementId: settlement.id,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amountCentimes: t.amountCentimes,
        status: "PENDING",
      }
    });
  }
  console.log(`\nPersisted settlement ${settlement.id} with ${result.transfers.length} transfers`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
