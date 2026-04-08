const prisma = require('../utils/db');
const { log } = require('../utils/logger');

const TOPIC = 'agendamentos';

/* ====================== FUNÇÕES PARA WORKERS ====================== */

async function obterPrecoEDuracao(tipoServicoId, porteAnimal = 'PEQUENO') {
    if (!tipoServicoId) throw new Error('tipoServicoId é obrigatório');

    log(TOPIC, `Procurar preço para tipoServicoId=${tipoServicoId} | porte=${porteAnimal}`, 'info');

    // O preço e duração estão em RegraPreco, não em TipoServico
    const regra = await prisma.regraPreco.findFirst({
        where: { tipoServicoId, porteAnimal },
        include: { tipoServico: { select: { tipo: true } } },
    });

    if (!regra) {
        throw new Error(`Regra de preço não encontrada para serviço ${tipoServicoId} e porte ${porteAnimal}`);
    }

    const preco = Number(regra.precoBase);
    const duracao = regra.duracaoMinutos;
    const nome = regra.tipoServico.tipo;

    log(TOPIC, `✓ ${nome} → ${preco}€ | ${duracao}min`, 'success');

    return { preco, duracao, nome };
}

async function adicionarServicoLista(servicoTemp) {
    if (!servicoTemp?.tipoServicoId) throw new Error('servicoTemp com tipoServicoId é obrigatório');

    log(TOPIC, `Adicionando serviço ${servicoTemp.tipoServicoId} à lista`, 'info');

    const servicoAdicionado = {
        tipoServicoId: servicoTemp.tipoServicoId,
        precoBase: Number(servicoTemp.precoBase || 0),
        duracaoMinutos: Number(servicoTemp.duracaoMinutos || 30),
        nome: servicoTemp.nome || 'Serviço',
        ordem: servicoTemp.ordem || null,
    };

    return { servicosActualizados: [servicoAdicionado], servicoAdicionado };
}

async function montarResumo({ servicosActualizados = [], opcaoSelecionada = {}, animalId, clienteNome }) {
    const servicosFormatados = servicosActualizados.map((s, i) => ({
        ordem: s.ordem || i + 1,
        nome: s.nome || `Serviço ${s.tipoServicoId}`,
        preco: Number(s.precoBase || 0),
        duracao: Number(s.duracaoMinutos || 0),
    }));

    const duracaoTotal = servicosFormatados.reduce((sum, s) => sum + s.duracao, 0);
    const valorEstimado = servicosFormatados.reduce((sum, s) => sum + s.preco, 0);

    const resumo = {
        animalId,
        clienteNome: clienteNome || 'Cliente',
        servicos: servicosFormatados,
        duracaoTotalMinutos: duracaoTotal,
        valorEstimado,
        opcaoSelecionada: {
            dataHoraInicio: opcaoSelecionada.dataHoraInicio,
            dataHoraFim: opcaoSelecionada.dataHoraFim,
            funcionarioId: opcaoSelecionada.funcionarioId,
            salaId: opcaoSelecionada.salaId,
        },
        dataResumo: new Date(),
    };

    log(TOPIC, `Resumo montado: ${duracaoTotal}min | ${valorEstimado}€`, 'success');
    return resumo;
}

async function criarAgendamentoCompleto(payload) {
    const {
        animalId, funcionarioId, salaId,
        dataHoraInicio, dataHoraFim,
        valorTotal, servicos = [], processInstanceId,
    } = payload || {};

    if (!animalId || !funcionarioId || !salaId || !dataHoraInicio || !dataHoraFim || !processInstanceId) {
        throw new Error('Faltam dados obrigatórios para criar agendamento');
    }

    log(TOPIC, `Criando agendamento para animal=${animalId}`, 'info');

    const agendamento = await prisma.$transaction(async (tx) => {
        const novo = await tx.agendamento.create({
            data: {
                animalId,
                funcionarioId,
                salaId,
                dataHoraInicio: new Date(dataHoraInicio),
                dataHoraFim: new Date(dataHoraFim),
                valorTotal: Number(valorTotal),
                estado: 'CONFIRMADO',
                processInstanceId,
            },
        });

        if (servicos.length > 0) {
            await tx.agendamentoServico.createMany({
                data: servicos.map((s, i) => ({
                    agendamentoId: novo.id,
                    tipoServicoId: s.tipoServicoId,
                    precoNoMomento: Number(s.precoBase || s.preco || 0),
                    duracaoNoMomento: Number(s.duracaoMinutos || s.duracao || 0),
                    ordem: s.ordem ?? i + 1,
                })),
            });
        }

        return tx.agendamento.findUnique({
            where: { id: novo.id },
            include: {
                animal: { include: { cliente: { include: { utilizador: true } } } },
                funcionario: { include: { utilizador: true } },
                sala: true,
                servicos: { include: { tipoServico: true } },
            },
        });
    });

    log(TOPIC, `✓ Agendamento criado [${agendamento.id}]`, 'success');
    return agendamento;
}

