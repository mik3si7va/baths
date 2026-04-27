const { criarReservasParaServicos } = require('../../services/reservas');
const { resolverOpcao } = require('../../utils/utilsWorker');
const { subscribeWorker } = require('../../utils/subscribeWorker');
const { debug } = require('../../utils/logger');
const prisma = require('../../utils/db');

module.exports = (client) => {
    subscribeWorker(client, {
        topic: 'criar-reservas-temporarias-opcao',
        handler: async ({ task, vars }) => {
            const opcao = resolverOpcao(task);
            const servicos = opcao?.servicos || [];

            // Carregar nomes em batch para os logs — uma query por tipo de recurso
            const funcIds = [...new Set(servicos.map(s => s.funcionarioId).filter(Boolean))];
            const salaIds = [...new Set(servicos.map(s => s.salaId).filter(Boolean))];

            const [funcs, salas] = await Promise.all([
                prisma.funcionario.findMany({
                    where: { id: { in: funcIds } },
                    include: { utilizador: { select: { nome: true } } },
                }),
                prisma.sala.findMany({
                    where: { id: { in: salaIds } },
                    select: { id: true, nome: true },
                }),
            ]);

            const nomeFuncionario = (id) => funcs.find(f => f.id === id)?.utilizador?.nome ?? id;
            const nomeSala = (id) => salas.find(s => s.id === id)?.nome ?? id;

            debug('criar-reservas-temporarias-opcao', `A reservar ${servicos.length} serviço(s) para opção ${opcao?.dataHoraInicio?.slice(11, 16) ?? '?'}`);
            servicos.forEach((s, i) => {
                const ini = s.dataHoraInicio?.slice(11, 16) ?? '?';
                const fim = s.dataHoraFim?.slice(11, 16) ?? '?';
                debug('criar-reservas-temporarias-opcao', `  [${i + 1}] ${ini}→${fim} | ${nomeFuncionario(s.funcionarioId)} / ${nomeSala(s.salaId)}`);
            });

            const idsReservas = await criarReservasParaServicos(servicos, task.processInstanceId);

            vars.set('subProcessInstanceId', task.processInstanceId);
            vars.set('reservasTemporariasIds', JSON.stringify(idsReservas));

            return `✓ ${idsReservas.length} reservas temporárias criadas`;
        },
    });
};