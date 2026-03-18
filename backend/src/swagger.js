const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BATHS API',
      version: '1.0.0',
      description: 'Documentação da API do sistema BATHS',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Servidor local',
      },
    ],
    components: {
      schemas: {

        // ─── ENUMS ───────────────────────────────────────────────
        TipoServicoEnum: {
          type: 'string',
          enum: [
            'BANHO',
            'TOSQUIA_COMPLETA',
            'TOSQUIA_HIGIENICA',
            'CORTE_UNHAS',
            'LIMPEZA_OUVIDOS',
            'EXPRESSAO_GLANDULAS',
            'LIMPEZA_DENTES',
            'APARAR_PELO_CARA',
            'ANTI_PULGAS',
            'ANTI_QUEDA',
            'REMOCAO_NOS',
          ],
          description: `Tipos de serviço disponíveis:
- BANHO — Banho (requer porte)
- TOSQUIA_COMPLETA — Tosquia Completa (requer porte)
- TOSQUIA_HIGIENICA — Tosquia Higiénica (requer porte)
- CORTE_UNHAS — Corte de Unhas
- LIMPEZA_OUVIDOS — Limpeza de Ouvidos
- EXPRESSAO_GLANDULAS — Expressão de Glândulas
- LIMPEZA_DENTES — Limpeza de Dentes
- APARAR_PELO_CARA — Aparar Pelo da Cara
- ANTI_PULGAS — Tratamento Anti-Pulgas
- ANTI_QUEDA — Tratamento Anti-Queda
- REMOCAO_NOS — Remoção de Nós`,
          example: 'BANHO',
        },

        PorteEnum: {
          type: 'string',
          enum: [
            'EXTRA_PEQUENO',
            'PEQUENO',
            'MEDIO',
            'GRANDE',
            'EXTRA_GRANDE',
          ],
          description: `Porte do animal:
- EXTRA_PEQUENO — 0.5 a 4.5 kg
- PEQUENO — 5 a 9 kg
- MEDIO — 9.5 a 13.5 kg
- GRANDE — 14 a 18 kg
- EXTRA_GRANDE — 18.5+ kg`,
          example: 'MEDIO',
        },

        // ─── ENTIDADES ───────────────────────────────────────────
        TipoServico: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            tipo: {
              $ref: '#/components/schemas/TipoServicoEnum',
            },
            ativo: {
              type: 'boolean',
              example: true,
            },
          },
        },

        RegraPreco: {
          type: 'object',
          required: ['tipoServicoId', 'porteAnimal', 'precoBase', 'duracaoMinutos'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            tipoServicoId: {
              type: 'integer',
              example: 1,
            },
            porteAnimal: {
              $ref: '#/components/schemas/PorteEnum',
            },
            precoBase: {
              type: 'number',
              format: 'float',
              example: 35.00,
            },
            duracaoMinutos: {
              type: 'integer',
              example: 60,
            },
          },
        },

        Sala: {
          type: 'object',
          required: ['nome', 'capacidade', 'equipamento', 'precoHora'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            nome: {
              type: 'string',
              example: 'Sala A',
            },
            capacidade: {
              type: 'integer',
              example: 5,
            },
            equipamento: {
              type: 'string',
              example: 'Banheira grande, secador',
            },
            precoHora: {
              type: 'number',
              format: 'float',
              example: 20.00,
            },
            ativo: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00Z',
            },
          },
        },

        SalaServico: {
          type: 'object',
          description: 'Associação entre uma sala e um tipo de serviço',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            salaId: {
              type: 'integer',
              example: 1,
            },
            tipoServicoId: {
              type: 'integer',
              example: 2,
            },
            dataAssociacao: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00Z',
            },
          },
        },

        Event: {
          type: 'object',
          required: ['title', 'start', 'end'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            title: {
              type: 'string',
              example: 'Consulta Rex',
            },
            start: {
              type: 'string',
              format: 'date-time',
              example: '2025-06-01T10:00:00Z',
            },
            end: {
              type: 'string',
              format: 'date-time',
              example: '2025-06-01T11:00:00Z',
            },
          },
        },

        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Mensagem de erro',
            },
          },
        },

      },
    },
  },
  apis: ['./src/server.js'],
};

module.exports = swaggerJsdoc(options);