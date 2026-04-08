const prisma = require('../utils/db');
const { log } = require('../utils/logger');
const { addMinutes } = require('date-fns');

const EXPIRACAO_MINUTOS = 5;

async function criarReservaTemporaria(payload) {
  const { salaId, funcionarioId, dataHoraInicio, dataHoraFim, processInstanceId } = payload || {};

  if (!dataHoraInicio || !dataHoraFim || !processInstanceId) {
    throw new Error('dataHoraInicio, dataHoraFim e processInstanceId são obrigatórios');
  }

  const expiraEm = addMinutes(new Date(), EXPIRACAO_MINUTOS);

  const reserva = await prisma.reservaTemporaria.create({
    data: {
      salaId: salaId || null,
      funcionarioId: funcionarioId || null,
      dataHoraInicio: new Date(dataHoraInicio),
      dataHoraFim: new Date(dataHoraFim),
      processInstanceId,
      expiresAt: expiraEm,
    },
  });

  log('reservas', `Reserva temporária criada [${reserva.id}] expira em ${EXPIRACAO_MINUTOS}min`, 'success');
  return reserva;
}

/**
 * Verifica se sala e/ou funcionário estão disponíveis no intervalo dado.
 *
 * Para salas com capacidade > 1: conta as ocupações simultâneas (agendamentos definitivos 
 * + reservas temporárias de outros processos) e só bloqueia quando a capacidade está esgotada.
 * Para funcionários: comportamento exclusivo — qualquer sobreposição bloqueia.
 *
 * @param {object} opts
 * @param {string|null} opts.salaId
 * @param {string|null} opts.funcionarioId
 * @param {string}      opts.dataHoraInicio   - ISO string
 * @param {string}      opts.dataHoraFim      - ISO string
 * @param {string}      opts.processInstanceId
 * @param {number}      [opts.capacidade=1]   - Capacidade máxima da sala
 */
async function verificarDisponibilidade({
  salaId,
  funcionarioId,
  dataHoraInicio,
  dataHoraFim,
  processInstanceId,
  capacidade = 1,
}) {
  const inicio = new Date(dataHoraInicio);
  const fim = new Date(dataHoraFim);
  const agora = new Date();

  // ── Funcionário (exclusivo) ─────────────────────────────────────
  if (funcionarioId) {
    // agendamentos definitivos
    const confAgend = await prisma.agendamento.count({
      where: {
        funcionarioId,
        estado: { notIn: ['CANCELADO', 'NAO_COMPARECEU'] },
        dataHoraInicio: { lt: fim },
        dataHoraFim: { gt: inicio },
      },
    });

    if (confAgend > 0) {
      log('reservas', `Funcionário ${funcionarioId} ocupado (agendamento definitivo)`, 'warn');
      return false;
    }

    // reservas temporárias de outros processos
    const confTemp = await prisma.reservaTemporaria.count({
      where: {
        funcionarioId,
        processInstanceId: { not: processInstanceId },
        expiresAt: { gt: agora },
        dataHoraInicio: { lt: fim },
        dataHoraFim: { gt: inicio },
      },
    });

    if (confTemp > 0) {
      log('reservas', `Funcionário ${funcionarioId} ocupado (reserva temporária)`, 'warn');
      return false;
    }
  }

  // ── Sala (respeita capacidade) ───────────────────────────────────
  if (salaId) {
    const ocupAgend = await prisma.agendamento.count({
      where: {
        salaId,
        estado: { notIn: ['CANCELADO', 'NAO_COMPARECEU'] },
        dataHoraInicio: { lt: fim },
        dataHoraFim: { gt: inicio },
      },
    });

    const ocupTemp = await prisma.reservaTemporaria.count({
      where: {
        salaId,
        processInstanceId: { not: processInstanceId },
        expiresAt: { gt: agora },
        dataHoraInicio: { lt: fim },
        dataHoraFim: { gt: inicio },
      },
    });

    const totalOcupado = ocupAgend + ocupTemp;

    if (totalOcupado >= capacidade) {
      log('reservas', `Sala ${salaId} sem capacidade (${totalOcupado}/${capacidade})`, 'warn');
      return false;
    }
  }

  return true;
}

/**
 * Remove todas as reservas temporárias de uma instância de processo.
 */
async function libertarReservas(processInstanceId) {
  if (!processInstanceId) {
    log('reservas', 'libertarReservas: processInstanceId em falta', 'warn');
    return 0;
  }

  const { count } = await prisma.reservaTemporaria.deleteMany({
    where: { processInstanceId },
  });

  log('reservas', `${count} reserva(s) temporária(s) libertada(s) [${processInstanceId}]`, 'success');
  return count;
}

/**
 * Liberta os recursos (AgendamentoServico) associados a um agendamento definitivo.
 * Usado no cancelamento e não-comparência.
 * Não apaga o agendamento — apenas liberta os slots para reutilização.
 * (Na prática, o estado CANCELADO/NAO_COMPARECEU já exclui estes registos das queries de disponibilidade;
 * esta função é um no-op para manter a API simétrica com libertarReservas.)
 */
async function libertarRecursosAgendamento(agendamentoId) {
  if (!agendamentoId) {
    log('reservas', 'libertarRecursosAgendamento: agendamentoId em falta', 'warn');
    return 0;
  }

  // Os recursos ficam livres assim que o estado do agendamento passa a
  // CANCELADO ou NAO_COMPARECEU (as queries de disponibilidade excluem esses estados).
  // Registamos apenas para consistência de log.
  const count = await prisma.agendamentoServico.count({
    where: { agendamentoId },
  });

  log('reservas', `Recursos de agendamento ${agendamentoId} marcados como livres (${count} serviço(s))`, 'success');
  return count;
}

module.exports = {
  criarReservaTemporaria,
  verificarDisponibilidade,
  libertarReservas,
  libertarRecursosAgendamento,
};