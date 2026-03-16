const { getAllSalas, createSala, addServicoToSala, getServicosBySala, removeServicoFromSala } = require('../repositories/repositorioSalas');
const { prisma } = require('../db/prismaClient');

describe('Gestão de Salas - Testes Unitários', () => {

    afterAll(async () => {
        await prisma.$disconnect();
    });

    test('getAllSalas retorna uma lista de salas', async () => {
        const salas = await getAllSalas();
        expect(Array.isArray(salas)).toBe(true);
    });

    test('getAllSalas retorna apenas salas ativas', async () => {
        const salas = await getAllSalas();
        salas.forEach(sala => {
            expect(sala.ativo).toBe(true);
        });
    });

    test('createSala cria uma sala com os dados correctos', async () => {
        const novaSala = await createSala({
            nome: 'Sala Teste Jest',
            capacidade: 1,
            equipamento: 'Equipamento de teste',
            precoHora: 10,
        });

        expect(novaSala.nome).toBe('Sala Teste Jest');
        expect(novaSala.capacidade).toBe(1);
        expect(novaSala.equipamento).toBe('Equipamento de teste');
        expect(novaSala.precoHora).toBe(10);
        expect(novaSala.ativo).toBe(true);

        await prisma.sala.delete({ where: { id: novaSala.id } });
    });

    test('createSala falha se o nome já existir', async () => {
        await expect(createSala({
            nome: 'Sala de Banho 1',
            capacidade: 1,
            equipamento: 'Teste duplicado',
            precoHora: 10,
        })).rejects.toThrow();
    });

    test('addServicoToSala associa um serviço a uma sala', async () => {
        const sala = await createSala({
            nome: 'Sala Teste Servico',
            capacidade: 1,
            equipamento: 'Teste',
            precoHora: 10,
        });

        const servico = await prisma.tipoServico.findFirst();

        const associacao = await addServicoToSala({
            salaId: sala.id,
            tipoServicoId: servico.id,
        });

        expect(associacao.salaId).toBe(sala.id);
        expect(associacao.tipoServicoId).toBe(servico.id);

        await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
        await prisma.sala.delete({ where: { id: sala.id } });
    });

    test('getServicosBySala retorna serviços associados à sala', async () => {
        const sala = await createSala({
            nome: 'Sala Teste GetServicos',
            capacidade: 1,
            equipamento: 'Teste',
            precoHora: 10,
        });

        const servico = await prisma.tipoServico.findFirst();
        await addServicoToSala({ salaId: sala.id, tipoServicoId: servico.id });

        const servicos = await getServicosBySala(sala.id);
        expect(Array.isArray(servicos)).toBe(true);
        expect(servicos.length).toBe(1);
        expect(servicos[0].tipoServicoId).toBe(servico.id);

        await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
        await prisma.sala.delete({ where: { id: sala.id } });
    });

    test('removeServicoFromSala remove a associação correctamente', async () => {
        const sala = await createSala({
            nome: 'Sala Teste RemoveServico',
            capacidade: 1,
            equipamento: 'Teste',
            precoHora: 10,
        });

        const servico = await prisma.tipoServico.findFirst();
        await addServicoToSala({ salaId: sala.id, tipoServicoId: servico.id });

        const resultado = await removeServicoFromSala({
            salaId: sala.id,
            tipoServicoId: servico.id,
        });

        expect(resultado.removed).toBe(true);

        await prisma.sala.delete({ where: { id: sala.id } });
    });

});