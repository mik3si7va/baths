const prisma = require('../utils/db');
const { log } = require('../utils/logger');
const { formatDt } = require('../utils/utilsWorker');
const { addMinutes } = require('date-fns');

const EXPIRACAO_MINUTOS = 5;
const ESTADOS_AGENDAMENTO_ATIVOS = { notIn: ['CANCELADO', 'NAO_COMPARECEU'] };

function intervaloOverlap(inicio, fim) {
  return { dataHoraInicio: { lt: fim }, dataHoraFim: { gt: inicio } };
}

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
 * @param {string}      opts.dataHoraInicio       - ISO string
 * @param {string}      opts.dataHoraFim          - ISO string
 * @param {string}      opts.processInstanceId
 * @param {number}      [opts.capacidade]         - Capacidade máxima da sala. Se não for
 *                                                  fornecida e houver `salaId`, é obtida da BD.
 *                                                  Callers que já tenham a sala em memória
 *                                                  (ex: scheduler) devem passar para evitar query.
 */
async function verificarDisponibilidade({
  salaId,
  funcionarioId,
  dataHoraInicio,
  dataHoraFim,
  processInstanceId,
  capacidade,
}) {
  const inicio = new Date(dataHoraInicio);
  const fim = new Date(dataHoraFim);
  const agora = new Date();

  // ── Funcionário (exclusivo) ─────────────────────────────────────
  if (funcionarioId) {
    const agendServico = await prisma.agendamentoServico.findFirst({
      where: {
        funcionarioId,
        ...intervaloOverlap(inicio, fim),
        agendamento: { estado: ESTADOS_AGENDAMENTO_ATIVOS },
      },
      orderBy: { dataHoraFim: 'desc' },
      select: { dataHoraInicio: true, dataHoraFim: true },
    });

    if (agendServico) {
      const u = await prisma.utilizador.findUnique({ where: { id: funcionarioId }, select: { nome: true } });
      const ini = formatDt(agendServico.dataHoraInicio).slice(11);
      const fimStr = formatDt(agendServico.dataHoraFim).slice(11);
      log('reservas', `Funcionário ${u?.nome ?? funcionarioId} ocupado (agendamento definitivo das ${ini} às ${fimStr}) — livre às ${formatDt(agendServico.dataHoraFim)}`, 'warn');
      return { ok: false, livreEm: agendServico.dataHoraFim };
    }

    const temp = await prisma.reservaTemporaria.findFirst({
      where: {
        funcionarioId,
        processInstanceId: { not: processInstanceId },
        expiresAt: { gt: agora },
        ...intervaloOverlap(inicio, fim),
      },
      orderBy: { dataHoraFim: 'desc' },
      select: { dataHoraInicio: true, dataHoraFim: true },
    });

    if (temp) {
      const u = await prisma.utilizador.findUnique({ where: { id: funcionarioId }, select: { nome: true } });
      const ini = formatDt(temp.dataHoraInicio).slice(11);
      const fimStr = formatDt(temp.dataHoraFim).slice(11);
      log('reservas', `Funcionário ${u?.nome ?? funcionarioId} ocupado (reserva temporária das ${ini} às ${fimStr}) — livre às ${formatDt(temp.dataHoraFim)}`, 'warn');
      return { ok: false, livreEm: temp.dataHoraFim };
    }
  }

  // ── Sala (respeita capacidade) ───────────────────────────────────
  if (salaId) {
    // Se o caller não forneceu capacidade, obtê-la da BD. Evita bug silencioso de default=1.
    if (capacidade == null) {
      const s = await prisma.sala.findUnique({
        where: { id: salaId },
        select: { capacidade: true },
      });
      capacidade = s?.capacidade ?? 1;
    }

    const agendServicosOcup = await prisma.agendamentoServico.findMany({
      where: {
        salaId,
        ...intervaloOverlap(inicio, fim),
        agendamento: { estado: ESTADOS_AGENDAMENTO_ATIVOS },
      },
      distinct: ['agendamentoId'],
      select: { agendamentoId: true },
    });
    const ocupAgend = agendServicosOcup.length;

    const ocupTemp = await prisma.reservaTemporaria.count({
      where: {
        salaId,
        processInstanceId: { not: processInstanceId },
        expiresAt: { gt: agora },
        ...intervaloOverlap(inicio, fim),
      },
    });

    const totalOcupado = ocupAgend + ocupTemp;

    if (totalOcupado >= capacidade) {
      const s = await prisma.sala.findUnique({ where: { id: salaId }, select: { nome: true } });

      const bloqA = await prisma.agendamentoServico.findFirst({
        where: {
          salaId,
          ...intervaloOverlap(inicio, fim),
          agendamento: { estado: ESTADOS_AGENDAMENTO_ATIVOS },
        },
        orderBy: { dataHoraFim: 'asc' },
        select: { dataHoraInicio: true, dataHoraFim: true },
      });
      const bloqT = await prisma.reservaTemporaria.findFirst({
        where: {
          salaId,
          processInstanceId: { not: processInstanceId },
          expiresAt: { gt: agora },
          ...intervaloOverlap(inicio, fim),
        },
        orderBy: { dataHoraFim: 'asc' },
        select: { dataHoraInicio: true, dataHoraFim: true },
      });

      const datas = [bloqA?.dataHoraFim, bloqT?.dataHoraFim].filter(Boolean);
      const livreEm = datas.length > 0 ? new Date(Math.min(...datas.map(d => new Date(d)))) : null;

      const bloqIni = formatDt(bloqA?.dataHoraInicio ?? bloqT?.dataHoraInicio).slice(11);
      const bloqFim = livreEm ? formatDt(livreEm).slice(11) : '?';
      log('reservas', `Sala ${s?.nome ?? salaId} sem capacidade (${totalOcupado}/${capacidade}, ocupada das ${bloqIni} às ${bloqFim}) — livre às ${livreEm ? formatDt(livreEm) : '?'}`, 'warn');

      return { ok: false, livreEm };
    }
  }

  return { ok: true };
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

  log('reservas', `${count} reserva(s) temporária(s) libertada(s) [proc=${processInstanceId}]`, 'success');
  return count;
}

