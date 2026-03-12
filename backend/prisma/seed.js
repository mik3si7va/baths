const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedEvents() {
  const title = 'Banho Rex';
  const startAt = new Date('2026-02-27T10:00:00.000Z');
  const endAt = new Date('2026-02-27T11:00:00.000Z');

  const exists = await prisma.event.findFirst({
    where: {
      title,
      startAt,
      endAt,
    },
  });

  if (exists) {
    return;
  }

  await prisma.event.create({
    data: {
      title,
      startAt,
      endAt,
    },
  });
}

async function main() {
  await seedEvents();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