async function atualizarAgendamentoCompleto(payload) {
    const {
        agendamentoId, funcionarioId, salaId,
        dataHoraInicio, dataHoraFim, servicos = [],
    } = payload || {};

    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log(TOPIC, `Reagendando agendamento [${agendamentoId}]`, 'info');

    const agendamento = await prisma.$transaction(async (tx) => {
        await tx.agendamento.update({
            where: { id: agendamentoId },
            data: {
                funcionarioId,
                salaId,
                dataHoraInicio: new Date(dataHoraInicio),
                dataHoraFim: new Date(dataHoraFim),
                estado: 'CONFIRMADO',
            },
        });

        if (servicos.length > 0) {
            await tx.agendamentoServico.deleteMany({ where: { agendamentoId } });
            await tx.agendamentoServico.createMany({
                data: servicos.map((s, i) => ({
                    agendamentoId,
                    tipoServicoId: s.tipoServicoId,
                    precoNoMomento: Number(s.precoBase || s.preco || 0),
                    duracaoNoMomento: Number(s.duracaoMinutos || s.duracao || 0),
                    ordem: s.ordem ?? i + 1,
                })),
            });
        }

        return tx.agendamento.findUnique({
            where: { id: agendamentoId },
            include: {
                animal: { include: { cliente: { include: { utilizador: true } } } },
                funcionario: { include: { utilizador: true } },
                sala: true,
                servicos: { include: { tipoServico: true } },
            },
        });
    });

    log(TOPIC, `✓ Agendamento [${agendamentoId}] atualizado`, 'success');
    return agendamento;
}

async function atualizarEstadoAgendamento({ agendamentoId, estado, checkIn = false, checkOut = false }) {
    if (!agendamentoId || !estado) throw new Error('agendamentoId e estado são obrigatórios');

    log(TOPIC, `Atualizando estado [${agendamentoId}] → ${estado}`, 'info');

    const data = { estado };
    if (checkIn) data.checkInRealizadoEm = new Date();
    if (checkOut) data.checkOutRealizadoEm = new Date();

    const agendamento = await prisma.agendamento.update({
        where: { id: agendamentoId },
        data,
        include: {
            animal: { include: { cliente: { include: { utilizador: true } } } },
            funcionario: { include: { utilizador: true } },
            sala: true,
            servicos: { include: { tipoServico: true } },
        },
    });

    log(TOPIC, `✓ Estado atualizado para ${estado}`, 'success');
    return agendamento;
}

async function carregarDadosAgendamento(agendamentoId) {
    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log(TOPIC, `Carregando dados do agendamento [${agendamentoId}]`, 'info');

    const agendamento = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
        include: {
            animal: {
                include: {
                    cliente: { include: { utilizador: true } }
                }
            },
            funcionario: { include: { utilizador: true } },
            sala: true,
            servicos: { include: { tipoServico: true } },
        },
    });

    if (!agendamento) throw new Error(`Agendamento ${agendamentoId} não encontrado`);

    // Reconstrói servicosIniciais no formato que o Sub-processo 1 espera
    const servicosIniciais = agendamento.servicos.map(s => ({
        tipoServicoId: s.tipoServicoId,
        nomeServico: s.tipoServico?.tipo || 'Serviço',
        precoBase: Number(s.precoNoMomento),
        duracaoMinutos: s.duracaoNoMomento,
        ordem: s.ordem,
    }));

    const resultado = {
        clienteId: agendamento.animal?.clienteId || null,
        animalId: agendamento.animalId,
        porteAnimal: agendamento.animal?.porte || 'MEDIO',
        clienteEmail: agendamento.animal?.cliente?.utilizador?.email || null,
        servicosIniciais,
    };

    log(TOPIC, `✓ Dados carregados — ${servicosIniciais.length} serviço(s)`, 'success');
    return resultado;
}

async function libertarRecursosAgendamento(agendamentoId) {
    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log(TOPIC, `Libertando recursos do agendamento [${agendamentoId}]`, 'info');

    const agendamento = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
        select: { processInstanceId: true }
    });

    if (agendamento?.processInstanceId) {
        await prisma.reservaTemporaria.deleteMany({
            where: { processInstanceId: agendamento.processInstanceId }
        });
        log(TOPIC, `✓ Reservas temporárias limpas para processo [${agendamento.processInstanceId}]`, 'success');
    } else {
        log(TOPIC, `Sem processInstanceId — nada a limpar`, 'warn');
    }
}

module.exports = {
    obterPrecoEDuracao,
    adicionarServicoLista,
    montarResumo,
    criarAgendamentoCompleto,
    atualizarAgendamentoCompleto,
    atualizarEstadoAgendamento,
    carregarDadosAgendamento,
    libertarRecursosAgendamento,
};