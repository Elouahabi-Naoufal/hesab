import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
function generatePublicUserId() { return `usr_${nanoid(6).toUpperCase()}`; }

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  // Categories
  const poolCat = await prisma.productCategory.upsert({
    where: { name: "Pool" },
    update: {},
    create: { name: "Pool" },
  });
  const foodCat = await prisma.productCategory.upsert({
    where: { name: "Food & Drinks" },
    update: {},
    create: { name: "Food & Drinks" },
  });
  const transportCat = await prisma.productCategory.upsert({
    where: { name: "Transport" },
    update: {},
    create: { name: "Transport" },
  });

  // Products
  await prisma.product.upsert({
    where: { id: "prod_pool_table" },
    update: {},
    create: { id: "prod_pool_table", name: "Pool Table", categoryId: poolCat.id, defaultPriceCentimes: 6000, unit: "hour", active: true },
  });
  await prisma.product.upsert({
    where: { id: "prod_coca" },
    update: {},
    create: { id: "prod_coca", name: "Coca-Cola", categoryId: foodCat.id, defaultPriceCentimes: 1500, unit: "unit", active: true },
  });
  await prisma.product.upsert({
    where: { id: "prod_water" },
    update: {},
    create: { id: "prod_water", name: "Water", categoryId: foodCat.id, defaultPriceCentimes: 1000, unit: "unit", active: true },
  });
  await prisma.product.upsert({
    where: { id: "prod_pizza" },
    update: {},
    create: { id: "prod_pizza", name: "Pizza", categoryId: foodCat.id, defaultPriceCentimes: 8000, unit: "unit", active: true },
  });
  await prisma.product.upsert({
    where: { id: "prod_taxi" },
    update: {},
    create: { id: "prod_taxi", name: "Taxi", categoryId: transportCat.id, defaultPriceCentimes: 5000, unit: "ride", active: true },
  });

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
