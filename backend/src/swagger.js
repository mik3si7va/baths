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

        DiaSemanaEnum: {
          type: 'string',
          enum: [
            'SEGUNDA',
            'TERCA',
            'QUARTA',
            'QUINTA',
            'SEXTA',
            'SABADO',
          ],
          description: 'Dias da semana permitidos para horario de trabalho (domingo nao permitido).',
          example: 'TERCA',
        },

        TipoFuncionarioEnum: {
          type: 'string',
          enum: [
            'TOSQUIADOR_SENIOR',
            'TOSQUIADOR',
            'TOSQUIADOR_ESTAGIARIO',
            'BANHISTA_SENIOR',
            'BANHISTA',
            'BANHISTA_ESTAGIARIO',
            'RECECIONISTA',
            'ADMINISTRACAO',
          ],
          description: 'Cargos de funcionario disponiveis no sistema.',
          example: 'BANHISTA',
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
              type: 'string',
              format: 'uuid',
              example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
              example: 'Banheira, secador',
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
            servicos: {
              type: 'array',
              description: 'Tipos de serviço associados a esta sala (preenchido em todas as queries de sala).',
              items: {
                type: 'object',
                properties: {
                  tipoServicoId: {
                    type: 'string',
                    format: 'uuid',
                  },
                  tipo: {
                    $ref: '#/components/schemas/TipoServicoEnum',
                  },
                  ativo: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        },

        CreateSalaRequest: {
          type: 'object',
          required: ['nome', 'capacidade', 'equipamento', 'precoHora', 'tipoServicoIds'],
          properties: {
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
            tipoServicoIds: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid',
              },
              description: 'IDs dos tipos de serviço associados a esta sala. Obrigatório ter pelo menos um.',
              example: [
                '11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222',
              ],
            },
            ativo: {
              type: 'boolean',
              description: 'Opcional, só relevante em PUT. Permite reativar uma sala inativa (ativo: true). Ignorado em POST.',
              example: true,
            },
          },
        },

        SalaServico: {
          type: 'object',
          description: 'Associação entre uma sala e um tipo de serviço',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            },
            salaId: {
              type: 'string',
              format: 'uuid',
              example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            },
            tipoServicoId: {
              type: 'string',
              format: 'uuid',
              example: '11111111-1111-1111-1111-111111111111',
            },
            dataAssociacao: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00Z',
            },
          },
        },

        // ─── AGENDAMENTOS ────────────────────────────────────────
        EstadoAgendamentoEnum: {
          type: 'string',
          enum: [
            'CONFIRMADO',
            'EM_ATENDIMENTO',
            'CONCLUIDO',
            'CANCELADO',
            'NAO_COMPARECEU',
          ],
          description: `Estado do agendamento:
- CONFIRMADO — marcado, ainda não começou
- EM_ATENDIMENTO — em curso (check-in efectuado)
- CONCLUIDO — terminado (check-out + pagamento)
- CANCELADO — anulado pelo cliente/clínica antes de começar
- NAO_COMPARECEU — cliente faltou sem cancelar`,
          example: 'CONFIRMADO',
        },

        AgendamentoServico: {
          type: 'object',
          description: 'Linha de serviço dentro de um agendamento — snapshot do que foi marcado (preço/duração imutáveis após criação).',
          properties: {
            id: { type: 'string', format: 'uuid' },
            agendamentoId: { type: 'string', format: 'uuid' },
            tipoServicoId: { type: 'string', format: 'uuid' },
            funcionarioId: { type: 'string', format: 'uuid' },
            salaId: { type: 'string', format: 'uuid' },
            dataHoraInicio: { type: 'string', format: 'date-time' },
            dataHoraFim: { type: 'string', format: 'date-time' },
            precoNoMomento: {
              type: 'number',
              format: 'float',
              description: 'Snapshot do preço aplicado no momento (BET-460: imutável após criação).',
              example: 25.00,
            },
            duracaoNoMomento: {
              type: 'integer',
              description: 'Snapshot da duração em minutos.',
              example: 30,
            },
            ordem: {
              type: 'integer',
              description: 'Posição na sequência de serviços do agendamento (1, 2, 3...).',
              example: 1,
            },
            tipoServico: { $ref: '#/components/schemas/TipoServico' },
            funcionario: { $ref: '#/components/schemas/Funcionario' },
            sala: { $ref: '#/components/schemas/Sala' },
          },
        },

        Agendamento: {
          type: 'object',
          description: 'Agendamento de visita à clínica. Shape devolvido pelos endpoints /agendamentos* (com animal, cliente, serviços, funcionário e sala incluídos via AGENDAMENTO_COMPLETO_INCLUDE).',
          properties: {
            id: { type: 'string', format: 'uuid' },
            animalId: { type: 'string', format: 'uuid' },
            dataHoraInicio: {
              type: 'string',
              format: 'date-time',
              description: 'Início planeado (schedule). Não muda quando há add/remove em sub_faturar — semântica de horário marcado.',
            },
            dataHoraFim: {
              type: 'string',
              format: 'date-time',
              description: 'Fim planeado (schedule).',
            },
            estado: { $ref: '#/components/schemas/EstadoAgendamentoEnum' },
            valorTotal: {
              type: 'number',
              format: 'float',
              description: 'Total cobrado. Sincronizado no pagamento (audit-by-total: ∑ Agendamento.valorTotal == ∑ Fatura.valorTotal).',
              example: 107.00,
            },
            metodoPagamento: {
              oneOf: [
                { $ref: '#/components/schemas/MetodoPagamentoEnum' },
                { type: 'null' },
              ],
              nullable: true,
            },
            pagoEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Timestamp do pagamento (naive Lisboa empacotado como UTC).',
            },
            checkInRealizadoEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Timestamp real do check-in pelo funcionário.',
            },
            checkOutRealizadoEm: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            processInstanceId: {
              type: 'string',
              format: 'uuid',
              description: 'ID da instância Camunda que criou este agendamento (agendamento.bpmn).',
            },
            animal: {
              type: 'object',
              description: 'Animal incluído via include — traz também o cliente e utilizador.',
              properties: {
                id: { type: 'string', format: 'uuid' },
                nome: { type: 'string', example: 'Mia' },
                especie: { type: 'string', example: 'Cão' },
                raca: { type: 'string', nullable: true },
                porte: { $ref: '#/components/schemas/PorteEnum' },
                cliente: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    nif: { type: 'string', nullable: true },
                    telefone: { type: 'string' },
                    utilizador: {
                      type: 'object',
                      properties: {
                        nome: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                      },
                    },
                  },
                },
              },
            },
            servicos: {
              type: 'array',
              items: { $ref: '#/components/schemas/AgendamentoServico' },
              description: 'Linhas de serviço ordenadas por `ordem`.',
            },
            fatura: {
              type: 'object',
              nullable: true,
              description: 'Resumo da fatura associada — só {id, numero}. Para o conteúdo completo, GET /faturas/:id.',
              properties: {
                id: { type: 'string', format: 'uuid' },
                numero: { type: 'string', example: 'FAT-MPHTXZUP-d60c3c3b' },
              },
            },
          },
        },

        // ─── FATURAS (BET-43) ────────────────────────────────────
        TipoFaturaEnum: {
          type: 'string',
          enum: ['SERVICO_INTERNO', 'ALUGUER_SALA'],
          description: `Tipo de fatura:
- SERVICO_INTERNO — fatura de visita à clínica (BET-43). 1:1 com Agendamento.
- ALUGUER_SALA — fatura de aluguer a entidade parceira (BET-44 reservado, ainda não implementado).`,
          example: 'SERVICO_INTERNO',
        },

        MetodoPagamentoEnum: {
          type: 'string',
          enum: ['DINHEIRO', 'MULTIBANCO', 'TRANSFERENCIA'],
          description: 'Método de pagamento usado pelo cliente.',
          example: 'MULTIBANCO',
        },

        Fatura: {
          type: 'object',
          description: 'Fatura — entidade própria desde BET-43. Snapshot imutável depois de emitida. Para SERVICO_INTERNO há relação 1:1 com Agendamento via agendamentoId (unique).',
          properties: {
            id: { type: 'string', format: 'uuid' },
            numero: {
              type: 'string',
              description: 'Número único da fatura, formato `FAT-{base36 timestamp}-{8 chars agendamentoId}`.',
              example: 'FAT-MPHTXZUP-d60c3c3b',
            },
            tipo: { $ref: '#/components/schemas/TipoFaturaEnum' },
            agendamentoId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Preenchido em SERVICO_INTERNO. Null em ALUGUER_SALA (BET-44).',
            },
            entidadeParceiraId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Preenchido em ALUGUER_SALA (BET-44). Null em SERVICO_INTERNO.',
            },
            periodoMes: { type: 'integer', minimum: 1, maximum: 12, nullable: true },
            periodoAno: { type: 'integer', nullable: true, example: 2026 },
            valorTotal: { type: 'number', format: 'float', example: 107.00 },
            metodoPagamento: {
              oneOf: [
                { $ref: '#/components/schemas/MetodoPagamentoEnum' },
                { type: 'null' },
              ],
              nullable: true,
            },
            pagoEm: { type: 'string', format: 'date-time', nullable: true },
            dataEmissao: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp da emissão (naive Lisboa empacotado como UTC).',
            },
            conteudoJson: {
              type: 'object',
              description: `Snapshot imutável dos dados no momento da emissão. Shape varia por \`tipo\`:
- SERVICO_INTERNO: { clienteNome, clienteEmail, clienteNif, clienteTelefone, animalNome, dataHoraInicio, dataHoraFim, servicos: [{ nome, duracao, valorComIva, valorSemIva, valorIva }], taxaIva, subTotalSemIva, valorIva, valorTotal, metodoPagamento, pagoEm }
- ALUGUER_SALA: TBD (BET-44)`,
              properties: {
                tipo: { type: 'string', example: 'SERVICO_INTERNO' },
                clienteNome: { type: 'string' },
                animalNome: { type: 'string' },
                servicos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nome: { type: 'string', example: 'BANHO' },
                      duracao: { type: 'integer', example: 30 },
                      valorComIva: { type: 'number', format: 'float' },
                      valorSemIva: { type: 'number', format: 'float' },
                      valorIva: { type: 'number', format: 'float' },
                    },
                  },
                },
                taxaIva: { type: 'integer', example: 23 },
                valorTotal: { type: 'number', format: 'float' },
              },
            },
          },
        },

        // ─── CAMUNDA (responses dos endpoints /agendamentos/processos/*) ──
        ProcessoInstanciado: {
          type: 'object',
          description: 'Resposta de POST /agendamentos/processos e /agendamentos/:agendamentoId/processos/gestao.',
          properties: {
            processInstanceId: {
              type: 'string',
              format: 'uuid',
              description: 'ID da instância Camunda criada — usado nas chamadas subsequentes ao processo.',
            },
          },
        },

        TarefaCamunda: {
          type: 'object',
          nullable: true,
          description: 'User task pendente devolvida por GET /agendamentos/processos/:procId/tarefa-actual. Null se não houver tarefa pendente (processo terminado ou entre workers).',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'taskId — passar a POST .../tarefas/:taskId/completar.',
            },
            taskDefinitionKey: {
              type: 'string',
              description: 'ID do elemento no BPMN (ex: BP116, BP56_sub3) — usado pelo frontend para escolher o form a mostrar.',
              example: 'BP116',
            },
            nome: {
              type: 'string',
              example: 'Selecionar porte do animal',
            },
            criadaEm: {
              type: 'string',
              format: 'date-time',
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

        HorarioTrabalho: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            diasSemana: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/DiaSemanaEnum',
              },
            },
            horaInicio: {
              type: 'string',
              example: '09:00',
            },
            horaFim: {
              type: 'string',
              example: '18:00',
            },
            pausaInicio: {
              type: 'string',
              example: '13:00',
            },
            pausaFim: {
              type: 'string',
              example: '14:00',
            },
            ativo: {
              type: 'boolean',
              example: true,
            },
          },
        },

        FuncionarioServicoResumo: {
          type: 'object',
          properties: {
            tipoServicoId: {
              type: 'string',
              format: 'uuid',
            },
            tipo: {
              $ref: '#/components/schemas/TipoServicoEnum',
            },
          },
        },

        Funcionario: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            nomeCompleto: {
              type: 'string',
              example: 'Sofia Ramalho',
            },
            cargo: {
              $ref: '#/components/schemas/TipoFuncionarioEnum',
            },
            telefone: {
              type: 'string',
              example: '912345678',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'sofia.r@bet.com',
            },
            porteAnimais: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PorteEnum',
              },
            },
            ativo: {
              type: 'boolean',
              example: true,
            },
            horariosTrabalho: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/HorarioTrabalho',
              },
            },
            servicos: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/FuncionarioServicoResumo',
              },
            },
          },
        },

        CreateFuncionarioRequest: {
          type: 'object',
          required: ['nomeCompleto', 'cargo', 'telefone', 'email', 'porteAnimais', 'horario'],
          properties: {
            nomeCompleto: {
              type: 'string',
              example: 'Sofia Ramalho',
            },
            cargo: {
              $ref: '#/components/schemas/TipoFuncionarioEnum',
            },
            telefone: {
              type: 'string',
              example: '912345678',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'sofia.r@bet.com',
            },
            porteAnimais: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/PorteEnum',
              },
            },
            tipoServicoIds: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid',
              },
              example: [
                '11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222',
              ],
            },
            horario: {
              type: 'object',
              required: ['diasSemana', 'horaInicio', 'horaFim'],
              properties: {
                diasSemana: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DiaSemanaEnum',
                  },
                  example: ['TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'],
                },
                horaInicio: {
                  type: 'string',
                  example: '09:00',
                },
                horaFim: {
                  type: 'string',
                  example: '18:00',
                },
                pausaInicio: {
                  type: 'string',
                  example: '13:00',
                },
                pausaFim: {
                  type: 'string',
                  example: '14:00',
                },
              },
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
