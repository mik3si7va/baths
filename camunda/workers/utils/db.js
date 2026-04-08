const { PrismaClient } = require('../../../backend/node_modules/.prisma/client');
const { log } = require('./logger');

let prismaInstance = null;

function getPrismaClient() {
    if (!prismaInstance) {
        prismaInstance = new PrismaClient({
            log: [
                { emit: 'stdout', level: 'error' },
                { emit: 'stdout', level: 'warn' },
                ...(process.env.NODE_ENV === 'development' ? [{ emit: 'stdout', level: 'query' }] : []),
            ],
        });

        log('DB', 'Prisma Client inicializado com sucesso', 'success');
    }
    return prismaInstance;
}

process.on('beforeExit', async () => {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        log('DB', 'Prisma Client desconectado', 'info');
    }
});

module.exports = getPrismaClient();