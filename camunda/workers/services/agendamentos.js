const prisma = require('../utils/db');
const { log } = require('../utils/logger');

const TOPIC = 'agendamentos';

// Include partilhado: devolve o agendamento com animal/cliente/utilizador, e serviços ordenados
// com o respectivo tipoServico, funcionário (+ utilizador) e sala.
const AGENDAMENTO_COMPLETO_INCLUDE = {
    animal: { include: { cliente: { include: { utilizador: true } } } },
    servicos: {
        include: {
            tipoServico: true,
            funcionario: { include: { utilizador: true } },
            sala: true,
        },
        orderBy: { ordem: 'asc' },
    },
};

// Monta as linhas de AgendamentoServico combinando a lista de serviços escolhidos
// com os recursos (funcionário/sala/timestamps) da solução selecionada.
function mapearLinhasAgendamentoServico(servicos, servicosDaSolucao, agendamentoId) {
    return servicos.map((s, i) => {
        const sol = servicosDaSolucao[i];
        if (!sol?.funcionarioId || !sol?.salaId) {
            throw new Error(`Serviço ${i + 1} sem funcionário ou sala na solução`);
        }
        return {
            agendamentoId,
            tipoServicoId: s.tipoServicoId,
            funcionarioId: sol.funcionarioId,
            salaId: sol.salaId,
            dataHoraInicio: new Date(sol.dataHoraInicio),
            dataHoraFim: new Date(sol.dataHoraFim),
            precoNoMomento: Number(s.precoBase ?? s.preco ?? 0),
            duracaoNoMomento: Number(s.duracaoMinutos ?? s.duracao ?? 0),
            ordem: s.ordem ?? i + 1,
        };
    });
}

