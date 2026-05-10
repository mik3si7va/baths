const {
  getAllSalas,
  getAllSalasWithStatus,
  getSalaById,
  createSala,
  updateSala,
  deleteSala,
  addServicoToSala,
  getServicosBySala,
  removeServicoFromSala,
} = require('../repositories/repositorioSalas');
const { prisma } = require('../db/prismaClient');

function uniqueNome(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}`;
}

// ─── Helpers para testes BET-180 / BET-485 / BET-460 ────────────────────────
//
// Os bloqueios (BET-180/485) precisam de agendamentos reais.
// Um Agendamento exige Utilizador->Cliente->Animal e Utilizador->Funcionario, o helper cria toda essa cadeia.
//
// A sala é recebida como parâmetro, os testes usam createSala() para validar o fluxo completo de criação.

async function criarAgendamentoNaSala({ salaId, tipoServicoId, estado = 'CONFIRMADO', diasNoFuturo = 1 }) {
  const { randomUUID } = require('node:crypto');

  const utilizadorClienteId = randomUUID();
  const utilizadorFuncionarioId = randomUUID();

  await prisma.utilizador.create({
    data: { id: utilizadorClienteId, nome: 'Cliente Teste Salas', email: `cliente.salas.${utilizadorClienteId}@test.com`, estadoConta: 'ATIVA', ativo: true },
  });
  await prisma.cliente.create({
    data: { id: utilizadorClienteId, telefone: '910000000' },
  });
  const animal = await prisma.animal.create({
    data: { clienteId: utilizadorClienteId, nome: 'Rex', especie: 'Cão', porte: 'MEDIO' },
  });

  await prisma.utilizador.create({
    data: { id: utilizadorFuncionarioId, nome: 'Func Teste Salas', email: `func.salas.${utilizadorFuncionarioId}@test.com`, estadoConta: 'ATIVA', ativo: true },
  });
  await prisma.funcionario.create({
    data: { id: utilizadorFuncionarioId, cargo: 'BANHISTA', telefone: '910000001', porteAnimais: ['MEDIO'] },
  });

  // Datas: por defeito 1 dia no futuro.
  // Forçamos passado -> negativo para os testes que precisam de um agendamento histórico.
  const agora = new Date();
  const inicio = new Date(agora.getTime() + diasNoFuturo * 24 * 60 * 60 * 1000);
  const fim = new Date(inicio.getTime() + 60 * 60 * 1000);

  const agendamento = await prisma.agendamento.create({
    data: {
      animalId: animal.id,
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      valorTotal: 30,
      estado,
    },
  });

  const agendamentoServico = await prisma.agendamentoServico.create({
    data: {
      agendamentoId: agendamento.id,
      tipoServicoId,
      funcionarioId: utilizadorFuncionarioId,
      salaId,
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      precoNoMomento: 30,
      duracaoNoMomento: 30,
      ordem: 1,
    },
  });

  return {
    agendamentoId: agendamento.id,
    agendamentoServicoId: agendamentoServico.id,
    animalId: animal.id,
    utilizadorClienteId,
    utilizadorFuncionarioId,
    salaId,
  };
}

async function limparContextoAgendamento({ agendamentoId, animalId, utilizadorClienteId, utilizadorFuncionarioId, salaId }) {
  await prisma.agendamentoServico.deleteMany({ where: { agendamentoId } });
  await prisma.agendamento.deleteMany({ where: { id: agendamentoId } });
  await prisma.animal.deleteMany({ where: { id: animalId } });
  await prisma.cliente.deleteMany({ where: { id: utilizadorClienteId } });
  await prisma.funcionario.deleteMany({ where: { id: utilizadorFuncionarioId } });
  await prisma.utilizador.deleteMany({ where: { id: { in: [utilizadorClienteId, utilizadorFuncionarioId] } } });

  // Limpa a sala
  if (salaId) {
    await prisma.salaServico.deleteMany({ where: { salaId } });
    await prisma.sala.delete({ where: { id: salaId } });
  }
}

describe('Gestão de Salas - Testes Unitarios', () => {
  let servicoId;

  beforeAll(async () => {
    const servico = await prisma.tipoServico.findFirst();
    if (!servico) {
      throw new Error('Nenhum TipoServico encontrado. Corre o seed antes dos testes.');
    }
    servicoId = servico.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── getAllSalas ───────────────────────────────────────────────────────────

  test('getAllSalas retorna uma lista de salas', async () => {
    const salas = await getAllSalas();
    expect(Array.isArray(salas)).toBe(true);
  });

  test('getAllSalas retorna apenas salas ativas', async () => {
    const salas = await getAllSalas();
    expect(Array.isArray(salas)).toBe(true);
    salas.forEach((sala) => {
      expect(sala.ativo).toBe(true);
    });
  });

  // ─── getAllSalasWithStatus ───────────────────────────────────────────────────────────

  test('getAllSalasWithStatus retorna salas ativas e inativas ordenadas (ativas primeiro)', async () => {
    const salas = await getAllSalasWithStatus();
    expect(Array.isArray(salas)).toBe(true);
    salas.forEach((sala) => {
      expect(typeof sala.ativo).toBe('boolean');
    });
    const primeiraInativa = salas.findIndex((s) => !s.ativo);
    if (primeiraInativa !== -1) {
      const salasDepois = salas.slice(primeiraInativa);
      salasDepois.forEach((s) => expect(s.ativo).toBe(false));
    }
  });

  // ─── getSalaById ──────────────────────────────────────────────────────────

  test('getSalaById retorna null para ID inexistente', async () => {
    const sala = await getSalaById('00000000-0000-4000-8000-000000000000');
    expect(sala).toBeNull();
  });

  // ─── createSala ───────────────────────────────────────────────────────────

  test('createSala cria uma sala com os dados correctos', async () => {
    const nome = uniqueNome('Sala Teste');

    const novaSala = await createSala({
      nome,
      capacidade: 1,
      equipamento: 'Equipamento de teste',
      precoHora: 10,
      tipoServicoIds: [servicoId],
    });

    expect(novaSala.nome).toBe(nome);
    expect(novaSala.capacidade).toBe(1);
    expect(novaSala.equipamento).toBe('Equipamento de teste');
    expect(novaSala.precoHora).toBe(10);
    expect(novaSala.ativo).toBe(true);

    await prisma.salaServico.deleteMany({ where: { salaId: novaSala.id } });
    await prisma.sala.delete({ where: { id: novaSala.id } });
  });

  test('createSala falha se o nome ja existir', async () => {
    const nome = uniqueNome('Sala Duplicada');

    await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      createSala({ nome, capacidade: 2, equipamento: 'Duplicado', precoHora: 20, tipoServicoIds: [servicoId] })
    ).rejects.toThrow(`Já existe uma sala com o nome "${nome}".`);

    await prisma.salaServico.deleteMany({ where: { sala: { nome } } });
    await prisma.sala.deleteMany({ where: { nome } });
  });

  test('createSala falha quando nome está vazio', async () => {
    await expect(
      createSala({ nome: '', capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] })
    ).rejects.toThrow('O campo nome é obrigatório.');
  });

  test('createSala falha sem tipoServicoIds', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [] })
    ).rejects.toThrow('tipoServicoIds é obrigatório e deve ter pelo menos um serviço.');
  });

  test('createSala falha com tipoServicoIds não UUID', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: ['BANHO'] })
    ).rejects.toThrow('tipoServicoIds deve conter apenas UUIDs válidos.');
  });

  test('createSala falha com capacidade inválida', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 0, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] })
    ).rejects.toThrow('capacidade deve ser um número inteiro positivo.');
  });

  test('createSala falha com precoHora inválido', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 1, equipamento: 'Teste', precoHora: -5, tipoServicoIds: [servicoId] })
    ).rejects.toThrow('precoHora deve ser um número positivo.');
  });

  // ─── updateSala ───────────────────────────────────────────────────────────

  test('updateSala atualiza sala com sucesso', async () => {
    const nome = uniqueNome('Sala Update');
    const nomeNovo = uniqueNome('Sala Update Novo');

    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Original', precoHora: 10, tipoServicoIds: [servicoId] });

    const atualizada = await updateSala(sala.id, {
      nome: nomeNovo,
      capacidade: 2,
      equipamento: 'Atualizado',
      precoHora: 25,
      tipoServicoIds: [servicoId],
    });

    expect(atualizada.nome).toBe(nomeNovo);
    expect(atualizada.capacidade).toBe(2);
    expect(atualizada.equipamento).toBe('Atualizado');
    expect(atualizada.precoHora).toBe(25);

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('updateSala retorna null para ID inexistente', async () => {
    const resultado = await updateSala('00000000-0000-4000-8000-000000000000', {
      nome: 'Qualquer',
      capacidade: 1,
      equipamento: 'Teste',
      precoHora: 10,
      tipoServicoIds: [servicoId],
    });
    expect(resultado).toBeNull();
  });

  test('updateSala falha com nome duplicado', async () => {
    const nomeA = uniqueNome('Sala A');
    const nomeB = uniqueNome('Sala B');

    const salaA = await createSala({ nome: nomeA, capacidade: 1, equipamento: 'A', precoHora: 10, tipoServicoIds: [servicoId] });
    const salaB = await createSala({ nome: nomeB, capacidade: 1, equipamento: 'B', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      updateSala(salaB.id, { nome: nomeA, capacidade: 1, equipamento: 'B', precoHora: 10, tipoServicoIds: [servicoId] })
    ).rejects.toThrow(`Já existe uma sala com o nome "${nomeA}".`);

    await prisma.salaServico.deleteMany({ where: { salaId: { in: [salaA.id, salaB.id] } } });
    await prisma.sala.deleteMany({ where: { id: { in: [salaA.id, salaB.id] } } });
  });

  test('updateSala falha sem tipoServicoIds', async () => {
    const nome = uniqueNome('Sala Update Sem Servicos');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      updateSala(sala.id, { nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [] })
    ).rejects.toThrow('tipoServicoIds é obrigatório e deve ter pelo menos um serviço.');

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  // ─── deleteSala ───────────────────────────────────────────────────────────

  test('deleteSala faz soft delete com sucesso', async () => {
    const nome = uniqueNome('Sala Delete');

    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    const resultado = await deleteSala(sala.id);

    expect(resultado.removed).toBe(true);
    expect(resultado.id).toBe(sala.id);

    const inativa = await getSalaById(sala.id);
    expect(inativa.ativo).toBe(false);

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('deleteSala retorna null para ID inexistente', async () => {
    const resultado = await deleteSala('00000000-0000-4000-8000-000000000000');
    expect(resultado).toBeNull();
  });

  test('updateSala reativa sala inativa', async () => {
    const nome = uniqueNome('Sala Reativar');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    // Inativar
    await deleteSala(sala.id);
    const inativa = await getSalaById(sala.id);
    expect(inativa.ativo).toBe(false);

    // Reativar via updateSala
    const reativada = await updateSala(sala.id, {
      nome,
      capacidade: 1,
      equipamento: 'Teste',
      precoHora: 10,
      tipoServicoIds: [servicoId],
      ativo: true,
    });

    expect(reativada.ativo).toBe(true);

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  // ─── addServicoToSala ─────────────────────────────────────────────────────

  test('addServicoToSala associa um servico adicional a uma sala', async () => {
    const nome = uniqueNome('Sala Servico Add');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });

    if (segundoServico) {
      const associacao = await addServicoToSala({ salaId: sala.id, tipoServicoId: segundoServico.id });
      expect(associacao.salaId).toBe(sala.id);
      expect(associacao.tipoServicoId).toBe(segundoServico.id);
    }

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('addServicoToSala falha com UUID inválido para salaId', async () => {
    await expect(
      addServicoToSala({ salaId: 'nao-e-uuid', tipoServicoId: servicoId })
    ).rejects.toThrow('salaId inválido. Deve ser um UUID válido.');
  });

  test('addServicoToSala falha com UUID inválido para tipoServicoId', async () => {
    const nome = uniqueNome('Sala UUID');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      addServicoToSala({ salaId: sala.id, tipoServicoId: 'BANHO' })
    ).rejects.toThrow('tipoServicoId inválido. Deve ser um UUID válido.');

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('addServicoToSala falha se sala não existir', async () => {
    await expect(
      addServicoToSala({ salaId: '00000000-0000-4000-8000-000000000000', tipoServicoId: servicoId })
    ).rejects.toThrow('Sala não encontrada.');
  });

  test('addServicoToSala falha se sala estiver inativa', async () => {
    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });
    if (!segundoServico) throw new Error('São precisos pelo menos 2 TipoServico no seed para este teste.');

    const sala = await createSala({
      nome: uniqueNome('Sala Inativa Add'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });
    await deleteSala(sala.id);

    await expect(
      addServicoToSala({ salaId: sala.id, tipoServicoId: segundoServico.id })
    ).rejects.toThrow('Não é possível associar serviços a uma sala inativa.');

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('addServicoToSala falha com associação duplicada', async () => {
    const nome = uniqueNome('Sala Duplicado Servico');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      addServicoToSala({ salaId: sala.id, tipoServicoId: servicoId })
    ).rejects.toThrow('Este serviço já está associado a esta sala.');

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  // ─── getServicosBySala ────────────────────────────────────────────────────

  test('getServicosBySala retorna servicos associados a sala', async () => {
    const nome = uniqueNome('Sala GetServicos');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    const servicos = await getServicosBySala(sala.id);

    expect(Array.isArray(servicos)).toBe(true);
    expect(servicos.length).toBe(1);
    expect(servicos[0].tipoServicoId).toBe(servicoId);

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  // ─── removeServicoFromSala ────────────────────────────────────────────────

  test('removeServicoFromSala remove a associação correctamente', async () => {
    const nome = uniqueNome('Sala Remove Servico');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    const resultado = await removeServicoFromSala({ salaId: sala.id, tipoServicoId: servicoId });

    expect(resultado.removed).toBe(true);

    const servicosRestantes = await getServicosBySala(sala.id);
    expect(servicosRestantes.length).toBe(0);

    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('removeServicoFromSala falha se associação não existir', async () => {
    const nome = uniqueNome('Sala Remove Inexistente');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });

    await expect(
      removeServicoFromSala({ salaId: sala.id, tipoServicoId: segundoServico.id })
    ).rejects.toThrow('Associação não encontrada.');

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  // BET-180 — Impedir eliminação de sala com agendamentos/reservas futuras

  test('BET-180: deleteSala bloqueia se houver agendamento futuro CONFIRMADO', async () => {
    const sala = await createSala({
      nome: uniqueNome('Sala BET180 Confirmado'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId });

    // O delete tem de falhar
    await expect(deleteSala(sala.id))
      .rejects.toThrow('1 agendamento(s) futuro(s)');

    // E a sala continua activa - o delete não chegou a tocar na BD
    const ainda = await getSalaById(sala.id);
    expect(ainda.ativo).toBe(true);

    await limparContextoAgendamento(ctx);
  });

  test('BET-180: deleteSala permite se o único agendamento futuro estiver CANCELADO', async () => {
    const sala = await createSala({
      nome: uniqueNome('Sala BET180 Cancelado'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    // Cria agendamento e marca como CANCELADO.
    // A regra só bloqueia em CONFIRMADO/EM_ATENDIMENTO, este caso deve passar.
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId });
    await prisma.agendamento.update({ where: { id: ctx.agendamentoId }, data: { estado: 'CANCELADO' } });

    const resultado = await deleteSala(sala.id);
    expect(resultado.removed).toBe(true);

    await limparContextoAgendamento(ctx);
  });

  test('BET-180: deleteSala permite se o único agendamento for passado', async () => {
    const sala = await createSala({
      nome: uniqueNome('Sala BET180 Passado'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    // Agendamento histórico (2 dias atrás) — não bloqueia.
    // A sala só tem histórico, por isso podemos inativar.
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId, diasNoFuturo: -2 });

    const resultado = await deleteSala(sala.id);
    expect(resultado.removed).toBe(true);

    await limparContextoAgendamento(ctx);
  });

  test('BET-180: deleteSala bloqueia se houver ReservaTemporaria activa (não expirada)', async () => {
    const sala = await createSala({
      nome: uniqueNome('Sala BET180 Reserva'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    // Cria uma ReservaTemporaria a apontar para a sala, com expiresAt no futuro (TTL ~5min do fluxo Camunda real). 
    const agora = new Date();
    const reserva = await prisma.reservaTemporaria.create({
      data: {
        salaId: sala.id,
        dataHoraInicio: new Date(agora.getTime() + 60 * 60 * 1000),
        dataHoraFim: new Date(agora.getTime() + 2 * 60 * 60 * 1000),
        processInstanceId: `test-proc-${Date.now()}`,
        expiresAt: new Date(agora.getTime() + 5 * 60 * 1000),
      },
    });

    await expect(deleteSala(sala.id)).rejects.toThrow('reserva(s) temporária(s) activa(s)');

    await prisma.reservaTemporaria.delete({ where: { id: reserva.id } });
    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('BET-180: deleteSala permite se a ReservaTemporaria já expirou', async () => {
    const sala = await createSala({
      nome: uniqueNome('Sala BET180 Reserva Expirada'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });

    // Reserva expirada: já passou o TTL — o scheduler ignora-as, portanto
    // não devem bloquear a inativação.
    const agora = new Date();
    const reserva = await prisma.reservaTemporaria.create({
      data: {
        salaId: sala.id,
        dataHoraInicio: new Date(agora.getTime() + 60 * 60 * 1000),
        dataHoraFim: new Date(agora.getTime() + 2 * 60 * 60 * 1000),
        processInstanceId: `test-proc-exp-${Date.now()}`,
        expiresAt: new Date(agora.getTime() - 60 * 1000), // expirou há 1 minuto
      },
    });

    const resultado = await deleteSala(sala.id);
    expect(resultado.removed).toBe(true);

    await prisma.reservaTemporaria.delete({ where: { id: reserva.id } });
    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  // BET-485 — Impedir desassociação de serviço com agendamentos futuros

  test('BET-485: removeServicoFromSala bloqueia se houver agendamento futuro com a combinação sala+serviço', async () => {
    const sala = await createSala({
      nome: uniqueNome('Sala BET485 Combinacao'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId });

    await expect(
      removeServicoFromSala({ salaId: sala.id, tipoServicoId: servicoId })
    ).rejects.toThrow('1 agendamento(s) futuro(s)');

    // Associação ainda não foi removida
    const aindaAssociado = await prisma.salaServico.findFirst({
      where: { salaId: sala.id, tipoServicoId: servicoId },
    });
    expect(aindaAssociado).not.toBeNull();

    await limparContextoAgendamento(ctx);
  });

  test('BET-485: removeServicoFromSala permite se o agendamento futuro for de OUTRO serviço', async () => {
    // Cenário: sala com 2 serviços; agendamento futuro só usa o serviço A;
    // Queremos remover o serviço B -> deve passar (combinação B não está em uso).
    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });
    if (!segundoServico) throw new Error('São precisos pelo menos 2 TipoServico no seed para este teste.');

    const sala = await createSala({
      nome: uniqueNome('Sala BET485 OutroServico'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10,
      tipoServicoIds: [servicoId, segundoServico.id],
    });
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId });

    // Tenta remover o segundo serviço que não tem agendamentos -> permitido
    const resultado = await removeServicoFromSala({ salaId: sala.id, tipoServicoId: segundoServico.id });
    expect(resultado.removed).toBe(true);

    await limparContextoAgendamento(ctx);
  });

  test('BET-485: updateSala bloqueia ao tentar remover serviço com agendamento futuro', async () => {
    // Caminho do frontend: PUT /salas/:id com a nova lista.
    // O updateSala detecta os serviços que vão ser removidos e bloqueia se algum tiver agendamentos futuros.
    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });
    if (!segundoServico) throw new Error('São precisos pelo menos 2 TipoServico no seed para este teste.');

    const sala = await createSala({
      nome: uniqueNome('Sala BET485 UpdateRemove'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10,
      tipoServicoIds: [servicoId, segundoServico.id],
    });
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId });

    // Nova lista: só segundo serviço (servicoId vai sair) -> tem de falhar
    await expect(
      updateSala(sala.id, {
        nome: sala.nome,
        capacidade: 1, equipamento: 'Teste', precoHora: 10,
        tipoServicoIds: [segundoServico.id],
      })
    ).rejects.toThrow('agendamento(s) futuro(s)');

    // Garantir que o estado da sala não mudou (a transação não chegou a correr)
    const aindaAssociados = await prisma.salaServico.findMany({ where: { salaId: sala.id } });
    expect(aindaAssociados.length).toBe(2);

    await limparContextoAgendamento(ctx);
  });

  test('BET-485: updateSala permite ao apenas ADICIONAR serviços (não remove nenhum)', async () => {
    // Nada é removido -> não há nada para validar -> deve passar mesmo com agendamento futuro.
    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });
    if (!segundoServico) throw new Error('São precisos pelo menos 2 TipoServico no seed para este teste.');

    const sala = await createSala({
      nome: uniqueNome('Sala BET485 Adicionar'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId });

    const atualizada = await updateSala(sala.id, {
      nome: sala.nome,
      capacidade: 1, equipamento: 'Teste', precoHora: 10,
      tipoServicoIds: [servicoId, segundoServico.id],
    });
    expect(atualizada.servicos.length).toBe(2);

    await limparContextoAgendamento(ctx);
  });


  // BET-460 — Preço antigo preservado nas reservas futuras já existentes
  // O snapshot do preço já é garantido pelo schema -> Agendamento.valorTotal e AgendamentoServico.precoNoMomento são gravados na criação. 
  // Este teste é um regression guard — falha se um dia o updateSala mudar para tocar nos agendamentos.

  test('BET-460: editar precoHora da sala não altera valorTotal nem precoNoMomento de agendamentos existentes', async () => {
    const sala = await createSala({
      nome: uniqueNome('Sala BET460 Snapshot'),
      capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId],
    });
    const ctx = await criarAgendamentoNaSala({ salaId: sala.id, tipoServicoId: servicoId });

    // Capturar snapshots antes do update
    const agendamentoAntes = await prisma.agendamento.findUnique({ where: { id: ctx.agendamentoId } });
    const servicoAntes = await prisma.agendamentoServico.findUnique({ where: { id: ctx.agendamentoServicoId } });

    // Alterar o preço da sala (de 10 para 999.99)
    await updateSala(sala.id, {
      nome: sala.nome,
      capacidade: 1, equipamento: 'Teste',
      precoHora: 999.99,
      tipoServicoIds: [servicoId],
    });

    // Verificar que o agendamento não mudou
    const agendamentoDepois = await prisma.agendamento.findUnique({ where: { id: ctx.agendamentoId } });
    const servicoDepois = await prisma.agendamentoServico.findUnique({ where: { id: ctx.agendamentoServicoId } });

    expect(Number(agendamentoDepois.valorTotal)).toBe(Number(agendamentoAntes.valorTotal));
    expect(Number(servicoDepois.precoNoMomento)).toBe(Number(servicoAntes.precoNoMomento));

    const salaDepois = await getSalaById(sala.id);
    expect(Number(salaDepois.precoHora)).toBe(999.99);

    await limparContextoAgendamento(ctx);
  });
});