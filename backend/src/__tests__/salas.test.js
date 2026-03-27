const {
  getAllSalas,
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

describe('Gestao de Salas - Testes Unitarios', () => {
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
    salas.forEach((sala) => {
      expect(sala.ativo).toBe(true);
    });
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
    ).rejects.toThrow(`Ja existe uma sala com o nome "${nome}".`);

    await prisma.salaServico.deleteMany({ where: { sala: { nome } } });
    await prisma.sala.deleteMany({ where: { nome } });
  });

  test('createSala falha sem campos obrigatorios', async () => {
    await expect(
      createSala({ nome: '', capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] })
    ).rejects.toThrow('nome, capacidade, equipamento e precoHora sao obrigatorios.');
  });

  test('createSala falha sem tipoServicoIds', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [] })
    ).rejects.toThrow('tipoServicoIds e obrigatorio e deve ter pelo menos um servico.');
  });

  test('createSala falha com tipoServicoIds nao UUID', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: ['BANHO'] })
    ).rejects.toThrow('tipoServicoIds deve conter apenas UUIDs validos.');
  });

  test('createSala falha com capacidade invalida', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 0, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] })
    ).rejects.toThrow('capacidade deve ser um numero inteiro positivo.');
  });

  test('createSala falha com precoHora invalido', async () => {
    await expect(
      createSala({ nome: uniqueNome('Sala'), capacidade: 1, equipamento: 'Teste', precoHora: -5, tipoServicoIds: [servicoId] })
    ).rejects.toThrow('precoHora deve ser um numero positivo.');
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
    ).rejects.toThrow(`Ja existe uma sala com o nome "${nomeA}".`);

    await prisma.salaServico.deleteMany({ where: { salaId: { in: [salaA.id, salaB.id] } } });
    await prisma.sala.deleteMany({ where: { id: { in: [salaA.id, salaB.id] } } });
  });

  test('updateSala falha sem tipoServicoIds', async () => {
    const nome = uniqueNome('Sala Update Sem Servicos');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      updateSala(sala.id, { nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [] })
    ).rejects.toThrow('tipoServicoIds e obrigatorio e deve ter pelo menos um servico.');

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

  test('addServicoToSala falha com UUID invalido para salaId', async () => {
    await expect(
      addServicoToSala({ salaId: 'nao-e-uuid', tipoServicoId: servicoId })
    ).rejects.toThrow('salaId invalido. Deve ser um UUID valido.');
  });

  test('addServicoToSala falha com UUID invalido para tipoServicoId', async () => {
    const nome = uniqueNome('Sala UUID');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      addServicoToSala({ salaId: sala.id, tipoServicoId: 'BANHO' })
    ).rejects.toThrow('tipoServicoId invalido. Deve ser um UUID valido.');

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('addServicoToSala falha se sala nao existir', async () => {
    await expect(
      addServicoToSala({ salaId: '00000000-0000-4000-8000-000000000000', tipoServicoId: servicoId })
    ).rejects.toThrow('Sala nao encontrada.');
  });

  test('addServicoToSala falha com associacao duplicada', async () => {
    const nome = uniqueNome('Sala Duplicado Servico');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    await expect(
      addServicoToSala({ salaId: sala.id, tipoServicoId: servicoId })
    ).rejects.toThrow('Este servico ja esta associado a esta sala.');

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

  test('removeServicoFromSala remove a associacao correctamente', async () => {
    const nome = uniqueNome('Sala Remove Servico');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    const resultado = await removeServicoFromSala({ salaId: sala.id, tipoServicoId: servicoId });

    expect(resultado.removed).toBe(true);

    const servicosRestantes = await getServicosBySala(sala.id);
    expect(servicosRestantes.length).toBe(0);

    await prisma.sala.delete({ where: { id: sala.id } });
  });

  test('removeServicoFromSala falha se associacao nao existir', async () => {
    const nome = uniqueNome('Sala Remove Inexistente');
    const sala = await createSala({ nome, capacidade: 1, equipamento: 'Teste', precoHora: 10, tipoServicoIds: [servicoId] });

    const segundoServico = await prisma.tipoServico.findFirst({ where: { id: { not: servicoId } } });

    await expect(
      removeServicoFromSala({ salaId: sala.id, tipoServicoId: segundoServico.id })
    ).rejects.toThrow('Associacao nao encontrada.');

    await prisma.salaServico.deleteMany({ where: { salaId: sala.id } });
    await prisma.sala.delete({ where: { id: sala.id } });
  });
});