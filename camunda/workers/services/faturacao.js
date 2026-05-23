const prisma = require('../utils/db');
const { log } = require('../utils/logger');
const { agoraNaiveLisboa } = require('../utils/horario');

const TOPIC = 'faturacao';

// ajustes:
// Taxa de IVA aplicada por linha da fatura, em percentagem. O cálculo é "backwards": precoBase de cada serviço inclui IVA (preço final ao cliente),
// e valorSemIva/valorIva são derivados dele em `gerarFatura`.
//   const TAXA_IVA = 6;   // taxa reduzida
//   const TAXA_IVA = 13;  // taxa intermédia
//   const TAXA_IVA = 23;  // taxa normal (default)
// Não suporta múltiplas taxas por fatura - todas as linhas usam o mesmo valor.
// Se for preciso diferenciar por serviço, mover esta constante para o TipoServico (schema.prisma) e ler na construção de `servicosFormatados`.
const TAXA_IVA = 23;

async function gerarFatura(dados) {
    const {
        agendamentoId,
        clienteNome, clienteEmail, clienteNif, clienteTelefone,
        animalNome,
        dataHoraInicio, dataHoraFim,
        servicos = [],
        metodoPagamento,
        pagoEm,
    } = dados || {};

    if (!agendamentoId) throw new Error('agendamentoId é obrigatório');

    log(TOPIC, `Gerar fatura para agendamento ${agendamentoId}`, 'info');

    // Se já existe Fatura para este agendamento, devolve a existente sem reescrever.
    // Snapshot de uma fatura emitida é imutável por princípio.
    const existente = await prisma.fatura.findUnique({ where: { agendamentoId } });
    if (existente) {
        log(TOPIC, `Fatura já existe [${existente.numero}] - devolve existente`, 'info');
        return formatarFaturaResposta(existente);
    }

    // Discriminação IVA por linha. precoBase na lista de serviços inclui IVA (preço final ao cliente).
    // Cálculo backwards: valorSemIva = preço / (1 + taxa).
    const servicosFormatados = servicos.map(s => {
        const valorComIva = Number(s.precoBase);
        const valorSemIva = +(valorComIva / (1 + TAXA_IVA / 100)).toFixed(2);
        const valorIva = +(valorComIva - valorSemIva).toFixed(2);
        return {
            nome: s.nomeServico || s.nome || 'Serviço',
            duracao: s.duracaoMinutos,
            valorComIva,
            valorSemIva,
            valorIva,
        };
    });

    const valorTotal = +(servicosFormatados.reduce((sum, s) => sum + s.valorComIva, 0)).toFixed(2);
    const subTotalSemIva = +(servicosFormatados.reduce((sum, s) => sum + s.valorSemIva, 0)).toFixed(2);
    const valorIvaTotal = +(servicosFormatados.reduce((sum, s) => sum + s.valorIva, 0)).toFixed(2);

    const numero = `FAT-${Date.now().toString(36).toUpperCase()}-${agendamentoId.slice(0, 8)}`;

    const conteudo = {
        tipo: 'SERVICO_INTERNO',
        clienteNome: clienteNome || 'Cliente',
        clienteEmail: clienteEmail || null,
        clienteNif: clienteNif || null,
        clienteTelefone: clienteTelefone || null,
        animalNome: animalNome || 'Animal',
        dataHoraInicio: dataHoraInicio || null,
        dataHoraFim: dataHoraFim || null,
        servicos: servicosFormatados,
        taxaIva: TAXA_IVA,
        subTotalSemIva,
        valorIva: valorIvaTotal,
        valorTotal,
        metodoPagamento: metodoPagamento || null,
        pagoEm: pagoEm || null,
    };

    const fatura = await prisma.fatura.create({
        data: {
            numero,
            tipo: 'SERVICO_INTERNO',
            agendamentoId,
            valorTotal,
            metodoPagamento: metodoPagamento || null,
            pagoEm: pagoEm ? new Date(pagoEm) : null,
            // Override do @default(now()) do Prisma para usar convenção naive (igual ao resto dos timestamps do projeto).
            // Sem isto, dataEmissao ficaria em UTC real.
            dataEmissao: agoraNaiveLisboa(),
            conteudoJson: conteudo,
        },
    });

    log(TOPIC, `✓ Fatura gerada [${fatura.numero}] - Total: ${Number(fatura.valorTotal)}€`, 'success');
    return formatarFaturaResposta(fatura);
}

// Achata `conteudoJson` no topo do objecto devolvido, juntando campos da raiz (faturaId, numero, dataEmissao) aos campos do snapshot (clienteNome, servicos, etc.).
function formatarFaturaResposta(fatura) {
    return {
        faturaId: fatura.id,
        numero: fatura.numero,
        agendamentoId: fatura.agendamentoId,
        valorTotal: Number(fatura.valorTotal),
        metodoPagamento: fatura.metodoPagamento,
        pagoEm: fatura.pagoEm,
        dataEmissao: fatura.dataEmissao,
        ...fatura.conteudoJson,
    };
}

async function registarPagamento({ agendamentoId, metodoPagamento, valorEstimado }) {
    if (!agendamentoId || !metodoPagamento) {
        throw new Error('agendamentoId e metodoPagamento são obrigatórios');
    }

    // Validação do enum é delegada ao Prisma - rejeita valores fora de MetodoPagamentoEnum no UPDATE abaixo.

    // valorEstimado vem do worker `calcular-resumo-servicos` (final do sub_faturar_servicos) e reflecte add/remove feitos pelo funcionário.
    // Se vier, sincronizamos o valorTotal da BD para coerência com a fatura (que também usa servicosActualizados).
    // Se não vier, não tocamos no valorTotal - comportamento antigo preservado para chamadores que não passem o argumento.
    const dataUpdate = {
        metodoPagamento,
        // naive UTC (Lisboa empacotada como UTC) - igual ao resto dos timestamps do projeto.
        pagoEm: agoraNaiveLisboa(),
    };
    if (valorEstimado !== undefined && valorEstimado !== null) {
        dataUpdate.valorTotal = Number(valorEstimado);
    }

    const agendamento = await prisma.agendamento.update({
        where: { id: agendamentoId },
        data: dataUpdate,
        select: { valorTotal: true, pagoEm: true },
    });

    log(TOPIC, `✓ Pagamento registado [${agendamentoId}] - ${agendamento.valorTotal}€ via ${metodoPagamento}`, 'success');

    return {
        agendamentoId,
        valorPago: Number(agendamento.valorTotal),
        metodoPagamento,
        pagoEm: agendamento.pagoEm,
    };
}

module.exports = { gerarFatura, registarPagamento };