const bcrypt = require("bcrypt");
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
      nomeCompleto: "Funcionario Perfil Teste",
      cargo: "BANHISTA",
      telefone: "911222333",
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

describe("API Perfil", () => {
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

  test("GET /perfil/{id} devolve dados do funcionario", async () => {
    const email = uniqueEmail("perfil.get");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    const res = await request(app).get(`/perfil/${funcionario.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: funcionario.id,
        email,
        telefone: "911222333",
        tipoConta: "FUNCIONARIO",
        cargo: "BANHISTA",
      }),
    );
  });

  test("PATCH /perfil/{id} atualiza telefone", async () => {
    const email = uniqueEmail("perfil.patch");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    const res = await request(app)
      .patch(`/perfil/${funcionario.id}`)
      .send({ telefone: "919999999" });

    expect(res.status).toBe(200);
    expect(res.body.telefone).toBe("919999999");

    const row = await prisma.funcionario.findUnique({
      where: { id: funcionario.id },
      select: { telefone: true },
    });
    expect(row.telefone).toBe("919999999");
  });

  test("PATCH /perfil/{id}/password valida password atual e altera password", async () => {
    const email = uniqueEmail("perfil.password");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    await prisma.utilizador.update({
      where: { id: funcionario.id },
      data: {
        estadoConta: "ATIVA",
        passwordHash: await bcrypt.hash("Password123", 10),
      },
    });

    const wrong = await request(app)
      .patch(`/perfil/${funcionario.id}/password`)
      .send({
        passwordAtual: "Errada123",
        novaPassword: "NovaPassword123",
        confirmarPassword: "NovaPassword123",
      });

    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe("Palavra-passe atual incorreta.");

    const ok = await request(app)
      .patch(`/perfil/${funcionario.id}/password`)
      .send({
        passwordAtual: "Password123",
        novaPassword: "NovaPassword123",
        confirmarPassword: "NovaPassword123",
      });

    expect(ok.status).toBe(200);
    expect(ok.body.updated).toBe(true);

    const updated = await prisma.utilizador.findUnique({
      where: { id: funcionario.id },
      select: { passwordHash: true },
    });
    await expect(bcrypt.compare("NovaPassword123", updated.passwordHash)).resolves.toBe(true);
  });
});
