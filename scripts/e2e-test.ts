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
  await prisma.correctionRequest.deleteMany({});
  await prisma.lineItem.deleteMany({});
  await prisma.activityPayment.deleteMany({});
  await prisma.usageConfirmation.deleteMany({});
  await prisma.usageParticipant.deleteMany({});
  await prisma.usageRecord.deleteMany({});
  await prisma.activityProduct.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.outingInvitation.deleteMany({});
  await prisma.outingParticipant.deleteMany({});
  await prisma.outing.deleteMany({});
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

  // Create group
  const group = await prisma.group.create({
    data: {
      name: "Friday Pool Night",
      ownerId: naoufal.id,
      status: "PLANNING",
      publicToken: tok(),
    }
  });
  await prisma.groupMember.create({ data: { groupId: group.id, userId: naoufal.id, role: "OWNER", contribution: 10000 } });

  // Invite others
  for (const u of [mohamed, yassine, anour]) {
    const inv = await prisma.groupInvitation.create({
      data: {
        groupId: group.id,
        inviterId: naoufal.id,
        inviteePublicId: u.publicId,
        inviteeUserId: u.id,
        status: "PENDING",
        suggestedContribution: 10000,
      }
    });
    await prisma.groupInvitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED" } });
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: u.id, role: "MEMBER", contribution: 10000 }
    });
    console.log(`Invited and accepted ${u.displayName}`);
  }

  // Create outing
  const outing = await prisma.outing.create({
    data: {
      groupId: group.id,
      name: "Friday Pool Night",
      status: "ACTIVE",
      createdBy: naoufal.id,
    }
  });

  // Create outing participants
  for (const u of [naoufal, mohamed, yassine, anour]) {
    await prisma.outingParticipant.create({
      data: { outingId: outing.id, userId: u.id, role: u.id === naoufal.id ? "OWNER" : "MEMBER" }
    });
  }
  console.log(`Created outing ${outing.id}`);

  // === Activity 1: Pool (FIXED pricing) ===
  const poolActivity = await prisma.activity.create({
    data: { outingId: outing.id, name: "Pool", pricingModel: "FIXED", createdBy: naoufal.id }
  });

  // Pool table product: 5 DH per game
  const poolProduct = await prisma.activityProduct.create({
    data: { activityId: poolActivity.id, name: "Pool Table", unit: "game", pricePerUnitCt: 500 }
  });

  // Usage: A+B play 5 games = 25 DH
  const usage1 = await prisma.usageRecord.create({
    data: { activityId: poolActivity.id, productId: poolProduct.id, quantity: 5, totalCentimes: 2500, createdById: naoufal.id, status: "CONFIRMED" }
  });
  for (const uid of [naoufal.id, mohamed.id]) {
    await prisma.usageParticipant.create({ data: { usageRecordId: usage1.id, userId: uid } });
    await prisma.usageConfirmation.create({ data: { usageRecordId: usage1.id, userId: uid, status: "CONFIRMED" } });
  }

  // Usage: C+D play 3 games = 15 DH
  const usage2 = await prisma.usageRecord.create({
    data: { activityId: poolActivity.id, productId: poolProduct.id, quantity: 3, totalCentimes: 1500, createdById: naoufal.id, status: "CONFIRMED" }
  });
  for (const uid of [yassine.id, anour.id]) {
    await prisma.usageParticipant.create({ data: { usageRecordId: usage2.id, userId: uid } });
    await prisma.usageConfirmation.create({ data: { usageRecordId: usage2.id, userId: uid, status: "CONFIRMED" } });
  }

  // Payment: Naoufal paid 40 DH for pool
  await prisma.activityPayment.create({
    data: { activityId: poolActivity.id, userId: naoufal.id, amountCentimes: 4000 }
  });

  // Close pool activity
  await prisma.activity.update({ where: { id: poolActivity.id }, data: { status: "CLOSED", endTime: new Date() } });
  console.log("Created Pool activity: A+B 5 games, C+D 3 games, paid by Naoufal 40 DH");

  // === Activity 2: Restaurant (VARIABLE pricing) ===
  const foodActivity = await prisma.activity.create({
    data: { outingId: outing.id, name: "Restaurant", pricingModel: "VARIABLE", createdBy: naoufal.id }
  });

  // Line items (each person's order)
  await prisma.lineItem.create({ data: { activityId: foodActivity.id, userId: naoufal.id, description: "Burger", priceCentimes: 4000 } });
  await prisma.lineItem.create({ data: { activityId: foodActivity.id, userId: naoufal.id, description: "Drink", priceCentimes: 1000 } });
  await prisma.lineItem.create({ data: { activityId: foodActivity.id, userId: mohamed.id, description: "Pizza", priceCentimes: 5000 } });
  await prisma.lineItem.create({ data: { activityId: foodActivity.id, userId: yassine.id, description: "Salad", priceCentimes: 3500 } });
  await prisma.lineItem.create({ data: { activityId: foodActivity.id, userId: anour.id, description: "Pasta", priceCentimes: 4500 } });

  // Payment: Yassine paid 180 DH for everyone
  await prisma.activityPayment.create({
    data: { activityId: foodActivity.id, userId: yassine.id, amountCentimes: 18000 }
  });

  await prisma.activity.update({ where: { id: foodActivity.id }, data: { status: "CLOSED", endTime: new Date() } });
  console.log("Created Restaurant: A=50, B=50, C=35, D=45, paid by Yassine 180 DH");

  // === Activity 3: InDrive (VARIABLE pricing) ===
  const rideActivity = await prisma.activity.create({
    data: { outingId: outing.id, name: "InDrive", pricingModel: "VARIABLE", createdBy: naoufal.id }
  });

  // Equal split: 40 DH / 4 = 10 DH each
  for (const uid of [naoufal.id, mohamed.id, yassine.id, anour.id]) {
    await prisma.lineItem.create({ data: { activityId: rideActivity.id, userId: uid, description: "Ride share", priceCentimes: 1000 } });
  }

  // Payment: Anour paid 40 DH
  await prisma.activityPayment.create({
    data: { activityId: rideActivity.id, userId: anour.id, amountCentimes: 4000 }
  });

  await prisma.activity.update({ where: { id: rideActivity.id }, data: { status: "CLOSED", endTime: new Date() } });
  console.log("Created InDrive: 10 DH each, paid by Anour 40 DH");

  // === Calculate settlement ===
  const { calculateSettlement } = await import("../src/domain/settlement");
  const participants = await prisma.outingParticipant.findMany({ where: { outingId: outing.id }, include: { user: true } });
  const activities = await prisma.activity.findMany({
    where: { outingId: outing.id },
    include: { usageRecords: { include: { participants: true } }, lineItems: true, payments: true },
  });
  const memberInput = participants.map(p => ({ userId: p.userId, displayName: p.user.displayName }));
  const activityInput = activities.map(a => ({
    id: a.id,
    name: a.name,
    pricingModel: a.pricingModel as "FIXED" | "VARIABLE",
    status: a.status,
    usageRecords: a.usageRecords.map(r => ({
      id: r.id,
      totalCentimes: r.totalCentimes,
      status: r.status,
      participantIds: r.participants.map(p => p.userId),
    })),
    lineItems: a.lineItems.map(l => ({ userId: l.userId, priceCentimes: l.priceCentimes })),
    payments: a.payments.map(p => ({ userId: p.userId, amountCentimes: p.amountCentimes })),
  }));

  const result = calculateSettlement({ members: memberInput, activities: activityInput });

  console.log("\n=== Settlement Result ===");
  console.log(`Total expenses: ${result.totalExpenses / 100} DH`);
  console.log(`Total paid: ${result.totalPaid / 100} DH`);
  console.log(`Complete: ${result.isComplete}`);
  console.log("Balances:");
  for (const b of result.memberBalances) {
    const name = participants.find(p => p.userId === b.userId)?.user.displayName || b.userId;
    console.log(`  ${name}: paid ${b.totalPaid/100} DH, responsible ${b.totalResponsibility/100} DH, net ${b.netBalance >= 0 ? '+' : ''}${b.netBalance/100} DH`);
  }
  console.log("Transfers:");
  for (const t of result.transfers) {
    const from = participants.find(p => p.userId === t.fromUserId)?.user.displayName;
    const to = participants.find(p => p.userId === t.toUserId)?.user.displayName;
    console.log(`  ${from} → ${to}: ${t.amountCentimes/100} DH`);
  }

  // Verify invariants
  const allZero = result.memberBalances.every(b => {
    const sim = b.netBalance;
    return true; // will check via transfers
  });
  const positiveSum = result.memberBalances.filter(b => b.netBalance > 0).reduce((s, b) => s + b.netBalance, 0);
  const negativeSum = result.memberBalances.filter(b => b.netBalance < 0).reduce((s, b) => s + Math.abs(b.netBalance), 0);

  if (result.isComplete) {
    console.log(`\nInvariant check: positive sum ${positiveSum/100} DH == negative sum ${negativeSum/100} DH: ${positiveSum === negativeSum ? "PASS" : "FAIL"}`);
  } else {
    console.log(`\nSettlement is incomplete (unrecorded: ${result.totalUnrecorded/100} DH)`);
  }

  console.log("\n=== E2E Test Complete ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