async function obterPrecoEDuracao(tipoServicoId, porteAnimal) {
    if (!tipoServicoId) throw new Error('tipoServicoId é obrigatório');
    if (!porteAnimal) throw new Error('porteAnimal é obrigatório');

    log(TOPIC, `Procurar preço para tipoServicoId=${tipoServicoId} | porte=${porteAnimal}`, 'info');

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

async function montarResumo({ servicosActualizados = [], opcaoSelecionada = {}, animalId, clienteNome }) {
    if (!clienteNome && animalId) {
        // Best-effort: no ramo de cliente não-registado o animal pode ainda não existir em BD.
        // Se a query falhar (ID inválido, não encontrado, etc.), seguimos sem nome — fallback 'Cliente'.
        try {
            const animal = await prisma.animal.findUnique({
                where: { id: animalId },
                select: { cliente: { select: { utilizador: { select: { nome: true } } } } },
            });
            clienteNome = animal?.cliente?.utilizador?.nome || null;
        } catch (err) {
            log(TOPIC, `lookup de nomeCliente falhou (animalId=${animalId}): ${err.message}`, 'warn');
        }
    }

    const servicosFormatados = servicosActualizados.map((s, i) => ({
        ordem: s.ordem ?? i + 1,
        nome: s.nome ?? `Serviço ${s.tipoServicoId}`,
        preco: Number(s.precoBase ?? 0),
        duracao: Number(s.duracaoMinutos ?? 0),
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
        animalId, dataHoraInicio, dataHoraFim,
        valorTotal, servicos = [], opcao = null, processInstanceId,
    } = payload || {};

    if (!animalId || !dataHoraInicio || !dataHoraFim || !processInstanceId) {
        throw new Error('Faltam dados obrigatórios para criar agendamento');
    }
    if (!opcao?.servicos?.length) {
        throw new Error('Opção escolhida em falta — sem dados de funcionário/sala por serviço');
    }

    log(TOPIC, `Criar agendamento para animal=${animalId}`, 'info');

    const agendamento = await prisma.$transaction(async (tx) => {
        const novo = await tx.agendamento.create({
            data: {
                animalId,
                // Usa as datas da opcao escolhida — evita inconsistência com o process variable
                // dataHoraInicio que fica desactualizado se o utilizador não escolheu a opção 0.
                dataHoraInicio: new Date(opcao.dataHoraInicio ?? dataHoraInicio),
                dataHoraFim: new Date(opcao.dataHoraFim ?? dataHoraFim),
                valorTotal: Number(valorTotal),
                estado: 'CONFIRMADO',
                processInstanceId,
            },
        });

        if (servicos.length > 0) {
            await tx.agendamentoServico.createMany({
                data: mapearLinhasAgendamentoServico(servicos, opcao.servicos, novo.id),
            });
        }

        return tx.agendamento.findUnique({
            where: { id: novo.id },
            include: AGENDAMENTO_COMPLETO_INCLUDE,
        });
    });

    log(TOPIC, `✓ Agendamento criado [${agendamento.id}]`, 'success');
    return agendamento;
}

async function atualizarAgendamentoCompleto(payload) {
    const {
        agendamentoId, dataHoraInicio, dataHoraFim, servicos = [], opcao = null,
    } = payload || {};

    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');
    if (!opcao?.servicos?.length) {
        throw new Error('Opção escolhida em falta — sem dados de funcionário/sala por serviço');
    }

    log(TOPIC, `Reagendar agendamento [${agendamentoId}]`, 'info');

    const agendamento = await prisma.$transaction(async (tx) => {
        await tx.agendamento.update({
            where: { id: agendamentoId },
            data: {
                dataHoraInicio: new Date(opcao.dataHoraInicio ?? dataHoraInicio),
                dataHoraFim: new Date(opcao.dataHoraFim ?? dataHoraFim),
                estado: 'CONFIRMADO',
            },
        });

        if (servicos.length > 0) {
            await tx.agendamentoServico.deleteMany({ where: { agendamentoId } });
            await tx.agendamentoServico.createMany({
                data: mapearLinhasAgendamentoServico(servicos, opcao.servicos, agendamentoId),
            });
        }

        return tx.agendamento.findUnique({
            where: { id: agendamentoId },
            include: AGENDAMENTO_COMPLETO_INCLUDE,
        });
    });

    log(TOPIC, `✓ Agendamento [${agendamentoId}] atualizado`, 'success');
    return agendamento;
}

async function atualizarEstadoAgendamento({ agendamentoId, estado, checkIn = false, checkOut = false }) {
    if (!agendamentoId || !estado) throw new Error('agendamentoId e estado são obrigatórios');

    log(TOPIC, `Atualizar estado [${agendamentoId}] → ${estado}`, 'info');

    const data = { estado };
    if (checkIn) data.checkInRealizadoEm = new Date();
    if (checkOut) data.checkOutRealizadoEm = new Date();

    const agendamento = await prisma.agendamento.update({
        where: { id: agendamentoId },
        data,
        include: AGENDAMENTO_COMPLETO_INCLUDE,
    });

    log(TOPIC, `✓ Estado atualizado para ${estado}`, 'success');
    return agendamento;
}

async function carregarDadosAgendamento(agendamentoId) {
    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log(TOPIC, `Carregar dados do agendamento [${agendamentoId}]`, 'info');

    const agendamento = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
        include: {
            animal: { include: { cliente: { include: { utilizador: true } } } },
            servicos: { include: { tipoServico: true } },
        },
    });

    if (!agendamento) throw new Error(`Agendamento ${agendamentoId} não encontrado`);

    const servicosIniciais = agendamento.servicos.map(s => ({
        tipoServicoId: s.tipoServicoId,
        nomeServico: s.tipoServico?.tipo || 'Serviço',
        precoBase: Number(s.precoNoMomento),
        duracaoMinutos: s.duracaoNoMomento,
        ordem: s.ordem,
    }));

    let porteAnimal = agendamento.animal?.porte;
    if (!porteAnimal) {
        throw new Error(`Animal ${agendamento.animalId} não tem porte definido. Corrija a ficha do animal.`);
    }

    const resultado = {
        clienteId: agendamento.animal?.clienteId ?? null,
        animalId: agendamento.animalId,
        porteAnimal,
        clienteEmail: agendamento.animal?.cliente?.utilizador?.email ?? null,
        nomeCliente: agendamento.animal?.cliente?.utilizador?.nome ?? null,
        servicosIniciais,
        valorTotal: Number(agendamento.valorTotal),
    };

    log(TOPIC, `✓ Dados carregados — ${servicosIniciais.length} serviço(s)`, 'success');
    return resultado;
}

async function libertarRecursosAgendamento(agendamentoId) {
    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log(TOPIC, `Libertar recursos do agendamento [${agendamentoId}]`, 'info');

    const agendamento = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
        select: { processInstanceId: true },
    });

    if (agendamento?.processInstanceId) {
        await prisma.reservaTemporaria.deleteMany({
            where: { processInstanceId: agendamento.processInstanceId },
        });
        log(TOPIC, `✓ Reservas temporárias limpas para processo [${agendamento.processInstanceId}]`, 'success');
    } else {
        log(TOPIC, `Sem processInstanceId — nada a limpar`, 'warn');
    }
}

module.exports = {
    obterPrecoEDuracao,
    montarResumo,
    criarAgendamentoCompleto,
    atualizarAgendamentoCompleto,
    atualizarEstadoAgendamento,
    carregarDadosAgendamento,
    libertarRecursosAgendamento,
    AGENDAMENTO_COMPLETO_INCLUDE,
};