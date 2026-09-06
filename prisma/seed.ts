import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
function generatePublicUserId() { return `usr_${nanoid(6).toUpperCase()}`; }

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  // Admin user
  const adminExists = await prisma.user.findUnique({ where: { email: "admin@hesab.local" } });
  if (!adminExists) {
    const hash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        publicId: generatePublicUserId(),
        username: "admin",
        email: "admin@hesab.local",
        passwordHash: hash,
        displayName: "Admin",
        isAdmin: true,
      },
    });
    console.log("Created admin: admin@hesab.local / admin123");
  }

  // Demo group
  const admin = await prisma.user.findUnique({ where: { email: "admin@hesab.local" } });
  if (admin) {
    const group = await prisma.group.create({
      data: { name: "Demo Group", ownerId: admin.id, status: "PLANNING", publicToken: generatePublicUserId() },
    });
    await prisma.groupMember.create({ data: { groupId: group.id, userId: admin.id, role: "OWNER" } });
    console.log("Created demo group");
  }

  console.log("Seeding done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