/**
 * Remove reservas temporárias pelos seus IDs.
 * Mais preciso que libertarReservas — apaga apenas as reservas indicadas,
 * sem afectar outras do mesmo processo.
 */
async function libertarReservasPorIds(ids = []) {
  if (!ids.length) {
    log('reservas', 'libertarReservasPorIds: lista de ids vazia', 'warn');
    return 0;
  }

  const { count } = await prisma.reservaTemporaria.deleteMany({
    where: { id: { in: ids } },
  });

  log('reservas', `${count} reserva(s) temporária(s) libertada(s) [ids=${ids.join(',')}]`, 'success');
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

async function limparReservasExpiradas() {
  const { count } = await prisma.reservaTemporaria.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
  log('reservas', `${count} reserva(s) expirada(s) removida(s)`, 'info');
  return count;
}

/**
 * Verifica em série a disponibilidade de cada serviço (sala+funcionário) de uma opção.
 * Faz early-exit no primeiro indisponível.
 */
async function validarServicos(servicos, processInstanceId) {
  for (const s of servicos) {
    const result = await verificarDisponibilidade({
      salaId: s.salaId,
      funcionarioId: s.funcionarioId,
      dataHoraInicio: s.dataHoraInicio,
      dataHoraFim: s.dataHoraFim,
      processInstanceId,
    });
    if (!result.ok) return false;
  }
  return true;
}

/**
 * Cria reservas temporárias (sala + funcionário) para todos os serviços de uma opção.
 * Devolve a lista de IDs criados.
 */
async function criarReservasParaServicos(servicos, processInstanceId) {
  const ids = [];
  for (const s of servicos) {
    if (s.funcionarioId) {
      const r = await criarReservaTemporaria({
        funcionarioId: s.funcionarioId,
        dataHoraInicio: new Date(s.dataHoraInicio),
        dataHoraFim: new Date(s.dataHoraFim),
        processInstanceId,
      });
      ids.push(r.id);
    }
    if (s.salaId) {
      const r = await criarReservaTemporaria({
        salaId: s.salaId,
        dataHoraInicio: new Date(s.dataHoraInicio),
        dataHoraFim: new Date(s.dataHoraFim),
        processInstanceId,
      });
      ids.push(r.id);
    }
  }
  return ids;
}

module.exports = {
  criarReservaTemporaria,
  verificarDisponibilidade,
  libertarReservas,
  libertarReservasPorIds,
  libertarRecursosAgendamento,
  limparReservasExpiradas,
  validarServicos,
  criarReservasParaServicos,
};