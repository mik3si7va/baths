const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function closePrisma() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  closePrisma,
};
