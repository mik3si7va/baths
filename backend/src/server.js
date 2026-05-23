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
} = require("./repositories/repositorioFuncionarios");
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
  getAllAgendamentos,
  getAgendamentoById,
} = require("./repositories/repositorioAgendamentos");
const {
  getFaturaById,
  getFaturaByAgendamentoId,
} = require("./repositories/repositorioFaturas");
const {
  iniciarProcesso,
  getTarefaActual,
  completarTarefa,
  getVariaveis,
  getProcessoGestaoActual,
  cancelarProcesso,
} = require("./repositories/repositorioCamunda");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

// Salas

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

// US - BET-34: lista funcionários elegíveis para uma lista de serviços + porte.
// Replica a triagem que o worker gerar-solucoes faz em
// camunda/workers/services/solucoes.js (cobre porte + faz pelo menos um dos tipos).
// O frontend chama isto para popular o dropdown "Funcionário preferido" sem
// duplicar a lógica de filtragem do lado do cliente.
//
// Query params:
//   porte    : valor de PorteEnum (ex: PEQUENO)
//   tiposIds : lista CSV de tipoServicoId (UUIDs)
app.get("/funcionarios/elegiveis", async (req, res) => {
  try {
    const { porte, tiposIds, data, hora, duracaoTotal } = req.query;
    if (!porte) {
      return res.status(400).json({ error: "porte é obrigatório" });
    }
    const tiposArr = String(tiposIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tiposArr.length === 0) {
      return res.status(400).json({ error: "tiposIds é obrigatório (CSV de UUIDs)" });
    }

    const where = {
      porteAnimais: { has: porte },
      funcionarioServico: { some: { tipoServicoId: { in: tiposArr } } },
    };

    // Filtro opcional por dia da semana — só devolve funcionários com um horário
    // activo a cobrir esse dia. Mapeamento JS getDay() → enum (igual ao scheduler).
    let diaSemana = null;
    if (data) {
      const d = new Date(`${data}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        diaSemana = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"][d.getDay()];
        where.horariosTrabalho = {
          some: { ativo: true, diasSemana: { has: diaSemana } },
        };
      }
    }

    const funcionarios = await prisma.funcionario.findMany({
      where,
      include: {
        utilizador: { select: { nome: true, ativo: true } },
        horariosTrabalho: { where: { ativo: true } },
      },
    });

    // Filtro opcional por hora — quando `hora` + `duracaoTotal` são passados,
    // restringe a quem tem turno a cobrir o slot pedido. Versão simplificada do
    // que o scheduler faz: aqui só verifica turno (não verifica reservas existentes
    // nem pausa — isso é trabalho do scheduler em gerar-solucoes).
    //
    // ajustes: para tornar o filtro mais ou menos estrito, mexer aqui.
    // Ex: para validar pausa, comparar slot contra [pausaInicio, pausaFim].
    let resultado = funcionarios.filter((f) => f.utilizador?.ativo !== false);
    if (diaSemana && hora && duracaoTotal) {
      const [hh, mm] = String(hora).split(":").map(Number);
      const slotInicioMin = hh * 60 + mm;
      const slotFimMin = slotInicioMin + Number(duracaoTotal);
      if (!Number.isNaN(slotInicioMin) && !Number.isNaN(slotFimMin)) {
        resultado = resultado.filter((f) =>
          (f.horariosTrabalho || []).some((h) => {
            if (!h.diasSemana.includes(diaSemana)) return false;
            // horaInicio/Fim são Time — Prisma materializa como Date UTC (ver helper
            // parseTimeToDate em repositorioFuncionarios.js que faz o inverso).
            const hi = h.horaInicio.getUTCHours() * 60 + h.horaInicio.getUTCMinutes();
            const hf = h.horaFim.getUTCHours() * 60 + h.horaFim.getUTCMinutes();
            return hi <= slotInicioMin && slotFimMin <= hf;
          })
        );
      }
    }

    return res.json(
      resultado.map((f) => ({ id: f.id, nomeCompleto: f.utilizador?.nome }))
    );
  } catch (error) {
    console.error("Erro ao obter funcionários elegíveis:", error);
    return res.status(500).json({ error: "Erro ao obter funcionários elegíveis" });
  }
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
    return res.status(500).json({ error: "Failed to delete funcionario" });
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

// Agendamentos
/**
 * @swagger
 * /agendamentos:
 *   get:
 *     summary: Lista todos os agendamentos (com filtros opcionais)
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: query
 *         name: funcionarioId
 *         schema: { type: string, format: uuid }
 *         description: Filtra por funcionário associado a algum serviço
 *       - in: query
 *         name: salaId
 *         schema: { type: string, format: uuid }
 *         description: Filtra por sala associada a algum serviço
 *       - in: query
 *         name: dataFrom
 *         schema: { type: string, format: date-time }
 *         description: Início do intervalo de pesquisa (inclusive)
 *       - in: query
 *         name: dataTo
 *         schema: { type: string, format: date-time }
 *         description: Fim do intervalo de pesquisa (inclusive)
 *       - in: query
 *         name: estado
 *         schema: { $ref: '#/components/schemas/EstadoAgendamentoEnum' }
 *         description: Filtra por estado do agendamento
 *     responses:
 *       200:
 *         description: Lista de agendamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agendamento'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/agendamentos", async (req, res) => {
  try {
    const { funcionarioId, salaId, dataFrom, dataTo, estado } = req.query;
    const agendamentos = await getAllAgendamentos({
      funcionarioId,
      salaId,
      dataFrom,
      dataTo,
      estado,
    });
    return res.json(agendamentos);
  } catch (error) {
    console.error("Erro ao obter agendamentos:", error);
    return res.status(500).json({ error: "Erro ao obter agendamentos" });
  }
});

/**
 * @swagger
 * /agendamentos/{id}:
 *   get:
 *     summary: Obtém um agendamento por ID (com animal, cliente, serviços, funcionário e sala)
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: ID do agendamento
 *     responses:
 *       200:
 *         description: Agendamento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agendamento'
 *       404:
 *         description: Agendamento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/agendamentos/:id", async (req, res) => {
  try {
    const agendamento = await getAgendamentoById(req.params.id);
    if (!agendamento) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }
    return res.json(agendamento);
  } catch (error) {
    console.error("Erro ao obter agendamento:", error);
    return res.status(500).json({ error: "Erro ao obter agendamento" });
  }
});

// US - BET-43: consulta de fatura por ID (genérico — funciona para SERVICO_INTERNO
// e ALUGUER_SALA). Devolve o registo cru com `conteudoJson` aninhado: o frontend
// decide o que mostrar consoante `tipo`.
/**
 * @swagger
 * /faturas/{id}:
 *   get:
 *     summary: Devolve uma fatura pelo seu ID
 *     tags: [Faturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fatura encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fatura'
 *       404:
 *         description: Fatura não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/faturas/:id", async (req, res) => {
  try {
    const fatura = await getFaturaById(req.params.id);
    if (!fatura) {
      return res.status(404).json({ error: "Fatura não encontrada" });
    }
    return res.json(fatura);
  } catch (error) {
    console.error("Erro ao obter fatura:", error);
    return res.status(500).json({ error: "Erro ao obter fatura" });
  }
});

// Atalho para o frontend obter a fatura associada a um agendamento sem precisar
// de saber o faturaId. Útil no botão "Fatura" da ListaAgendamentos.
/**
 * @swagger
 * /agendamentos/{agendamentoId}/fatura:
 *   get:
 *     summary: Devolve a fatura associada a um agendamento (se existir)
 *     tags: [Faturas]
 *     parameters:
 *       - in: path
 *         name: agendamentoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fatura encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fatura'
 *       404:
 *         description: Fatura não encontrada para este agendamento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/agendamentos/:agendamentoId/fatura", async (req, res) => {
  try {
    const fatura = await getFaturaByAgendamentoId(req.params.agendamentoId);
    if (!fatura) {
      return res.status(404).json({ error: "Fatura não encontrada para este agendamento" });
    }
    return res.json(fatura);
  } catch (error) {
    console.error("Erro ao obter fatura do agendamento:", error);
    return res.status(500).json({ error: "Erro ao obter fatura do agendamento" });
  }
});

/**
 * @swagger
 * /agendamentos/processos:
 *   post:
 *     summary: Arranca uma nova instância do processo BPMN "agendamento"
 *     tags: [Agendamentos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clienteRegistado: { type: boolean }
 *               clienteId: { type: string, format: uuid, nullable: true }
 *               animalId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       201:
 *         description: Instância criada — devolve processInstanceId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcessoInstanciado'
 *       400:
 *         description: clienteRegistado em falta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/agendamentos/processos", async (req, res) => {
  try {
    const { clienteRegistado, clienteId, animalId } = req.body;

    // clienteRegistado é obrigatório — define o ramo do BPMN.
    if (typeof clienteRegistado !== "boolean") {
      return res.status(400).json({ error: "clienteRegistado (boolean) é obrigatório" });
    }

    const variaveis = { clienteRegistado };
    if (clienteId) variaveis.clienteId = clienteId;
    if (animalId) variaveis.animalId = animalId;

    // No ramo cliente-registado o BPMN salta as user tasks que normalmente
    // setam estes dados (BP116=porteAnimal, BP130=clienteEmail/nomeCliente).
    // Resolvemos da BD a partir dos IDs para alimentar:
    //   - worker obter-preco-duracao (BP243) → precisa de porteAnimal
    //   - gateway BP146 e vários do gestao_agendamento.bpmn → precisam de clienteEmail
    //   - worker montar-resumo (BP135) e templates de email → precisam de nomeCliente
    if (clienteRegistado && (clienteId || animalId)) {
      const [animal, cliente] = await Promise.all([
        animalId
          ? prisma.animal.findUnique({ where: { id: animalId }, select: { porte: true } })
          : Promise.resolve(null),
        clienteId
          ? prisma.cliente.findUnique({
              where: { id: clienteId },
              select: { utilizador: { select: { email: true, nome: true } } },
            })
          : Promise.resolve(null),
      ]);
      if (animal?.porte) variaveis.porteAnimal = animal.porte;
      if (cliente?.utilizador?.email) variaveis.clienteEmail = cliente.utilizador.email;
      if (cliente?.utilizador?.nome) variaveis.nomeCliente = cliente.utilizador.nome;
    }

    const { processInstanceId } = await iniciarProcesso("agendamento", variaveis);
    return res.status(201).json({ processInstanceId });
  } catch (error) {
    console.error("Erro ao iniciar processo de agendamento:", error);
    return res.status(500).json({ error: "Erro ao iniciar processo de agendamento" });
  }
});

// US - BET (check-in/check-out): devolve processInstanceId activo do gestao_agendamento
// para um agendamento. Frontend faz lookup para retomar Check-out/pagamento sem
// precisar de persistir o procId entre sessões.
/**
 * @swagger
 * /agendamentos/{agendamentoId}/processo-gestao-actual:
 *   get:
 *     summary: Devolve o processInstanceId activo do processo gestao_agendamento para um agendamento
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: agendamentoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: processInstanceId activo ou null se nenhuma instância em curso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 processInstanceId:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/agendamentos/:agendamentoId/processo-gestao-actual", async (req, res) => {
  try {
    const processInstanceId = await getProcessoGestaoActual(req.params.agendamentoId);
    return res.json({ processInstanceId });
  } catch (error) {
    console.error("Erro ao consultar processo gestao actual:", error);
    return res.status(500).json({ error: "Erro ao consultar processo gestao actual" });
  }
});

// Arranca uma nova instância do gestao_agendamento.bpmn (4 caminhos disponíveis:
// ATENDER, REAGENDAR, CANCELAR, NAO_COMPARECEU — o ramo concreto é decidido depois
// na user task BP161 via `accaoFuncionario`). Resolve clienteEmail e nomeCliente
// a partir do agendamentoId — o BPMN usa-os em vários gateways "Cliente tem email?"
// e em templates de email.
/**
 * @swagger
 * /agendamentos/{agendamentoId}/processos/gestao:
 *   post:
 *     summary: Arranca uma nova instância do processo BPMN "gestao_agendamento"
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: agendamentoId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Instância criada — devolve processInstanceId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcessoInstanciado'
 *       404:
 *         description: Agendamento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/agendamentos/:agendamentoId/processos/gestao", async (req, res) => {
  try {
    const { agendamentoId } = req.params;

    const agendamento = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      select: {
        id: true,
        animal: {
          select: {
            cliente: {
              select: { utilizador: { select: { email: true, nome: true } } },
            },
          },
        },
      },
    });
    if (!agendamento) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    const variaveis = { agendamentoId };
    const utilizador = agendamento.animal?.cliente?.utilizador;
    if (utilizador?.email) variaveis.clienteEmail = utilizador.email;
    if (utilizador?.nome) variaveis.nomeCliente = utilizador.nome;

    const { processInstanceId } = await iniciarProcesso("gestao_agendamento", variaveis);
    return res.status(201).json({ processInstanceId });
  } catch (error) {
    console.error("Erro ao iniciar processo gestao_agendamento:", error);
    return res.status(500).json({ error: "Erro ao iniciar processo de gestão" });
  }
});

/**
 * @swagger
 * /agendamentos/processos/{procId}/tarefa-actual:
 *   get:
 *     summary: Devolve a user task pendente da instância (ou null se não houver)
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: procId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User task pendente (ou null se o processo já não tem tarefa em curso)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TarefaCamunda'
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/agendamentos/processos/:procId/tarefa-actual", async (req, res) => {
  try {
    const tarefa = await getTarefaActual(req.params.procId);
    return res.json(tarefa);
  } catch (error) {
    console.error("Erro ao obter tarefa actual:", error);
    return res.status(500).json({ error: "Erro ao obter tarefa actual" });
  }
});

/**
 * @swagger
 * /agendamentos/processos/{procId}/tarefas/{taskId}/completar:
 *   post:
 *     summary: Completa uma user task com as variáveis enviadas no body
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: procId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: "Objecto plano com as variáveis a passar (ex: { porte: 'M' })"
 *     responses:
 *       204:
 *         description: Tarefa completada (sem body)
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/agendamentos/processos/:procId/tarefas/:taskId/completar", async (req, res) => {
  try {
    const variaveis = req.body || {};
    await completarTarefa(req.params.taskId, variaveis);
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao completar tarefa:", error);
    return res.status(500).json({ error: "Erro ao completar tarefa" });
  }
});

/**
 * @swagger
 * /agendamentos/processos/{procId}/variaveis:
 *   get:
 *     summary: Lê todas as variáveis do processo (formato JS plano)
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: procId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "Objecto plano com as variáveis do processo (parent + sub-instances activas; sub-instance ganha em colisões)"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *               description: "Chaves dependem do estado do processo. Exemplos: servicosActualizados, qtdServicos, opcaoSelecionada, valorEstimado, dataPreferida."
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/agendamentos/processos/:procId/variaveis", async (req, res) => {
  try {
    const variaveis = await getVariaveis(req.params.procId);
    return res.json(variaveis);
  } catch (error) {
    console.error("Erro ao obter variáveis:", error);
    return res.status(500).json({ error: "Erro ao obter variáveis" });
  }
});

/**
 * @swagger
 * /agendamentos/processos/{procId}:
 *   delete:
 *     summary: Cancela e remove uma instância de processo em curso
 *     tags: [Agendamentos]
 *     parameters:
 *       - in: path
 *         name: procId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Instância cancelada (ou já não existia — idempotente)
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete("/agendamentos/processos/:procId", async (req, res) => {
  // US - BET-34: cancelar agendamento a partir do wizard. O cancelamento humano
  // não está modelado no BPMN — o caminho "abandonar a meio" é responsabilidade
  // deste endpoint.
  //
  // Ordem B refinada (decidida em 2026-05-12):
  //   1. Ler `reservasTemporariasIds` das vars Camunda — antes de cancelar, porque
  //      as vars desaparecem com a instância.
  //   2. Cancelar processo Camunda — operação principal; se falhar, devolvemos 500
  //      sem ter tocado em BD.
  //   3. Apagar reservas em BD pelos IDs lidos — best-effort. Se falhar, log mas
  //      devolve 204: o TTL da ReservaTemporaria (5 min) limpa orfãs.
  //
  // Usamos IDs (não `processInstanceId`) porque o worker `criar-reservas-temporarias-opcao`
  // grava as reservas com o id da SUB-INSTANCE (sub_gerar_selecionar_opcao), não do parent.
  // A variável `reservasTemporariasIds` é o contrato externo da opção escolhida.
  const procId = req.params.procId;
  let idsParaApagar = [];

  try {
    const vars = await getVariaveis(procId);
    const raw = vars.reservasTemporariasIds;
    if (raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) idsParaApagar = parsed;
    }
  } catch (e) {
    console.warn(`[cancelar-processo] Sem reservasTemporariasIds: ${e.message}`);
  }

  try {
    await cancelarProcesso(procId);
  } catch (error) {
    console.error("Erro ao cancelar processo Camunda:", error);
    return res.status(500).json({ error: "Erro ao cancelar processo" });
  }

  if (idsParaApagar.length > 0) {
    try {
      const { count } = await prisma.reservaTemporaria.deleteMany({
        where: { id: { in: idsParaApagar } },
      });
      console.log(`[cancelar-processo] ${count}/${idsParaApagar.length} reservas libertadas [proc=${procId}]`);
    } catch (e) {
      console.warn(`[cancelar-processo] Falha a libertar reservas (TTL recuperará): ${e.message}`);
    }
  }

  return res.status(204).send();
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
