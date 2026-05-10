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
      nomeCompleto: "Funcionario Login Teste",
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

describe("API Auth", () => {
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

  test("POST /auth/login autentica funcionario ativo com password", async () => {
    const email = uniqueEmail("auth.login.ok");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    await prisma.utilizador.update({
      where: { id: funcionario.id },
      data: {
        estadoConta: "ATIVA",
        ativo: true,
        passwordHash: await bcrypt.hash("Password123", 10),
      },
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: email.toUpperCase(), password: "Password123" });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(
      expect.objectContaining({
        id: funcionario.id,
        email,
        tipoConta: "FUNCIONARIO",
        cargo: "BANHISTA",
        estadoConta: "ATIVA",
      }),
    );
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test("POST /auth/login rejeita password incorreta", async () => {
    const email = uniqueEmail("auth.login.wrong");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    await prisma.utilizador.update({
      where: { id: funcionario.id },
      data: {
        estadoConta: "ATIVA",
        ativo: true,
        passwordHash: await bcrypt.hash("Password123", 10),
      },
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "Errada123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciais invalidas.");
  });

  test("POST /auth/login rejeita conta inativa", async () => {
    const email = uniqueEmail("auth.login.inativa");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    await prisma.utilizador.update({
      where: { id: funcionario.id },
      data: {
        estadoConta: "INATIVA",
        ativo: false,
        passwordHash: await bcrypt.hash("Password123", 10),
      },
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "Password123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Conta inativa ou sem acesso.");
  });

  test("POST /auth/definir-password define password com token valido", async () => {
    const email = uniqueEmail("auth.definir.password");
    createdEmails.push(email);
    const funcionario = await createFuncionario(email);

    const convite = await request(app).post(`/contas/funcionarios/${funcionario.id}/convite`);
    expect(convite.status).toBe(200);

    const url = new URL(convite.body.convite.definirPasswordUrl);
    const token = url.searchParams.get("token");

    const res = await request(app)
      .post("/auth/definir-password")
      .send({
        token,
        novaPassword: "NovaPassword123",
        confirmarPassword: "NovaPassword123",
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(
      expect.objectContaining({
        id: funcionario.id,
        email,
        tipoConta: "FUNCIONARIO",
      }),
    );

    const utilizador = await prisma.utilizador.findUnique({
      where: { id: funcionario.id },
      select: { passwordHash: true, estadoConta: true },
    });
    expect(utilizador.estadoConta).toBe("ATIVA");
    await expect(bcrypt.compare("NovaPassword123", utilizador.passwordHash)).resolves.toBe(true);

    const reuse = await request(app)
      .post("/auth/definir-password")
      .send({
        token,
        novaPassword: "OutraPassword123",
        confirmarPassword: "OutraPassword123",
      });

    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe("Link invalido ou expirado.");
  });
});
