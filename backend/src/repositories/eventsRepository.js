const { prisma } = require('../db/prismaClient');

async function getAllEvents() {
  const events = await prisma.event.findMany({
    orderBy: {
      startAt: 'asc',
    },
  });

  return events.map((event) => ({
    id: String(event.id),
    title: event.title,
    start: event.startAt.toISOString(),
    end: event.endAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  }));
}

async function createEvent({ title, start, end }) {
  const event = await prisma.event.create({
    data: {
      title,
      startAt: new Date(start),
      endAt: new Date(end),
    },
  });

  return {
    id: String(event.id),
    title: event.title,
    start: event.startAt.toISOString(),
    end: event.endAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  };
}

module.exports = {
  getAllEvents,
  createEvent,
};
