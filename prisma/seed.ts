import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
function generatePublicUserId() { return `usr_${nanoid(6).toUpperCase()}`; }

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  const hash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      publicId: generatePublicUserId(),
      username: "admin",
      passwordHash: hash,
      displayName: "Admin",
      isAdmin: true,
    },
  });
  console.log("Admin user ready — login with admin / admin123");

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