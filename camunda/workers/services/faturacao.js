const prisma = require('../utils/db');
const { log } = require('../utils/logger');

async function gerarFatura(agendamentoId) {
    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log('faturacao', `Gerando fatura para agendamento ${agendamentoId}`, 'info');

    const agendamento = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
        include: {
            animal: { include: { cliente: { include: { utilizador: true } } } },
            funcionario: { include: { utilizador: true } },
            sala: true,
            servicos: { include: { tipoServico: true } },
        },
    });

    if (!agendamento) throw new Error(`Agendamento ${agendamentoId} não encontrado`);

    const totalServicos = agendamento.servicos.reduce((sum, s) =>
        sum + Number(s.precoNoMomento || 0), 0
    );

    const fatura = {
        faturaId: `FAT-${Date.now().toString(36).toUpperCase()}-${agendamentoId.slice(0, 8)}`,
        agendamentoId,
        clienteNome: agendamento.animal?.cliente?.utilizador?.nome || 'Cliente',
        clienteEmail: agendamento.animal?.cliente?.utilizador?.email,
        animalNome: agendamento.animal?.nome || 'Animal',
        funcionarioNome: agendamento.funcionario?.utilizador?.nome || 'Funcionário',
        salaNome: agendamento.sala?.nome || 'Sem sala',
        dataHoraInicio: agendamento.dataHoraInicio,
        dataHoraFim: agendamento.dataHoraFim,
        servicos: agendamento.servicos.map(s => ({
            nome: s.tipoServico?.tipo || 'Serviço',
            preco: Number(s.precoNoMomento),
            duracao: s.duracaoNoMomento,
        })),
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

    // Valida enum
    const metodosValidos = ['DINHEIRO', 'MULTIBANCO', 'TRANSFERENCIA'];
    if (!metodosValidos.includes(metodoPagamento)) {
        throw new Error(`Método de pagamento inválido: ${metodoPagamento}`);
    }

    log('faturacao', `Registando pagamento: ${valorPago}€ via ${metodoPagamento}`, 'info');

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