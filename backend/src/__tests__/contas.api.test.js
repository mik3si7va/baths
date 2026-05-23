const request = require("supertest");
const { app } = require("../server");
const { prisma } = require("../db/prismaClient");

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@bet.com`;
}

async function createFuncionario(email) {
  const res = await request(app)
    .post("/funcionarios")
    .send({
      nomeCompleto: "Funcionario Conta Teste",
      cargo: "BANHISTA",
      telefone: "911000111",
      email,
      porteAnimais: ["MEDIO"],
      tipoServicoIds: [],
      horario: {
        diasSemana: ["SEGUNDA", "TERCA"],
        horaInicio: "09:00",
        horaFim: "18:00",
      },
    });

  expect(res.status).toBe(201);
  return res.body;
}

describe("API Contas", () => {
  const createdEmails = [];

  afterEach(async () => {
    if (createdEmails.length > 0) {
      await prisma.utilizador.deleteMany({
        where: { email: { in: createdEmails.splice(0) } },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("GET /contas/funcionarios devolve lista", async () => {
    const res = await request(app).get("/contas/funcionarios");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("PATCH /contas/funcionarios/{id}/estado atualiza estado da conta", async () => {
    const email = uniqueEmail("conta.patch");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    const convite = await request(app).post(`/contas/funcionarios/${funcionario.id}/convite`);
    expect(convite.status).toBe(200);

    const res = await request(app)
      .patch(`/contas/funcionarios/${funcionario.id}/estado`)
      .send({ estadoConta: "INATIVA" });

    expect(res.status).toBe(200);
    expect(res.body.estadoConta).toBe("INATIVA");
    expect(res.body.email).toBe(email);
    expect(res.body.temPassword).toBe(false);

    const utilizador = await prisma.utilizador.findUnique({
      where: { id: funcionario.id },
      select: { passwordHash: true },
    });
    expect(utilizador.passwordHash).toBeNull();
  });

  test("POST /contas/funcionarios/{id}/convite gera link e deixa conta sem password", async () => {
    const email = uniqueEmail("conta.convite");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    const res = await request(app).post(`/contas/funcionarios/${funcionario.id}/convite`);

    expect(res.status).toBe(200);
    expect(res.body.convite.definirPasswordUrl).toContain("/definir-password?token=");
    expect(res.body.convite.expiresAt).toBeTruthy();
    expect(res.body.email).toEqual(
      expect.objectContaining({
        sent: false,
        skipped: true,
        debugVisible: expect.any(Boolean),
      }),
    );
    expect(res.body.conta.estadoConta).toBe("ATIVA");
    expect(res.body.conta.temPassword).toBe(false);

    const utilizador = await prisma.utilizador.findUnique({
      where: { id: funcionario.id },
      select: { passwordHash: true },
    });
    expect(utilizador.passwordHash).toBeNull();

    const tokens = await prisma.passwordResetToken.findMany({
      where: { utilizadorId: funcionario.id, usedAt: null },
    });
    expect(tokens).toHaveLength(1);
  });
});
