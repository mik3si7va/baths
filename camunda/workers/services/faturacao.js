const prisma = require('../utils/db');
const { log } = require('../utils/logger');
const { AGENDAMENTO_COMPLETO_INCLUDE } = require('./agendamentos');

async function gerarFatura(agendamentoId) {
    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log('faturacao', `Gerar fatura para agendamento ${agendamentoId}`, 'info');

    const agendamento = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
        include: AGENDAMENTO_COMPLETO_INCLUDE,
    });

    if (!agendamento) throw new Error(`Agendamento ${agendamentoId} não encontrado`);

    const totalServicos = agendamento.servicos.reduce(
        (sum, s) => sum + Number(s.precoNoMomento || 0),
        0,
    );

    const servicosFormatados = agendamento.servicos.map(s => ({
        nome: s.tipoServico?.tipo || 'Serviço',
        preco: Number(s.precoNoMomento),
        duracao: s.duracaoNoMomento,
        dataHoraInicio: s.dataHoraInicio,
        dataHoraFim: s.dataHoraFim,
        funcionarioNome: s.funcionario?.utilizador?.nome || 'Funcionário',
        salaNome: s.sala?.nome || 'Sem sala',
    }));

    // Listas únicas — úteis para cabeçalhos de template sem iterar os serviços.
    const funcionarios = [...new Set(servicosFormatados.map(s => s.funcionarioNome))];
    const salas = [...new Set(servicosFormatados.map(s => s.salaNome))];

    const faturaId = agendamento.faturaId
        || `FAT-${Date.now().toString(36).toUpperCase()}-${agendamentoId.slice(0, 8)}`;

    if (!agendamento.faturaId) {
        await prisma.agendamento.update({
            where: { id: agendamentoId },
            data: { faturaId },
        });
    }

    const fatura = {
        faturaId,
        agendamentoId,
        clienteNome: agendamento.animal?.cliente?.utilizador?.nome || 'Cliente',
        clienteEmail: agendamento.animal?.cliente?.utilizador?.email,
        animalNome: agendamento.animal?.nome || 'Animal',
        dataHoraInicio: agendamento.dataHoraInicio,
        dataHoraFim: agendamento.dataHoraFim,
        servicos: servicosFormatados,
        funcionarios,
        salas,
        totalServicos,
        valorTotal: Number(agendamento.valorTotal),
        dataEmissao: new Date(),
    };

    log('faturacao', `✓ Fatura gerada [${fatura.faturaId}] — Total: ${fatura.valorTotal}€`, 'success');
    return fatura;
}

async function registarPagamento({ agendamentoId, valorPago, metodoPagamento }) {
    if (!agendamentoId || !valorPago || !metodoPagamento) {
        throw new Error('agendamentoId, valorPago e metodoPagamento são obrigatórios');
    }

    const metodosValidos = ['DINHEIRO', 'MULTIBANCO', 'TRANSFERENCIA'];
    if (!metodosValidos.includes(metodoPagamento)) {
        throw new Error(`Método de pagamento inválido: ${metodoPagamento}`);
    }

    log('faturacao', `Registar pagamento: ${valorPago}€ via ${metodoPagamento}`, 'info');

    const agendamento = await prisma.agendamento.update({
        where: { id: agendamentoId },
        data: {
            metodoPagamento,
            pagoEm: new Date(),
        },
    });

    log('faturacao', `✓ Pagamento registado [${agendamentoId}]`, 'success');

    return {
        agendamentoId,
        valorPago: Number(valorPago),
        metodoPagamento,
        pagoEm: agendamento.pagoEm,
    };
}

module.exports = { gerarFatura, registarPagamento };