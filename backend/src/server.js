const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const { prisma, closePrisma } = require("./db/prismaClient");
const {
  getAllEvents,
  createEvent,
} = require("./repositories/eventsRepository");
const {
  getAllTiposServico,
  createTipoServico,
  updateTipoServico,
  deleteTipoServico,
  reativarTipoServico,
  getAllRegrasPreco,
  createRegraPreco,
} = require("./repositories/repositorioServicos");
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
} = require("./repositories/repositorioSalas");
const {
  getAllFuncionarios,
  getFuncionarioById,
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  setFuncionarioAtivo,
} = require("./repositories/repositorioFuncionarios");
const TipoFuncionarioEnum = require("./domain/enums/TipoFuncionarioEnum");
const PorteEnum = require("./domain/enums/PorteEnum");
const DiaSemanaEnum = require("./domain/enums/DiaSemanaEnum");
const {
  getAllClientes,
  getClienteById,
  createClienteTemporario,
  cancelarClienteTemporario,
  confirmarClienteComAnimal,
  createAnimal,
  getAnimalById,
  getAgendamentosByAnimalId,
  updateCliente,
  updateAnimal,
  getAnimaisByCliente,
  deleteAnimal,
} = require("./repositories/repositorioClientes");
const {
  getContasFuncionarios,
  updateEstadoContaFuncionario,
  gerarConviteFuncionario,
} = require("./repositories/repositorioContas");
const {
  loginUtilizador,
  solicitarRecuperacaoPassword,
  definirPasswordComToken,
} = require("./repositories/repositorioAuth");
const {
  getPerfil,
  updatePerfil,
  alterarPassword,
} = require("./repositories/repositorioPerfil");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  try {
    const user = await loginUtilizador({ email, password });
    return res.json({ user });
  } catch (error) {
    if (
      error.message === "Credenciais invalidas." ||
      error.message === "Conta inativa ou sem acesso." ||
      error.message === "email e password sao obrigatorios."
    ) {
      return res.status(401).json({ error: error.message });
    }

    console.error("Failed to login:", error);
    return res.status(500).json({ error: "Failed to login" });
  }
});

