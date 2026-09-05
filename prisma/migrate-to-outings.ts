/**
 * Data migration: Group-centric → Outing-centric model.
 *
 * For each Group that has activities or expenses:
 *   1. Create an Outing named after the Group
 *   2. Create OutingParticipant for each GroupMember
 *   3. Point Activity.outingId to the new Outing
 *   4. Point Settlement.groupId → Settlement.outingId
 *   5. Point Expense.outingId to the new Outing
 *
 * Run: npx tsx prisma/migrate-to-outings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find groups that have activities, expenses, or settlements
  const groupsWithActivities = await prisma.activity.findMany({
    select: { groupId: true },
    distinct: ["groupId"],
  });
  const groupsWithExpenses = await prisma.expense.findMany({
    select: { groupId: true },
    distinct: ["groupId"],
  });
  const groupsWithSettlements = await prisma.settlement.findMany({
    where: { groupId: { not: null } },
    select: { groupId: true },
  });

  const groupIds = new Set([
    ...groupsWithActivities.map((a) => a.groupId),
    ...groupsWithExpenses.map((e) => e.groupId),
    ...groupsWithSettlements.map((s) => s.groupId).filter(Boolean) as string[],
  ]);

  console.log(`Found ${groupIds.size} groups with data to migrate`);

  for (const groupId of groupIds) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) continue;

    const activities = await prisma.activity.findMany({ where: { groupId } });
    const expenses = await prisma.expense.findMany({ where: { groupId } });
    const settlement = await prisma.settlement.findFirst({ where: { groupId } });

    console.log(`  Group "${group.name}" (${groupId}): ${activities.length} activities, ${expenses.length} expenses`);

    // 1. Create an Outing
    const outing = await prisma.outing.create({
      data: {
        groupId: group.id,
        name: group.name,
        description: group.description,
        status: group.status === "SETTLED" ? "SETTLED" : "ACTIVE",
        createdBy: group.ownerId,
      },
    });
    console.log(`    Created Outing: ${outing.id}`);

    // 2. Create OutingParticipant for each GroupMember
    for (const member of group.members) {
      await prisma.outingParticipant.create({
        data: {
          outingId: outing.id,
          userId: member.userId,
          role: member.role,
        },
      });
    }

    // 3. Point Activity.outingId to the new Outing
    if (activities.length > 0) {
      await prisma.activity.updateMany({
        where: { groupId },
        data: { outingId: outing.id },
      });
    }

    // 4. Point Settlement → Outing
    if (settlement) {
      await prisma.settlement.update({
        where: { id: settlement.id },
        data: { outingId: outing.id },
      });
    }

    // 5. Point Expense.outingId to the new Outing
    if (expenses.length > 0) {
      await prisma.expense.updateMany({
        where: { groupId },
        data: { outingId: outing.id },
      });
    }
  }

  console.log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
