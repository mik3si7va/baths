const express = require('express');
const cors = require('cors');
const { query, closePool } = require('./db/pool');
const { getAllEvents, createEvent } = require('./repositories/eventsRepository');
const { getAllTiposServico, createTipoServico, getAllRegrasPreco, createRegraPreco } = require('./repositories/repositorioServicos');
const { getAllSalas, createSala, addServicoToSala, getServicosBySala, removeServicoFromSala } = require('./repositories/repositorioSalas');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/servicos', async (_req, res) => {
  try {
    const servicos = await getAllTiposServico();
    return res.json(servicos);
  } catch (error) {
    console.error('Failed to fetch servicos:', error);
    return res.status(500).json({ error: 'Failed to fetch servicos' });
  }
});

app.post('/servicos', async (req, res) => {
  const { tipo } = req.body || {};
  if (!tipo) {
    return res.status(400).json({ error: 'tipo é obrigatório' });
  }
  try {
    const novo = await createTipoServico({ tipo });
    return res.status(201).json(novo);
  } catch (error) {
    console.error('Failed to create servico:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/regras-preco', async (_req, res) => {
  try {
    const regras = await getAllRegrasPreco();
    return res.json(regras);
  } catch (error) {
    console.error('Failed to fetch regras:', error);
    return res.status(500).json({ error: 'Failed to fetch regras' });
  }
});

app.post('/regras-preco', async (req, res) => {
  const { tipoServicoId, porteAnimal, precoBase, duracaoMinutos } = req.body || {};
  if (!tipoServicoId || !porteAnimal || !precoBase || !duracaoMinutos) {
    return res.status(400).json({ error: 'tipoServicoId, porteAnimal, precoBase e duracaoMinutos são obrigatórios' });
  }
  try {
    const nova = await createRegraPreco({ tipoServicoId, porteAnimal, precoBase, duracaoMinutos });
    return res.status(201).json(nova);
  } catch (error) {
    console.error('Failed to create regra:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/salas', async (_req, res) => {
  try {
    const salas = await getAllSalas();
    return res.json(salas);
  } catch (error) {
    console.error('Failed to fetch salas:', error);
    return res.status(500).json({ error: 'Failed to fetch salas' });
  }
});

app.post('/salas', async (req, res) => {
  const { nome, capacidade, equipamento, precoHora } = req.body || {};
  if (!nome || !capacidade || !equipamento || !precoHora) {
    return res.status(400).json({ error: 'nome, capacidade, equipamento e precoHora são obrigatórios' });
  }
  try {
    const nova = await createSala({ nome, capacidade, equipamento, precoHora });
    return res.status(201).json(nova);
  } catch (error) {
    console.error('Failed to create sala:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/salas/:id/servicos', async (req, res) => {
  const { id } = req.params;
  const { tipoServicoId } = req.body || {};
  if (!tipoServicoId) {
    return res.status(400).json({ error: 'tipoServicoId é obrigatório' });
  }
  try {
    const associacao = await addServicoToSala({ salaId: id, tipoServicoId });
    return res.status(201).json(associacao);
  } catch (error) {
    console.error('Failed to add servico to sala:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/salas/:id/servicos', async (req, res) => {
  const { id } = req.params;
  try {
    const servicos = await getServicosBySala(id);
    return res.json(servicos);
  } catch (error) {
    console.error('Failed to fetch servicos da sala:', error);
    return res.status(500).json({ error: 'Failed to fetch servicos da sala' });
  }
});

app.delete('/salas/:id/servicos/:servicoId', async (req, res) => {
  const { id, servicoId } = req.params;
  try {
    const result = await removeServicoFromSala({ salaId: id, tipoServicoId: servicoId });
    return res.json(result);
  } catch (error) {
    console.error('Failed to remove servico from sala:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/events', async (_req, res) => {
  try {
    const events = await getAllEvents();
    return res.json(events);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/events', async (req, res) => {
  const { title, start, end } = req.body || {};

  if (!title || !start || !end) {
    return res.status(400).json({ error: 'title, start, and end are required' });
  }

  try {
    const newEvent = await createEvent({ title, start, end });
    return res.status(201).json(newEvent);
  } catch (error) {
    console.error('Failed to create event:', error);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

async function startServer() {
  try {
    await query('SELECT 1;');
    console.log('Database connection ready.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Backend a ouvir na porta ${PORT}!`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();