app.post("/auth/recuperar-password", async (req, res) => {
  try {
    const result = await solicitarRecuperacaoPassword(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/auth/definir-password", async (req, res) => {
  try {
    const result = await definirPasswordComToken(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// ─── PERFIL ───────────────────────────────────────────────────────────────────

app.get("/perfil/:id", async (req, res) => {
  try {
    const perfil = await getPerfil(req.params.id);
    if (!perfil) {
      return res.status(404).json({ error: "Utilizador nao encontrado" });
    }

    return res.json(perfil);
  } catch (error) {
    console.error("Failed to fetch perfil:", error);
    return res.status(500).json({ error: "Failed to fetch perfil" });
  }
});

app.patch("/perfil/:id", async (req, res) => {
  try {
    const perfil = await updatePerfil(req.params.id, req.body || {});
    if (!perfil) {
      return res.status(404).json({ error: "Utilizador nao encontrado" });
    }

    return res.json(perfil);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.patch("/perfil/:id/password", async (req, res) => {
  try {
    const result = await alterarPassword(req.params.id, req.body || {});
    if (!result) {
      return res.status(404).json({ error: "Utilizador nao encontrado" });
    }

    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// ─── CONTAS ───────────────────────────────────────────────────────────────────

app.get("/contas/funcionarios", async (_req, res) => {
  try {
    return res.json(await getContasFuncionarios());
  } catch (error) {
    console.error("Failed to fetch contas de funcionarios:", error);
    return res.status(500).json({ error: "Failed to fetch contas de funcionarios" });
  }
});

app.patch("/contas/funcionarios/:id/estado", async (req, res) => {
  const { estadoConta } = req.body || {};

  if (!estadoConta) {
    return res.status(400).json({ error: "estadoConta e obrigatorio" });
  }

  try {
    const conta = await updateEstadoContaFuncionario(req.params.id, estadoConta);
    if (!conta) {
      return res.status(404).json({ error: "Funcionario nao encontrado" });
    }

    return res.json(conta);
  } catch (error) {
    console.error("Failed to update conta de funcionario:", error);
    return res.status(400).json({ error: error.message });
  }
});

app.post("/contas/funcionarios/:id/convite", async (req, res) => {
  try {
    const result = await gerarConviteFuncionario(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Funcionario nao encontrado" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Failed to generate funcionario invite:", error);
    return res.status(400).json({ error: error.message });
  }
});

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /clientes:
 *   get:
 *     summary: Lista todos os clientes confirmados (ATIVA) com os seus animais
 *     tags: [Clientes]
 *     responses:
 *       200:
 *         description: Lista de clientes
 *       500:
 *         description: Erro interno
 */
app.get("/clientes", async (_req, res) => {
  try {
    return res.json(await getAllClientes());
  } catch (error) {
    console.error("Failed to fetch clientes:", error);
    return res.status(500).json({ error: "Failed to fetch clientes" });
  }
});

/**
 * @swagger
 * /clientes/{id}:
 *   get:
 *     summary: Obtem um cliente por id (inclui animais)
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       404:
 *         description: Cliente nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrado:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Cliente nao encontrado
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/clientes/:id", async (req, res) => {
  try {
    const cliente = await getClienteById(req.params.id);
    if (!cliente)
      return res.status(404).json({ error: "Cliente nao encontrado" });
    return res.json(cliente);
  } catch (error) {
    console.error("Failed to fetch cliente:", error);
    return res.status(500).json({ error: "Failed to fetch cliente" });
  }
});

/**
 * @swagger
 * /clientes/{id}:
 *   put:
 *     summary: Atualiza os dados de um cliente existente
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@email.com
 *               telefone:
 *                 type: string
 *                 example: '912345678'
 *               nif:
 *                 type: string
 *                 example: '123456789'
 *               morada:
 *                 type: string
 *                 example: Rua das Flores, 10
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Cliente atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cliente'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Cliente não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrado:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Cliente não encontrado.
 *       409:
 *         description: Email ou NIF duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               emailDuplicado:
 *                 summary: Email já em uso
 *                 value:
 *                   error: Já existe uma conta com o email "joao@email.com".
 *               nifDuplicado:
 *                 summary: NIF já em uso
 *                 value:
 *                   error: Já existe um cliente com o NIF "123456789".
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.put("/clientes/:id", async (req, res) => {
  const { nome, email, telefone, nif, morada, password } = req.body || {};

  try {
    const clienteAtualizado = await updateCliente(req.params.id, {
      nome,
      email,
      telefone,
      nif,
      morada,
      password,
    });
    return res.json(clienteAtualizado);
  } catch (error) {
    console.error("Failed to update cliente:", error);
    if (error.message === "Cliente não encontrado.") {
      return res.status(404).json({ error: error.message });
    }
    if (
      error.message?.startsWith("Já existe uma conta com o email") ||
      error.message?.startsWith("Já existe um cliente com o NIF")
    ) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /animais/{id}:
 *   put:
 *     summary: Atualiza os dados de um animal existente
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do animal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clienteId]
 *             properties:
 *               clienteId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do cliente dono do animal
 *               nome:
 *                 type: string
 *                 example: Rex
 *               especie:
 *                 type: string
 *                 example: Cão
 *               raca:
 *                 type: string
 *                 example: Labrador
 *               porte:
 *                 type: string
 *                 example: GRANDE
 *               dataNascimento:
 *                 type: string
 *                 format: date
 *                 example: '2020-03-15'
 *               alergias:
 *                 type: string
 *                 example: Pólen
 *               observacoes:
 *                 type: string
 *                 example: Muito ativo
 *     responses:
 *       200:
 *         description: Animal atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Animal'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Animal ou cliente nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               animalNaoEncontrado:
 *                 summary: Animal inexistente
 *                 value:
 *                   error: Animal não encontrado.
 *               clienteNaoEncontrado:
 *                 summary: Cliente inexistente
 *                 value:
 *                   error: Cliente não encontrado.
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.put("/animais/:id", async (req, res) => {
  const {
    clienteId,
    nome,
    especie,
    raca,
    porte,
    dataNascimento,
    alergias,
    observacoes,
  } = req.body || {};

  try {
    const animalAtualizado = await updateAnimal(req.params.id, {
      clienteId,
      nome,
      especie,
      raca,
      porte,
      dataNascimento,
      alergias,
      observacoes,
    });
    return res.json(animalAtualizado);
  } catch (error) {
    console.error("Failed to update animal:", error);
    if (
      error.message === "Cliente não encontrado." ||
      error.message === "Animal não encontrado."
    ) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /animais/{id}:
 *   delete:
 *     summary: Inativa (soft delete) um animal - marca como eliminado
 *     tags: [Clientes]
 *     description: >
 *       Elimina (soft delete) a ficha de um animal. O registo é mantido na base de dados
 *       para fins de auditoria e faturação, mas o animal é marcado como inativo.
 *
 *       Validações:
 *       - Apenas animais sem agendamentos futuros podem ser eliminados
 *       - Histórico de serviços passados é mantido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do animal
 *     responses:
 *       200:
 *         description: Animal inativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: string
 *                   format: uuid
 *       404:
 *         description: Animal não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Animal tem agendamentos futuros associados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Não é possível eliminar o animal \"Rex\" porque tem 1 agendamento(s) futuro(s) associado(s). Cancele os agendamentos antes de eliminar o animal."
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete("/animais/:id", async (req, res) => {
  try {
    const result = await deleteAnimal(req.params.id);

    if (!result) {
      return res.status(404).json({ error: "Animal não encontrado." });
    }

    return res.json(result);
  } catch (error) {
    console.error("Failed to delete animal:", error);
    if (error.message && error.message.includes("agendamento(s) futuro(s)")) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /clientes:
 *   post:
 *     summary: >
 *       Cria um cliente temporário (PENDENTE_VERIFICACAO).
 *       O registo só fica oficial após POST /clientes/:id/animais/confirmar.
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, telefone, password]
 *             properties:
 *               nome:     { type: string }
 *               email:    { type: string, format: email }
 *               telefone: { type: string }
 *               password: { type: string, minLength: 8 }
 *               nif:      { type: string }
 *               morada:   { type: string }
 *     responses:
 *       201:
 *         description: Cliente temporário criado — aguarda confirmação via animal
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email ou NIF duplicado
 */
app.post("/clientes", async (req, res) => {
  const { nome, email, telefone, password, nif, morada } = req.body || {};

  if (!nome || !email || !telefone || !password) {
    return res
      .status(400)
      .json({ error: "nome, email, telefone e password sao obrigatorios" });
  }

  try {
    const novoCliente = await createClienteTemporario({
      nome,
      email,
      telefone,
      password,
      nif,
      morada,
    });
    return res.status(201).json(novoCliente);
  } catch (error) {
    console.error("Failed to create cliente:", error);
    if (
      error.message?.startsWith("Já existe uma conta com o email") ||
      error.message?.startsWith("Já existe um cliente com o NIF")
    ) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /clientes/{id}:
 *   delete:
 *     summary: Cancela e elimina um cliente temporário (PENDENTE_VERIFICACAO sem animais)
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Cliente cancelado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cancelled:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: string
 *                   format: uuid
 *       404:
 *         description: Cliente nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrado:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Cliente nao encontrado
 *       409:
 *         description: Cliente ja confirmado ou com animais registados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoPermitido:
 *                 summary: Cancelamento nao permitido
 *                 value:
 *                   error: Nao e possivel cancelar um cliente ja confirmado ou com animais registados.
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete("/clientes/:id", async (req, res) => {
  try {
    const result = await cancelarClienteTemporario(req.params.id);
    if (!result)
      return res.status(404).json({ error: "Cliente nao encontrado" });
    if (!result.cancelled) {
      return res.status(409).json({
        error:
          "Nao e possivel cancelar um cliente ja confirmado ou com animais registados.",
      });
    }
    return res.json(result);
  } catch (error) {
    console.error("Failed to cancel cliente:", error);
    return res.status(500).json({ error: "Failed to cancel cliente" });
  }
});

// ─── ANIMAIS ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /clientes/{id}/animais/confirmar:
 *   post:
 *     summary: >
 *       Regista o primeiro animal e confirma o cliente numa transação atómica.
 *       estadoConta passa de PENDENTE_VERIFICACAO → ATIVA.
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, especie, porte]
 *             properties:
 *               nome:           { type: string }
 *               especie:        { type: string }
 *               raca:           { type: string }
 *               porte:          { type: string }
 *               dataNascimento: { type: string, format: date }
 *               alergias:       { type: string }
 *               observacoes:    { type: string }
 *     responses:
 *       201:
 *         description: Cliente confirmado e animal registado
 *       400:
 *         description: Dados inválidos ou cliente já confirmado
 *       404:
 *         description: Cliente não encontrado
 */
app.post("/clientes/:id/animais/confirmar", async (req, res) => {
  const { id } = req.params;
  const { nome, especie, raca, porte, dataNascimento, alergias, observacoes } =
    req.body || {};

  if (!nome || !especie || !porte) {
    return res
      .status(400)
      .json({ error: "nome, especie e porte sao obrigatorios" });
  }

  try {
    const result = await confirmarClienteComAnimal(id, {
      nome,
      especie,
      raca,
      porte,
      dataNascimento,
      alergias,
      observacoes,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error("Failed to confirm cliente com animal:", error);
    if (error.message === "Cliente não encontrado.") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /clientes/{id}/animais:
 *   get:
 *     summary: Lista os animais de um cliente
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Lista de animais do cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Animal'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/clientes/:id/animais", async (req, res) => {
  try {
    return res.json(await getAnimaisByCliente(req.params.id));
  } catch (error) {
    console.error("Failed to fetch animais:", error);
    return res.status(500).json({ error: "Failed to fetch animais" });
  }
});

app.get("/animais/:id", async (req, res) => {
  try {
    const animal = await getAnimalById(req.params.id);
    if (!animal) {
      return res.status(404).json({ error: "Animal não encontrado" });
    }
    return res.json(animal);
  } catch (error) {
    console.error("Failed to fetch animal:", error);
    return res.status(500).json({ error: "Failed to fetch animal" });
  }
});

app.get("/animais/:id/agendamentos", async (req, res) => {
  try {
    const data = await getAgendamentosByAnimalId(req.params.id);
    return res.json(data);
  } catch (error) {
    console.error("Failed to fetch agendamentos:", error);
    return res.status(500).json({ error: "Failed to fetch agendamentos" });
  }
});

/**
 * @swagger
 * /clientes/{id}/animais:
 *   post:
 *     summary: Adiciona um animal adicional a um cliente já confirmado (ATIVA)
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, especie, porte]
 *             properties:
 *               nome:           { type: string }
 *               especie:        { type: string }
 *               raca:           { type: string }
 *               porte:          { type: string }
 *               dataNascimento: { type: string, format: date }
 *               alergias:       { type: string }
 *               observacoes:    { type: string }
 *     responses:
 *       201:
 *         description: Animal registado
 *       400:
 *         description: Dados inválidos ou cliente não confirmado
 *       404:
 *         description: Cliente não encontrado
 */
app.post("/clientes/:id/animais", async (req, res) => {
  const { id } = req.params;
  const { nome, especie, raca, porte, dataNascimento, alergias, observacoes } =
    req.body || {};

  if (!nome || !especie || !porte) {
    return res
      .status(400)
      .json({ error: "nome, especie e porte sao obrigatorios" });
  }

  try {
    const novoAnimal = await createAnimal(id, {
      nome,
      especie,
      raca,
      porte,
      dataNascimento,
      alergias,
      observacoes,
    });
    return res.status(201).json(novoAnimal);
  } catch (error) {
    console.error("Failed to create animal:", error);
    if (error.message === "Cliente não encontrado.") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /servicos:
 *   get:
 *     summary: Lista todos os tipos de serviço ativos
 *     tags: [Servicos]
 *     responses:
 *       200:
 *         description: Lista de tipos de serviço obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoServico'
 *       500:
 *         description: Erro interno ao obter serviços
 */
app.get("/servicos", async (_req, res) => {
  try {
    const servicos = await getAllTiposServico();
    return res.json(servicos);
  } catch (error) {
    console.error("Failed to fetch servicos:", error);
    return res.status(500).json({ error: "Failed to fetch servicos" });
  }
});

/**
 * @swagger
 * /servicos:
 *   post:
 *     summary: Cria um novo tipo de serviço
 *     tags: [Servicos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo]
 *             properties:
 *               tipo:
 *                 type: string
 *                 description: Nome do tipo de serviço
 *                 example: BANHO
 *     responses:
 *       201:
 *         description: Tipo de serviço criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno ao criar serviço
 */
app.post("/servicos", async (req, res) => {
  const { tipo } = req.body || {};
  if (!tipo) {
    return res.status(400).json({ error: "tipo é obrigatório" });
  }
  try {
    const novo = await createTipoServico({ tipo });
    return res.status(201).json(novo);
  } catch (error) {
    console.error("Failed to create servico:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /servicos/{id}:
 *   put:
 *     summary: Atualiza um tipo de serviço e substitui as suas regras de preço
 *     tags: [Servicos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do tipo de serviço
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, regrasPreco]
 *             properties:
 *               tipo:
 *                 type: string
 *                 example: 'BANHO'
 *               regrasPreco:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [porteAnimal, precoBase, duracaoMinutos]
 *                   properties:
 *                     porteAnimal:
 *                       $ref: '#/components/schemas/PorteEnum'
 *                     precoBase:
 *                       type: number
 *                       example: 25.00
 *                     duracaoMinutos:
 *                       type: integer
 *                       example: 45
 *     responses:
 *       200:
 *         description: Serviço atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Serviço não encontrado
 *       409:
 *         description: Nome já existe
 *       500:
 *         description: Erro interno
 */
app.put("/servicos/:id", async (req, res) => {
  const { id } = req.params;
  const { tipo, regrasPreco } = req.body || {};

  if (!tipo) {
    return res.status(400).json({ error: "tipo é obrigatório" });
  }
  if (!Array.isArray(regrasPreco) || regrasPreco.length === 0) {
    return res.status(400).json({
      error: "regrasPreco é obrigatório e deve conter pelo menos uma regra",
    });
  }

  try {
    const resultado = await updateTipoServico(id, { tipo, regrasPreco });

    if (!resultado) {
      return res.status(404).json({ error: "Servico nao encontrado" });
    }

    return res.json(resultado);
  } catch (error) {
    console.error("Failed to update servico:", error);

    if (error.message?.startsWith("Já existe um serviço com o nome")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /servicos/{id}:
 *   delete:
 *     summary: Inativa (soft delete) um tipo de serviço
 *     tags: [Servicos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do tipo de serviço
 *     responses:
 *       200:
 *         description: Serviço inativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: string
 *                   format: uuid
 *       404:
 *         description: Serviço não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrado:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Servico nao encontrado
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete("/servicos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await deleteTipoServico(id);

    if (!result) {
      return res.status(404).json({ error: "Servico nao encontrado" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Failed to delete servico:", error);

    // Agendamentos futuros impedem a inativação — conflito de negócio
    if (error.message?.startsWith("Não é possível inativar o serviço")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to delete servico" });
  }
});

/**
 * @swagger
 * /servicos/{id}/reativar:
 *   post:
 *     summary: Reativa um tipo de serviço inativo
 *     tags: [Servicos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do tipo de serviço
 *     responses:
 *       200:
 *         description: Serviço reativado com sucesso
 *       404:
 *         description: Serviço não encontrado
 *       500:
 *         description: Erro interno
 */
app.post("/servicos/:id/reativar", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await reativarTipoServico(id);

    if (!result) {
      return res.status(404).json({ error: "Servico nao encontrado" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Failed to reativar servico:", error);
    return res.status(500).json({ error: "Failed to reativar servico" });
  }
});

/**
 * @swagger
 * /regras-preco:
 *   get:
 *     summary: Lista todas as regras de preço
 *     tags: [RegrasPreco]
 *     responses:
 *       200:
 *         description: Lista de regras de preço obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RegraPreco'
 *       500:
 *         description: Erro interno ao obter regras de preço
 */
app.get("/regras-preco", async (_req, res) => {
  try {
    const regras = await getAllRegrasPreco();
    return res.json(regras);
  } catch (error) {
    console.error("Failed to fetch regras:", error);
    return res.status(500).json({ error: "Failed to fetch regras" });
  }
});

/**
 * @swagger
 * /regras-preco:
 *   post:
 *     summary: Cria uma nova regra de preço para um tipo de serviço
 *     tags: [RegrasPreco]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipoServicoId
 *               - porteAnimal
 *               - precoBase
 *               - duracaoMinutos
 *             properties:
 *               tipoServicoId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do tipo de serviço associado
 *               porteAnimal:
 *                 $ref: '#/components/schemas/PorteEnum'
 *               precoBase:
 *                 type: number
 *                 description: Preço base do serviço
 *                 example: 25.00
 *               duracaoMinutos:
 *                 type: integer
 *                 description: Duração estimada do serviço em minutos
 *                 example: 45
 *     responses:
 *       201:
 *         description: Regra de preço criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno ao criar regra de preço
 */
app.post("/regras-preco", async (req, res) => {
  const { tipoServicoId, porteAnimal, precoBase, duracaoMinutos } =
    req.body || {};
  if (!tipoServicoId || !porteAnimal || !precoBase || !duracaoMinutos) {
    return res.status(400).json({
      error:
        "tipoServicoId, porteAnimal, precoBase e duracaoMinutos são obrigatórios",
    });
  }
  try {
    const nova = await createRegraPreco({
      tipoServicoId,
      porteAnimal,
      precoBase,
      duracaoMinutos,
    });
    return res.status(201).json(nova);
  } catch (error) {
    console.error("Failed to create regra:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /salas:
 *   get:
 *     summary: Lista todas as salas ativas
 *     tags: [Salas]
 *     responses:
 *       200:
 *         description: Lista de salas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sala'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/salas", async (_req, res) => {
  try {
    const salas = await getAllSalas();
    return res.json(salas);
  } catch (error) {
    console.error("Erro ao obter as salas:", error);
    return res.status(500).json({ error: "Erro ao obter as salas" });
  }
});

/**
 * @swagger
 * /salas/todas:
 *   get:
 *     summary: Lista todas as salas (ativas e inativas) — uso exclusivo do backoffice
 *     tags: [Salas]
 *     responses:
 *       200:
 *         description: Lista de todas as salas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sala'
 *       500:
 *         description: Erro interno
 */
app.get("/salas/todas", async (_req, res) => {
  try {
    const salas = await getAllSalasWithStatus();
    return res.json(salas);
  } catch (error) {
    console.error("Erro ao obter todas as salas:", error);
    return res.status(500).json({ error: "Erro ao obter todas as salas" });
  }
});

/**
 * @swagger
 * /salas/{id}:
 *   get:
 *     summary: Obtém uma sala por id
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *     responses:
 *       200:
 *         description: Sala encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sala'
 *       404:
 *         description: Sala não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrada:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Sala não encontrada
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/salas/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const sala = await getSalaById(id);
    if (!sala) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }

    return res.json(sala);
  } catch (error) {
    console.error("Erro ao obter a sala:", error);
    return res.status(500).json({ error: "Erro ao obter a sala" });
  }
});

/**
 * @swagger
 * /salas:
 *   post:
 *     summary: Cria uma nova sala
 *     tags: [Salas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSalaRequest'
 *     responses:
 *       201:
 *         description: Sala criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sala'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               camposObrigatorios:
 *                 summary: Campos obrigatórios em falta
 *                 value:
 *                   error: 'O campo nome é obrigatório.'
 *       409:
 *         description: Nome já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               nomeDuplicado:
 *                 summary: Nome já existente
 *                 value:
 *                   error: 'Já existe uma sala com o nome "Sala A".'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/salas", async (req, res) => {
  const { nome, capacidade, equipamento, precoHora, tipoServicoIds } =
    req.body || {};
  try {
    const nova = await createSala({
      nome,
      capacidade,
      equipamento,
      precoHora,
      tipoServicoIds,
    });
    return res.status(201).json(nova);
  } catch (error) {
    console.error("Erro ao criar a sala:", error);

    if (error.message?.startsWith("Já existe uma sala com o nome")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /salas/{id}:
 *   put:
 *     summary: Atualiza uma sala existente
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSalaRequest'
 *     responses:
 *       200:
 *         description: Sala atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sala'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               camposObrigatorios:
 *                 summary: Campos obrigatórios em falta
 *                 value:
 *                   error: 'O campo nome é obrigatório.'
 *       404:
 *         description: Sala não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrada:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Sala não encontrada
 *       409:
 *         description: Nome já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               nomeDuplicado:
 *                 summary: Nome já existente
 *                 value:
 *                   error: 'Já existe uma sala com o nome "Sala A".'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.put("/salas/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, capacidade, equipamento, precoHora, tipoServicoIds, ativo } =
    req.body || {};

  try {
    const salaAtualizada = await updateSala(id, {
      nome,
      capacidade,
      equipamento,
      precoHora,
      tipoServicoIds,
      ativo,
    });

    if (!salaAtualizada) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }

    return res.json(salaAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar a sala:", error);

    if (error.message?.startsWith("Já existe uma sala com o nome")) {
      return res.status(409).json({ error: error.message });
    }

    // BET-485: 409 se algum dos serviços a desassociar tiver agendamentos futuros
    if (error.code === "SERVICO_TEM_AGENDAMENTOS_FUTUROS") {
      return res.status(409).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /salas/{id}:
 *   delete:
 *     summary: Elimina (inativa) uma sala (soft delete)
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *     responses:
 *       200:
 *         description: Sala inativada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: string
 *                   format: uuid
 *       404:
 *         description: Sala não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrada:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Sala não encontrada
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete("/salas/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await deleteSala(id);
    if (!result) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Erro ao eliminar a sala:", error);

    // BET-180: 409 Conflict se a sala tiver agendamentos futuros
    if (error.code === "SALA_TEM_AGENDAMENTOS_FUTUROS") {
      return res.status(409).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro ao eliminar a sala" });
  }
});

// ════════════════════════════════════════════════════════════════════
// Endpoints granulares de serviços por sala (POST / GET / DELETE)
// ════════════════════════════════════════════════════════════════════
//
// Estas 3 rotas em /salas/:id/servicos gerem associações sala <-> serviço uma a uma (adicionar/remover/listar individualmente).
//
// No frontend optámos por gerir os serviços com checkboxes no próprio form de edição da sala — o admin marca/desmarca os serviços que quer
// e clica "Atualizar Sala". Como a UI envia a lista COMPLETA do estado final, o caminho natural passou a ser o PUT /salas/:id (bulk), que
// recebe todos os tipoServicoIds e faz deleteMany + createMany dentro de uma transação. Por isso, do ponto de vista da UI, estas rotas
// granulares deixaram de fazer sentido — o form nunca precisa delas.
//
// Mantêm-se na API por estas razões:
//  - testes de integração granulares (salas.api.test.js)
//  - futuras UIs que precisem de gestão pontual (ex: botão "+ Serviço" que adicione apenas uma associação sem mexer nas outras)
//  - implementam BET-484 (atualizar associações) e BET-483 (listar serviços associados a uma sala).
/**
 * @swagger
 * /salas/{id}/servicos:
 *   post:
 *     summary: Associa um tipo de serviço a uma sala
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipoServicoId]
 *             properties:
 *               tipoServicoId:
 *                 type: string
 *                 format: uuid
 *                 example: '11111111-1111-1111-1111-111111111111'
 *     responses:
 *       201:
 *         description: Serviço associado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SalaServico'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               campoObrigatorio:
 *                 summary: Campo obrigatório em falta
 *                 value:
 *                   error: 'tipoServicoId é obrigatório'
 *               uuidInvalido:
 *                 summary: UUID inválido
 *                 value:
 *                   error: 'tipoServicoId inválido. Deve ser um UUID valido.'
 *               naoEncontrado:
 *                 summary: Sala ou serviço não encontrado
 *                 value:
 *                   error: 'Sala não encontrada.'
 *       409:
 *         description: Associação já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               associacaoDuplicada:
 *                 summary: Serviço já associado
 *                 value:
 *                   error: 'Este serviço já está associado a esta sala.'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/salas/:id/servicos", async (req, res) => {
  const { id } = req.params;
  const { tipoServicoId } = req.body || {};
  if (!tipoServicoId) {
    return res.status(400).json({ error: "tipoServicoId é obrigatório" });
  }
  try {
    const associacao = await addServicoToSala({ salaId: id, tipoServicoId });
    return res.status(201).json(associacao);
  } catch (error) {
    console.error("Erro ao associar serviço à sala:", error);

    if (error.message?.startsWith("Este serviço já está associado")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /salas/{id}/servicos:
 *   get:
 *     summary: Lista os serviços associados a uma sala
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *     responses:
 *       200:
 *         description: Lista de serviços da sala
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SalaServico'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/salas/:id/servicos", async (req, res) => {
  const { id } = req.params;
  try {
    const servicos = await getServicosBySala(id);
    return res.json(servicos);
  } catch (error) {
    console.error("Erro ao obter os serviços da sala:", error);
    return res.status(500).json({ error: "Erro ao obter os serviços da sala" });
  }
});

/**
 * @swagger
 * /salas/{id}/servicos/{servicoId}:
 *   delete:
 *     summary: Remove a associação de um serviço a uma sala
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *       - in: path
 *         name: servicoId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do tipo de serviço
 *     responses:
 *       200:
 *         description: Associação removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Associaçõo não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrada:
 *                 summary: Associação inexistente
 *                 value:
 *                   error: 'Associação não encontrada.'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete("/salas/:id/servicos/:servicoId", async (req, res) => {
  const { id, servicoId } = req.params;
  try {
    const result = await removeServicoFromSala({
      salaId: id,
      tipoServicoId: servicoId,
    });
    return res.json(result);
  } catch (error) {
    console.error("Erro ao remover serviço da sala:", error);
    if (error.message?.startsWith("Associação não encontrada")) {
      return res.status(404).json({ error: error.message });
    }
    // BET-485: 409 se houver agendamentos futuros para esta combinação sala+serviço
    if (error.code === "SERVICO_TEM_AGENDAMENTOS_FUTUROS") {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /funcionarios:
 *   get:
 *     summary: Lista todos os funcionarios
 *     tags: [Funcionarios]
 *     responses:
 *       200:
 *         description: Lista de funcionarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Funcionario'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/funcionarios", async (_req, res) => {
  try {
    const funcionarios = await getAllFuncionarios();
    return res.json(funcionarios);
  } catch (error) {
    console.error("Failed to fetch funcionarios:", error);
    return res.status(500).json({ error: "Failed to fetch funcionarios" });
  }
});

app.get("/funcionarios/opcoes", (_req, res) => {
  return res.json({
    cargos: Object.values(TipoFuncionarioEnum),
    portes: Object.values(PorteEnum),
    diasSemana: Object.values(DiaSemanaEnum),
  });
});

/**
 * @swagger
 * /funcionarios/{id}:
 *   get:
 *     summary: Obtem um funcionario por id
 *     tags: [Funcionarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do funcionario
 *     responses:
 *       200:
 *         description: Funcionario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Funcionario'
 *       404:
 *         description: Funcionario nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrado:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Funcionario nao encontrado
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/funcionarios/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const funcionario = await getFuncionarioById(id);
    if (!funcionario) {
      return res.status(404).json({ error: "Funcionario nao encontrado" });
    }

    return res.json(funcionario);
  } catch (error) {
    console.error("Failed to fetch funcionario:", error);
    return res.status(500).json({ error: "Failed to fetch funcionario" });
  }
});

/**
 * @swagger
 * /funcionarios:
 *   post:
 *     summary: Cria um novo funcionario
 *     tags: [Funcionarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFuncionarioRequest'
 *     responses:
 *       201:
 *         description: Funcionario criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Funcionario'
 *       400:
 *         description: Dados invalidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               camposObrigatorios:
 *                 summary: Campos obrigatorios em falta
 *                 value:
 *                   error: 'nomeCompleto, cargo, telefone, email e horario sao obrigatorios'
 *               domingoInvalido:
 *                 summary: Domingo nao permitido
 *                 value:
 *                   error: 'Domingo nao pode ser selecionado como dia de trabalho.'
 *               horaInvalida:
 *                 summary: Hora com formato invalido
 *                 value:
 *                   error: 'horaInicio invalido. Use formato HH:mm (ex: 09:00).'
 *               intervaloInvalido:
 *                 summary: Hora inicio maior ou igual a hora fim
 *                 value:
 *                   error: 'horaInicio deve ser menor que horaFim.'
 *               pausaForaTurno:
 *                 summary: Pausa fora do horario de trabalho
 *                 value:
 *                   error: 'A pausa de almoco deve estar dentro do horario de trabalho.'
 *               servicoInexistente:
 *                 summary: ID de servico invalido
 *                 value:
 *                   error: 'Um ou mais servicos nao existem.'
 *       409:
 *         description: Email ja existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               emailDuplicado:
 *                 summary: Email ja existente
 *                 value:
 *                   error: 'Ja existe um funcionario com o email "sofia.r@bet.com".'
 */
app.post("/funcionarios", async (req, res) => {
  const {
    nomeCompleto,
    cargo,
    telefone,
    email,
    porteAnimais,
    tipoServicoIds,
    horario,
  } = req.body || {};

  if (!nomeCompleto || !cargo || !telefone || !email || !horario) {
    return res.status(400).json({
      error: "nomeCompleto, cargo, telefone, email e horario sao obrigatorios",
    });
  }

  try {
    const novoFuncionario = await createFuncionario({
      nomeCompleto,
      cargo,
      telefone,
      email,
      porteAnimais,
      tipoServicoIds,
      horario,
    });

    return res.status(201).json(novoFuncionario);
  } catch (error) {
    console.error("Failed to create funcionario:", error);

    if (error.message?.startsWith("Ja existe um funcionario com o email")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /funcionarios/{id}:
 *   put:
 *     summary: Atualiza um funcionario existente
 *     tags: [Funcionarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do funcionario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFuncionarioRequest'
 *     responses:
 *       200:
 *         description: Funcionario atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Funcionario'
 *       400:
 *         description: Dados invalidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               horarioInvalido:
 *                 summary: Horario invalido
 *                 value:
 *                   error: 'horaInicio deve ser menor que horaFim.'
 *               servicosInvalidos:
 *                 summary: Servico invalido
 *                 value:
 *                   error: 'tipoServicoIds deve conter apenas UUIDs validos.'
 *       404:
 *         description: Funcionario nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrado:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Funcionario nao encontrado
 *       409:
 *         description: Email ja existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               emailDuplicado:
 *                 summary: Email ja existente
 *                 value:
 *                   error: 'Ja existe um funcionario com o email "sofia.r@bet.com".'
 */
app.put("/funcionarios/:id", async (req, res) => {
  const { id } = req.params;
  const {
    nomeCompleto,
    cargo,
    telefone,
    email,
    porteAnimais,
    tipoServicoIds,
    horario,
  } = req.body || {};

  if (!nomeCompleto || !cargo || !telefone || !email || !horario) {
    return res.status(400).json({
      error: "nomeCompleto, cargo, telefone, email e horario sao obrigatorios",
    });
  }

  try {
    const funcionarioAtualizado = await updateFuncionario(id, {
      nomeCompleto,
      cargo,
      telefone,
      email,
      porteAnimais,
      tipoServicoIds,
      horario,
    });

    if (!funcionarioAtualizado) {
      return res.status(404).json({ error: "Funcionario nao encontrado" });
    }

    return res.json(funcionarioAtualizado);
  } catch (error) {
    console.error("Failed to update funcionario:", error);

    if (error.message?.startsWith("Ja existe um funcionario com o email")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message });
  }
});

app.patch("/funcionarios/:id/ativo", async (req, res) => {
  const { id } = req.params;
  const { ativo } = req.body || {};

  if (typeof ativo !== "boolean") {
    return res.status(400).json({ error: "ativo deve ser booleano" });
  }

  try {
    const funcionarioAtualizado = await setFuncionarioAtivo(id, ativo);

    if (!funcionarioAtualizado) {
      return res.status(404).json({ error: "Funcionario nao encontrado" });
    }

    return res.json(funcionarioAtualizado);
  } catch (error) {
    console.error("Failed to update funcionario active status:", error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /funcionarios/{id}:
 *   delete:
 *     summary: Remove (inativa) um funcionario
 *     tags: [Funcionarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do funcionario
 *     responses:
 *       200:
 *         description: Funcionario inativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed:
 *                   type: boolean
 *                   example: true
 *                 id:
 *                   type: string
 *                   format: uuid
 *       404:
 *         description: Funcionario nao encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               naoEncontrado:
 *                 summary: Sem resultado para o id
 *                 value:
 *                   error: Funcionario nao encontrado
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete("/funcionarios/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await deleteFuncionario(id);
    if (!result) {
      return res.status(404).json({ error: "Funcionario nao encontrado" });
    }

    return res.json(result);
  } catch (error) {
    console.error("Failed to delete funcionario:", error);
    return res.status(400).json({ error: error.message || "Failed to delete funcionario" });
  }
});

/**
 * @swagger
 * /events:
 *   get:
 *     summary: Lista todos os eventos
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: Lista de eventos obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Event'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/events", async (_req, res) => {
  try {
    const events = await getAllEvents();
    return res.json(events);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
});

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Cria um novo evento
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, start, end]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Consulta de rotina
 *               start:
 *                 type: string
 *                 format: date-time
 *                 example: '2026-06-01T09:00:00.000Z'
 *               end:
 *                 type: string
 *                 format: date-time
 *                 example: '2026-06-01T10:00:00.000Z'
 *     responses:
 *       201:
 *         description: Evento criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       400:
 *         description: Dados inválidos — title, start e end são obrigatórios
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               camposObrigatorios:
 *                 summary: Campos em falta
 *                 value:
 *                   error: title, start, and end are required
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/events", async (req, res) => {
  const { title, start, end } = req.body || {};

  if (!title || !start || !end) {
    return res
      .status(400)
      .json({ error: "title, start, and end are required" });
  }

  try {
    const newEvent = await createEvent({ title, start, end });
    return res.status(201).json(newEvent);
  } catch (error) {
    console.error("Failed to create event:", error);
    return res.status(500).json({ error: "Failed to create event" });
  }
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database connection ready.");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Backend a ouvir na porta ${PORT}!`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closePrisma();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ROTAS DE TESTE
// Estas rotas só estão disponíveis em ambiente de teste (NODE_ENV=test).
// São usadas pelos testes de aceitação (Cypress) para limpar dados criados durante os testes,
// garantindo que a base de dados não acumula lixo.
// NUNCA devem ser usadas em produção.

app.delete("/test/salas-cypress", async (_req, res) => {
  // Só funciona em ambiente de teste
  if (process.env.NODE_ENV !== "test") {
    return res
      .status(403)
      .json({ error: "Apenas disponivel em ambiente de teste." });
  }

  try {
    // Apaga salas criadas pelos testes Cypress — identificadas pelo prefixo do nome
    await prisma.salaServico.deleteMany({
      where: { sala: { nome: { startsWith: "Sala Cypress" } } },
    });
    await prisma.sala.deleteMany({
      where: { nome: { startsWith: "Sala Cypress" } },
    });

    return res.json({
      ok: true,
      message: "Salas de teste removidas com sucesso.",
    });
  } catch (error) {
    console.error("Failed to cleanup test salas:", error);
    return res.status(500).json({ error: "Erro ao limpar salas de teste." });
  }
});

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
