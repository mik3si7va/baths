// =====================================================
// TESTE - FLUXO DE AGENDAMENTO CAMUNDA
// =====================================================

import { createRequire } from 'node:module';
const req = createRequire(new URL('../backend/package.json', import.meta.url));

req('dotenv').config({ path: './backend/.env' });

const { addDays, format } = req('date-fns');
const { PrismaClient } = req('@prisma/client');

const prisma = new PrismaClient();
const CAMUNDA_API = 'http://localhost:8080/engine-rest';

// A cada 1,5 segundos pergunta "há alguma user task pendente?"
const POLL_INTERVAL = 1500;
// 40 tentativas × 1,5 segundos = 60 segundos antes de desistir do teste e lançar erro se o processo ficar preso
const MAX_TENTATIVAS = 40;
// Se uma  chamada HTTP individual à API do Camunda demorar mais de 10 segundos sem resposta,
// aborta com erro de timeout, em vez de bloquear indefinidamente.
const FETCH_TIMEOUT_MS = 10000;

async function request(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    let finalUrl = url;
    if (method === 'GET' && data?.params) {
        const params = new URLSearchParams(data.params);
        finalUrl = `${url}?${params}`;
        delete options.body;
    }

    let response;
    try {
        response = await fetch(finalUrl, options);
    } catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            throw new Error(`Timeout ${FETCH_TIMEOUT_MS}ms: ${method} ${finalUrl}`);
        }
        throw err;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

async function limparEstadoAnterior() {
    console.log('🧹 Limpar estado de execuções anteriores...');

    const instancias = await request(`${CAMUNDA_API}/process-instance`, 'GET', {
        params: { processDefinitionKey: 'agendamento' }
    });

    if (instancias.length > 0) {
        console.log(`   A apagar ${instancias.length} instância(s) pendente(s) do processo 'agendamento'...`);
        for (const inst of instancias) {
            try {
                await request(`${CAMUNDA_API}/process-instance/${inst.id}?skipCustomListeners=true&skipIoMappings=true`, 'DELETE');
            } catch (err) {
                console.log(`   ⚠️  Falha a apagar ${inst.id}: ${err.message}`);
            }
        }
    }

    const reservas = await prisma.reservaTemporaria.deleteMany({});
    if (reservas.count > 0) {
        console.log(`   Apagadas ${reservas.count} ReservaTemporaria órfã(s).`);
    }

    console.log('✅ Estado limpo.\n');
}

async function carregarDadosTeste() {
    console.log('📦 Carregar dados de teste da BD...\n');

    const cliente = await prisma.cliente.findFirst({
        include: { utilizador: true, animais: true }
    });

    if (!cliente) throw new Error('Nenhum cliente encontrado. Corre o seed!');

    const animal =
        cliente.animais.find(a => a.nome === 'Mia') ??
        cliente.animais.find(a => a.porte === 'PEQUENO') ??
        cliente.animais[0];
    if (!animal) throw new Error('Cliente sem animais!');

    // Serviços iniciais — sem APARAR_PELO_CARA (será adicionado em sub_preparar_servicos)
    const servicos = await prisma.tipoServico.findMany({
        where: { ativo: true, tipo: { in: ['BANHO', 'TOSQUIA_COMPLETA', 'LIMPEZA_OUVIDOS', 'ANTI_QUEDA'] } }
    });

    // Serviço a adicionar em sub_preparar_servicos após remover ANTI_QUEDA
    const servicoAdicionar = await prisma.tipoServico.findFirst({
        where: { ativo: true, tipo: 'APARAR_PELO_CARA' }
    });
    if (!servicoAdicionar) throw new Error('Serviço APARAR_PELO_CARA não encontrado. Corre o seed!');

    // Funcionário preferido
    const funcionario = await prisma.funcionario.findFirst({
        where: { utilizador: { nome: 'Sofia Ramalho' } },
        include: { utilizador: true }
    });

    const dados = {
        clienteId: cliente.id,
        clienteEmail: cliente.utilizador?.email,
        nomeCliente: cliente.utilizador?.nome,
        animalId: animal.id,
        nomeAnimal: animal.nome,
        porteAnimal: animal.porte,
        funcionarioId: funcionario?.id || null,
        nomeFuncionario: funcionario?.utilizador?.nome || null,
        servicos: servicos.map(s => ({
            tipoServicoId: s.id,
            nomeServico: s.tipo,
            duracaoMinutos: s.duracaoMinutos,
            precoBase: s.precoBase
        })),
        // ID do ANTI_QUEDA para remover em sub_preparar_servicos
        antiQuedaId: servicos.find(s => s.tipo === 'ANTI_QUEDA')?.id ?? null,
        // Serviço a adicionar após a remoção
        servicoAdicionar: {
            tipoServicoId: servicoAdicionar.id,
            nomeServico: servicoAdicionar.tipo,
        },
    };

    console.log('✅ Dados carregados:');
    console.log(`   Cliente: ${dados.nomeCliente} [${dados.clienteId}]`);
    console.log(`   Animal : ${dados.nomeAnimal} [${dados.animalId}] (${dados.porteAnimal})`);
    if (dados.funcionarioId) {
        console.log(`   Funcionário preferido: ${dados.nomeFuncionario} ✓`);
    } else {
        console.log(`   Funcionário preferido: Sofia Ramalho não encontrada na BD ✗`);
    }
    console.log(`   Serviços iniciais (${dados.servicos.length}): ${dados.servicos.map(s => s.nomeServico).join(', ')}`);
    console.log(`   Fluxo em sub_preparar_servicos: remover ANTI_QUEDA → adicionar APARAR_PELO_CARA → confirmar`);
    console.log(`   Serviços esperados no agendamento: ${dados.servicos.length} (4 remove+add anula-se)\n`);

    return dados;
}

async function iniciarProcesso(dados) {
    console.log('🚀 Iniciar processo de agendamento...');
    console.log(`   funcionarioPreferido enviado: ${dados.funcionarioId ? `${dados.nomeFuncionario} [${dados.funcionarioId}]` : 'NULL (não há funcionário na BD)'}\n`);

    const response = await request(`${CAMUNDA_API}/process-definition/key/agendamento/start`, 'POST', {
        variables: {
            clienteRegistado: { value: true, type: 'boolean' },
            funcionarioPreferido: { value: dados.funcionarioId, type: 'string' },
            servicosIniciais: {
                value: JSON.stringify(dados.servicos),
                type: 'json'
            },
            porteAnimal: { value: dados.porteAnimal, type: 'string' },
            clienteEmail: { value: dados.clienteEmail, type: 'string' }
        }
    });

    console.log(`✅ Processo iniciado com sucesso!`);
    console.log(`   Process Instance ID: ${response.id}`);
    console.log(`   🔗 Cockpit: http://localhost:8080/camunda/app/cockpit/default/#/process-instance/${response.id}\n`);

    await new Promise(r => setTimeout(r, 1000));
    return response.id;
}

async function listarInstanciasDaArvore(rootProcessInstanceId) {
    const instancias = await request(`${CAMUNDA_API}/process-instance`, 'GET', {
        params: { rootProcessInstanceId }
    });
    return instancias.map(i => i.id);
}

async function buscarTasks(rootProcessInstanceId) {
    const ids = await listarInstanciasDaArvore(rootProcessInstanceId);
    if (ids.length === 0) return [];
    return await request(`${CAMUNDA_API}/task`, 'GET', {
        params: {
            assignee: 'funcionario',
            processInstanceIdIn: ids.join(',')
        }
    });
}

async function verificarIncidents(rootProcessInstanceId) {
    const ids = await listarInstanciasDaArvore(rootProcessInstanceId);
    if (ids.length === 0) return;
    const lotes = await Promise.all(ids.map(id =>
        request(`${CAMUNDA_API}/incident`, 'GET', { params: { processInstanceId: id } })
    ));
    const incidents = lotes.flat();
    if (incidents.length > 0) {
        const msgs = incidents.map(i => `  • ${i.activityId}: ${i.incidentMessage}`).join('\n');
        throw new Error(`Processo tem ${incidents.length} incident(s):\n${msgs}`);
    }
}

async function arvoreInstanciasAtiva(rootProcessInstanceId) {
    const ids = await listarInstanciasDaArvore(rootProcessInstanceId);
    return ids.length > 0;
}

async function validarProcessoCamunda(rootProcessInstanceId) {
    console.log('\n🔍 Validar histórico do processo Camunda...');
    const problemas = [];

    const insts = await request(`${CAMUNDA_API}/history/process-instance`, 'GET', {
        params: { rootProcessInstanceId }
    });

    if (insts.length === 0) {
        throw new Error('Nenhuma instância encontrada no histórico Camunda.');
    }

    const root = insts.find(i => i.id === rootProcessInstanceId);
    if (!root) {
        problemas.push(`Instância root ${rootProcessInstanceId} não está no histórico.`);
    } else if (root.state !== 'COMPLETED') {
        problemas.push(`Processo root terminou em estado '${root.state}' (esperado 'COMPLETED').`);
    }

    for (const inst of insts) {
        if (inst.state && inst.state !== 'COMPLETED') {
            problemas.push(`Instância ${inst.id} (${inst.processDefinitionKey}) em estado '${inst.state}'.`);
        }
    }

    const ids = insts.map(i => i.id);
    const vars = await request(`${CAMUNDA_API}/history/variable-instance`, 'GET', {
        params: { processInstanceIdIn: ids.join(','), variableName: 'mensagemErro' }
    });
    for (const v of vars) {
        if (v.value !== null && v.value !== undefined && v.value !== '') {
            problemas.push(`Variável 'mensagemErro' definida em ${v.processInstanceId}: "${v.value}"`);
        }
    }

    if (problemas.length > 0) {
        throw new Error('Processo Camunda terminou com problemas:\n' + problemas.map(p => `  • ${p}`).join('\n'));
    }

    console.log(`✅ Histórico do processo Camunda OK (${insts.length} instância(s) na árvore).`);
    return ids;
}

async function completarTask(taskId, variables = {}) {
    const varsFormatted = Object.entries(variables).reduce((acc, [key, value]) => {
        if (typeof value === 'object' && value !== null) {
            acc[key] = { value: JSON.stringify(value), type: 'json' };
        } else if (typeof value === 'number') {
            acc[key] = { value, type: 'double' };
        } else if (typeof value === 'boolean') {
            acc[key] = { value, type: 'boolean' };
        } else {
            acc[key] = { value: String(value), type: 'string' };
        }
        return acc;
    }, {});

    await request(`${CAMUNDA_API}/task/${taskId}/complete`, 'POST', { variables: varsFormatted });
}


async function processarTasks(processInstanceId, dados) {
    let tentativas = 0;
    let tasksProcessadas = 0;
    let terminouComSucesso = false;
    let indiceServico = 0;
    let passagemConfirmar = 0; // conta as passagens em "Funcionário confirma ou altera serviços"

    console.log('🔄 Processar tasks automaticamente...\n');

    while (tentativas < MAX_TENTATIVAS) {
        await verificarIncidents(processInstanceId);

        const tasks = await buscarTasks(processInstanceId);

        const tasksDoFluxo = tasks.filter(task =>
            [
                'Abrir ficha do cliente',
                'Selecionar porte do animal',
                'Selecionar animal',
                'Selecionar serviço',
                'Funcionário confirma ou altera serviços',
                'Selecionar serviço a adicionar',
                'Selecionar serviço a remover',
                'Funcionário indica data e hora preferida',
                'Funcionário visualiza e seleciona opção',
                'Funcionário confirma agendamento',
                'Confirma agendamento'
            ].includes(task.name)
        );

        if (tasksDoFluxo.length === 0) {
            const ativo = await arvoreInstanciasAtiva(processInstanceId);

            if (!ativo) {
                console.log('\n✅ Processo terminou no Camunda!');
                terminouComSucesso = true;
                break;
            }

            console.log('⏳ Sem user tasks neste momento; processo ainda ativo (external tasks em execução)...');
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
            tentativas++;
            continue;
        }

        for (const task of tasksDoFluxo) {
            console.log(`📝 Task encontrada → "${task.name}"`);
            console.log(`   • ID: ${task.id}`);
            console.log(`   • Key: ${task.taskDefinitionKey}`);

            let variables = {};

            switch (task.name) {
                // PROCESSO PRINCIPAL agendamento
                case 'Abrir ficha do cliente':
                    variables = {};
                    console.log('   → Abrir ficha do cliente');
                    break;

                case 'Selecionar porte do animal':
                    variables = { porteAnimal: dados.porteAnimal };
                    console.log(`   → Definir porte do animal: ${dados.porteAnimal}`);
                    break;

                case 'Selecionar animal':
                    variables = { animalId: dados.animalId };
                    console.log('   → Selecionar animal');
                    break;

                case 'Selecionar serviço': {
                    const servico = dados.servicos[indiceServico];

                    variables = {
                        tipoServicoId: servico.tipoServicoId,
                        servicoTemp: {
                            tipoServicoId: servico.tipoServicoId,
                            nomeServico: servico.nomeServico
                        },
                        operacaoBemSucedida: true,
                        adicionarOutroServico: indiceServico < dados.servicos.length - 1
                    };

                    console.log(
                        `   → Selecionar serviço ${indiceServico + 1}/${dados.servicos.length}: ${servico.nomeServico} (adicionarOutroServico=${indiceServico < dados.servicos.length - 1})`
                    );

                    indiceServico++;
                    break;
                }

                case 'Funcionário confirma agendamento':
                case 'Confirma agendamento':
                    variables = { funcionarioConfirma: true };
                    console.log(`   → Funcionário confirma agendamento (${task.name})`);
                    break;

                case 'Funcionário confirma ou altera serviços':
                    passagemConfirmar++;
                    if (passagemConfirmar === 1) {
                        // 1ª passagem: remover ANTI_QUEDA
                        variables = {
                            servicosActualizados: dados.servicos,
                            qtdServicos: dados.servicos.length,
                            adicionarServico: false,
                            removerServico: true
                        };
                        console.log(`   → Funcionário escolhe remover ANTI_QUEDA da lista`);
                    } else if (passagemConfirmar === 2) {
                        // 2ª passagem: adicionar APARAR_PELO_CARA
                        variables = {
                            adicionarServico: true,
                            removerServico: false
                        };
                        console.log(`   → Funcionário escolhe adicionar APARAR_PELO_CARA`);
                    } else {
                        // 3ª passagem: confirmar lista final
                        variables = {
                            adicionarServico: false,
                            removerServico: false
                        };
                        console.log('   → Funcionário confirma lista de serviços');
                    }
                    break;

                case 'Selecionar serviço a remover':
                    variables = { servicoARemover: dados.antiQuedaId };
                    console.log(`   → Selecionar ANTI_QUEDA para remover`);
                    break;

                case 'Selecionar serviço a adicionar':
                    // Em sub_preparar_servicos: indica qual serviço adicionar
                    // o worker obter-preco-duracao lê tipoServicoId e servicoTemp
                    variables = {
                        tipoServicoId: dados.servicoAdicionar.tipoServicoId,
                        servicoTemp: {
                            tipoServicoId: dados.servicoAdicionar.tipoServicoId,
                            nomeServico: dados.servicoAdicionar.nomeServico
                        }
                    };
                    console.log(`   → Selecionar APARAR_PELO_CARA para adicionar`);
                    break;

                case 'Funcionário indica data e hora preferida': {
                    let dataPreferida = new Date('2026-04-29T17:00:00');
                    while (dataPreferida.getDay() === 0) {
                        dataPreferida = addDays(dataPreferida, 1);
                    }
                    variables = {
                        dataPreferida: dataPreferida.toISOString(),
                        horaPreferida: '17:00',
                        operacaoBemSucedida: true
                    };
                    console.log(`   → Definir data preferida: ${format(dataPreferida, 'dd/MM/yyyy HH:mm:ss')}`);
                    break;
                }

                case 'Funcionário visualiza e seleciona opção':
                    variables = {
                        opcaoSelecionada: 0,
                        todosRecursosDisponiveis: true
                    };
                    console.log('   → Selecionar primeira opção e marcar todos recursos disponíveis');
                    break;

                default:
                    console.log(`   ⚠️ Task desconhecida (IGNORADA): ${task.name} (key: ${task.taskDefinitionKey})`);
                    continue;
            }

            try {
                await completarTask(task.id, variables);
                console.log('   ✅ Task completada\n');
                tasksProcessadas++;
            } catch (err) {
                throw new Error(`Falha ao completar task "${task.name}" (${task.id}): ${err.message}`);
            }
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        tentativas++;
    }

    if (!terminouComSucesso) {
        throw new Error(`Esgotou ${MAX_TENTATIVAS} tentativas — processo ${processInstanceId} ainda ativo.`);
    }

    return tasksProcessadas;
}


async function verificarResultado(processInstanceId, dados, instanceIds) {
    console.log('\n📊 Verificar resultado final na BD...\n');

    const agendamento = await prisma.agendamento.findFirst({
        where: { processInstanceId: processInstanceId },
        include: {
            animal: {
                include: { cliente: { include: { utilizador: true } } }
            },
            servicos: {
                orderBy: { ordem: 'asc' },
                include: { tipoServico: true, funcionario: true, sala: true }
            }
        }
    });

    if (!agendamento) {
        throw new Error('Nenhum agendamento encontrado na base de dados.');
    }

    console.log('🎉 AGENDAMENTO CRIADO!');
    console.log(`   ID: ${agendamento.id}`);
    console.log(`   Estado: ${agendamento.estado}`);
    console.log(`   Data: ${agendamento.dataHoraInicio ? format(agendamento.dataHoraInicio, 'dd/MM/yyyy HH:mm:ss') : '—'}`);
    console.log(`   Valor: ${agendamento.valorTotal}€`);
    console.log(`   Serviços: ${agendamento.servicos.length}\n`);

    const reservasResiduais = await prisma.reservaTemporaria.count({
        where: { processInstanceId: { in: instanceIds } }
    });

    const problemas = validarAgendamento(agendamento, dados, reservasResiduais);
    if (problemas.length > 0) {
        throw new Error('Agendamento inválido:\n' + problemas.map(p => `  • ${p}`).join('\n'));
    }

    console.log('✅ Validação de AgendamentoServico passou.');
}

function validarAgendamento(agendamento, dados, reservasResiduais) {
    const problemas = [];
    const servicosEsperados = dados.servicosEsperados ?? dados.servicos.length;

    if (agendamento.servicos.length !== servicosEsperados) {
        problemas.push(`esperava ${servicosEsperados} AgendamentoServico, obteve ${agendamento.servicos.length}`);
    }

    if (agendamento.estado !== 'CONFIRMADO') {
        problemas.push(`estado do agendamento é '${agendamento.estado}' (esperado 'CONFIRMADO')`);
    }

    const emailEsperado = dados.clienteEmail;
    const emailReal = agendamento.animal?.cliente?.utilizador?.email;
    if (emailEsperado && emailReal && emailEsperado !== emailReal) {
        problemas.push(`cliente do agendamento (${emailReal}) != cliente enviado (${emailEsperado})`);
    }

    if (reservasResiduais > 0) {
        problemas.push(`${reservasResiduais} ReservaTemporaria órfã(s) deste processo após confirmação — confirmar-reservas/libertar-reservas falhou`);
    }

    let somaPrecos = 0;
    let fimAnterior = null;

    for (const s of agendamento.servicos) {
        const rotulo = `serviço ordem=${s.ordem} (${s.tipoServico?.tipo || s.tipoServicoId})`;

        if (!s.funcionarioId) problemas.push(`${rotulo}: funcionarioId em falta`);
        if (!s.salaId) problemas.push(`${rotulo}: salaId em falta`);
        if (!s.dataHoraInicio) problemas.push(`${rotulo}: dataHoraInicio em falta`);
        if (!s.dataHoraFim) problemas.push(`${rotulo}: dataHoraFim em falta`);

        if (s.dataHoraInicio && s.dataHoraFim && s.dataHoraFim <= s.dataHoraInicio) {
            problemas.push(`${rotulo}: dataHoraFim (${s.dataHoraFim.toISOString()}) <= dataHoraInicio (${s.dataHoraInicio.toISOString()})`);
        }

        if (s.dataHoraInicio && s.dataHoraFim && s.duracaoNoMomento > 0) {
            const minutosReais = (s.dataHoraFim.getTime() - s.dataHoraInicio.getTime()) / 60000;
            if (minutosReais !== s.duracaoNoMomento) {
                problemas.push(`${rotulo}: duração efectiva (${minutosReais}min) != duracaoNoMomento (${s.duracaoNoMomento}min)`);
            }
        }

        if (fimAnterior && s.dataHoraInicio && s.dataHoraInicio < fimAnterior) {
            problemas.push(`${rotulo}: começa (${s.dataHoraInicio.toISOString()}) antes do fim do anterior (${fimAnterior.toISOString()})`);
        }
        fimAnterior = s.dataHoraFim || fimAnterior;

        if (!(Number(s.precoNoMomento) > 0)) problemas.push(`${rotulo}: precoNoMomento inválido (${s.precoNoMomento})`);
        if (!(s.duracaoNoMomento > 0)) problemas.push(`${rotulo}: duracaoNoMomento inválido (${s.duracaoNoMomento})`);

        somaPrecos += Number(s.precoNoMomento) || 0;
    }

    const valorTotal = Number(agendamento.valorTotal);
    if (Math.abs(valorTotal - somaPrecos) > 0.01) {
        problemas.push(`valorTotal (${valorTotal}) != soma dos precoNoMomento (${somaPrecos})`);
    }

    if (agendamento.servicos.length > 0) {
        const primeiro = agendamento.servicos[0].dataHoraInicio;
        const ultimo = agendamento.servicos[agendamento.servicos.length - 1].dataHoraFim;
        if (primeiro && agendamento.dataHoraInicio && primeiro.getTime() !== agendamento.dataHoraInicio.getTime()) {
            problemas.push(`dataHoraInicio do agendamento (${agendamento.dataHoraInicio.toISOString()}) != início do primeiro serviço (${primeiro.toISOString()})`);
        }
        if (ultimo && agendamento.dataHoraFim && ultimo.getTime() !== agendamento.dataHoraFim.getTime()) {
            problemas.push(`dataHoraFim do agendamento (${agendamento.dataHoraFim.toISOString()}) != fim do último serviço (${ultimo.toISOString()})`);
        }
    }

    return problemas;
}

// =====================================================
// TESTE GESTÃO DE AGENDAMENTO — INÍCIO
// =====================================================

// Configuração: escolher caminho a testar
const GESTAO_ACCAO = 'CANCELAR';       // 'ATENDER' | 'CANCELAR' | 'NAO_COMPARECEU'
const GESTAO_QUER_REAGENDAR = true;    // true | false — só relevante em CANCELAR e NAO_COMPARECEU

async function limparGestaoAnterior() {
    console.log('🧹 [Gestão] Limpar instâncias gestao_agendamento anteriores...');

    const instancias = await request(`${CAMUNDA_API}/process-instance`, 'GET', {
        params: { processDefinitionKey: 'gestao_agendamento' }
    });

    if (instancias.length > 0) {
        console.log(`   A apagar ${instancias.length} instância(s) do processo 'gestao_agendamento'...`);
        for (const inst of instancias) {
            try {
                await request(`${CAMUNDA_API}/process-instance/${inst.id}?skipCustomListeners=true&skipIoMappings=true`, 'DELETE');
            } catch (err) {
                console.log(`   ⚠️  Falha a apagar ${inst.id}: ${err.message}`);
            }
        }
    }

    console.log('✅ [Gestão] Instâncias anteriores removidas.\n');
}

async function iniciarGestaoAgendamento(agendamentoId, dados) {
    console.log(`🚀 [Gestão] Iniciar gestao_agendamento (${GESTAO_ACCAO})...`);
    console.log(`   agendamentoId: ${agendamentoId}\n`);

    const response = await request(`${CAMUNDA_API}/process-definition/key/gestao_agendamento/start`, 'POST', {
        variables: {
            agendamentoId: { value: agendamentoId, type: 'string' },
            clienteEmail:  { value: dados.clienteEmail, type: 'string' },
            nomeCliente:   { value: dados.nomeCliente, type: 'string' },
        }
    });

    console.log(`✅ Processo iniciado!`);
    console.log(`   Process Instance ID: ${response.id}`);
    console.log(`   🔗 Cockpit: http://localhost:8080/camunda/app/cockpit/default/#/process-instance/${response.id}\n`);

    await new Promise(r => setTimeout(r, 1000));
    return response.id;
}

async function processarTasksGestao(processId) {
    let tentativas = 0;
    let tasksProcessadas = 0;
    let terminouComSucesso = false;
    let passagemConfirmar = 0;

    console.log('🔄 [Gestão] Processar tasks automaticamente...\n');

    while (tentativas < MAX_TENTATIVAS) {
        await verificarIncidents(processId);

        const tasks = await buscarTasks(processId);

        const tasksDoFluxo = tasks.filter(task =>
            [
                'Funcionário abre agendamento',
                'Registar Check-in',
                'Executar serviços',
                'Registar Check-out',
                'Receber pagamento',
                'Registar cancelamento',
                'Registar não comparência',
                // sub-processos (caminho de reagendamento)
                'Funcionário confirma ou altera serviços',
                'Funcionário indica data e hora preferida',
                'Funcionário visualiza e seleciona opção',
                'Funcionário confirma agendamento',
                'Confirma agendamento',
            ].includes(task.name)
        );

        if (tasksDoFluxo.length === 0) {
            const ativo = await arvoreInstanciasAtiva(processId);
            if (!ativo) {
                console.log('\n✅ [Gestão] Processo terminou no Camunda!');
                terminouComSucesso = true;
                break;
            }
            console.log('⏳ [Gestão] Sem user tasks; processo ainda ativo...');
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
            tentativas++;
            continue;
        }

        for (const task of tasksDoFluxo) {
            console.log(`📝 [Gestão] Task → "${task.name}"`);
            console.log(`   • ID: ${task.id}`);
            console.log(`   • Key: ${task.taskDefinitionKey}`);

            let variables = {};

            switch (task.name) {
                case 'Funcionário abre agendamento':
                    variables = { accaoFuncionario: GESTAO_ACCAO };
                    console.log(`   → Ação: ${GESTAO_ACCAO}`);
                    break;

                // Caminho ATENDER
                case 'Registar Check-in':
                    variables = { estado: 'EM_ATENDIMENTO', checkIn: true };
                    console.log('   → Registar check-in (EM_ATENDIMENTO)');
                    break;

                case 'Executar serviços':
                    variables = {};
                    console.log('   → Executar serviços (sem variáveis)');
                    break;

                case 'Registar Check-out':
                    variables = { estado: 'CONCLUIDO', checkOut: true };
                    console.log('   → Registar check-out (CONCLUIDO)');
                    break;

                case 'Receber pagamento':
                    variables = { metodoPagamento: 'MULTIBANCO' };
                    console.log('   → Pagamento: MULTIBANCO');
                    break;

                // Caminho CANCELAR
                case 'Registar cancelamento':
                    variables = { estado: 'CANCELADO', clienteQuerReagendar: GESTAO_QUER_REAGENDAR };
                    console.log(`   → Cancelamento registado (reagendar=${GESTAO_QUER_REAGENDAR})`);
                    break;

                // Caminho NAO_COMPARECEU
                case 'Registar não comparência':
                    variables = { estado: 'NAO_COMPARECEU', clienteQuerReagendar: GESTAO_QUER_REAGENDAR };
                    console.log(`   → Não comparência registada (reagendar=${GESTAO_QUER_REAGENDAR})`);
                    break;

                // Sub-processos do reagendamento (CANCELAR com reagendar=true)
                case 'Funcionário confirma ou altera serviços':
                    passagemConfirmar++;
                    variables = { adicionarServico: false, removerServico: false };
                    console.log(`   → Confirmar serviços sem alterações (passagem ${passagemConfirmar})`);
                    break;

                case 'Funcionário indica data e hora preferida': {
                    const dataReagendar = new Date('2026-04-30T17:00:00');
                    variables = {
                        dataPreferida: dataReagendar.toISOString(),
                        horaPreferida: '17:00',
                        operacaoBemSucedida: true,
                    };
                    console.log(`   → Nova data: ${format(dataReagendar, 'dd/MM/yyyy HH:mm:ss')}`);
                    break;
                }

                case 'Funcionário visualiza e seleciona opção':
                    variables = { opcaoSelecionada: 2, todosRecursosDisponiveis: true };
                    console.log('   → Selecionar terceira opção');
                    break;

                case 'Funcionário confirma agendamento':
                case 'Confirma agendamento':
                    variables = { funcionarioConfirma: true };
                    console.log(`   → Confirmar agendamento (${task.name})`);
                    break;

                default:
                    console.log(`   ⚠️  Task desconhecida (IGNORADA): ${task.name} (key: ${task.taskDefinitionKey})`);
                    continue;
            }

            try {
                await completarTask(task.id, variables);
                console.log('   ✅ Task completada\n');
                tasksProcessadas++;
            } catch (err) {
                throw new Error(`[Gestão] Falha ao completar task "${task.name}" (${task.id}): ${err.message}`);
            }
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        tentativas++;
    }

    if (!terminouComSucesso) {
        throw new Error(`[Gestão] Esgotou ${MAX_TENTATIVAS} tentativas — processo ${processId} ainda ativo.`);
    }

    return tasksProcessadas;
}

async function validarGestaoAgendamento(agendamentoId, instanceIds) {
    console.log('\n📊 [Gestão] Verificar resultado na BD...\n');

    const agendamento = await prisma.agendamento.findUnique({
        where: { id: agendamentoId },
        include: {
            servicos: { orderBy: { ordem: 'asc' }, include: { tipoServico: true } }
        }
    });

    if (!agendamento) throw new Error(`[Gestão] Agendamento ${agendamentoId} não encontrado na BD.`);

    const reservasResiduais = await prisma.reservaTemporaria.count({
        where: { processInstanceId: { in: instanceIds } }
    });

    const problemas = [];

    if (reservasResiduais > 0) {
        problemas.push(`${reservasResiduais} ReservaTemporaria(s) órfã(s) após gestão`);
    }

    if (GESTAO_ACCAO === 'ATENDER') {
        console.log(`   Estado: ${agendamento.estado}`);
        console.log(`   Fatura: ${agendamento.faturaId ?? '—'}`);
        console.log(`   Pago em: ${agendamento.pagoEm ? format(agendamento.pagoEm, 'dd/MM/yyyy HH:mm:ss') : '—'}`);
        console.log(`   Método: ${agendamento.metodoPagamento ?? '—'}`);

        if (agendamento.estado !== 'CONCLUIDO')
            problemas.push(`estado esperado 'CONCLUIDO', obtido '${agendamento.estado}'`);
        if (!agendamento.faturaId)
            problemas.push('faturaId não preenchido após CONCLUIDO');
        if (!agendamento.pagoEm)
            problemas.push('pagoEm não preenchido após pagamento');
        if (agendamento.metodoPagamento !== 'MULTIBANCO')
            problemas.push(`metodoPagamento esperado 'MULTIBANCO', obtido '${agendamento.metodoPagamento}'`);

    } else if (GESTAO_ACCAO === 'CANCELAR' && GESTAO_QUER_REAGENDAR) {
        console.log(`   Estado: ${agendamento.estado}`);
        console.log(`   Nova data início: ${agendamento.dataHoraInicio ? format(agendamento.dataHoraInicio, 'dd/MM/yyyy HH:mm:ss') : '—'}`);
        console.log(`   Serviços: ${agendamento.servicos.length}`);

        if (agendamento.estado !== 'CONFIRMADO')
            problemas.push(`estado esperado 'CONFIRMADO' após reagendamento, obtido '${agendamento.estado}'`);

    } else if (GESTAO_ACCAO === 'CANCELAR' && !GESTAO_QUER_REAGENDAR) {
        console.log(`   Estado: ${agendamento.estado}`);

        if (agendamento.estado !== 'CANCELADO')
            problemas.push(`estado esperado 'CANCELADO', obtido '${agendamento.estado}'`);

    } else if (GESTAO_ACCAO === 'NAO_COMPARECEU' && GESTAO_QUER_REAGENDAR) {
        console.log(`   Estado: ${agendamento.estado}`);
        console.log(`   Nova data início: ${agendamento.dataHoraInicio ? format(agendamento.dataHoraInicio, 'dd/MM/yyyy HH:mm:ss') : '—'}`);
        console.log(`   Serviços: ${agendamento.servicos.length}`);

        if (agendamento.estado !== 'CONFIRMADO')
            problemas.push(`estado esperado 'CONFIRMADO' após reagendamento, obtido '${agendamento.estado}'`);

    } else if (GESTAO_ACCAO === 'NAO_COMPARECEU' && !GESTAO_QUER_REAGENDAR) {
        console.log(`   Estado: ${agendamento.estado}`);

        if (agendamento.estado !== 'NAO_COMPARECEU')
            problemas.push(`estado esperado 'NAO_COMPARECEU', obtido '${agendamento.estado}'`);
    }

    if (problemas.length > 0) {
        throw new Error('[Gestão] Validação falhou:\n' + problemas.map(p => `  • ${p}`).join('\n'));
    }

    console.log('✅ [Gestão] Validação passou.');
}

async function testeGestaoAgendamento(agendamentoId, dados) {
    const reagendarLabel = GESTAO_ACCAO === 'CANCELAR' || GESTAO_ACCAO === 'NAO_COMPARECEU' ? ` (reagendar=${GESTAO_QUER_REAGENDAR})` : '';
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  TESTE GESTÃO — ${(GESTAO_ACCAO + reagendarLabel).padEnd(43)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`   Agendamento base: ${agendamentoId}\n`);

    await limparGestaoAnterior();
    const processId = await iniciarGestaoAgendamento(agendamentoId, dados);
    await processarTasksGestao(processId);
    const instanceIds = await validarProcessoCamunda(processId);
    await validarGestaoAgendamento(agendamentoId, instanceIds);

    console.log('\n🎉 [Gestão] TESTE CONCLUÍDO!\n');
}

// =====================================================
// FIM TESTE GESTÃO DE AGENDAMENTO
// =====================================================

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        TESTE - FLUXO DE AGENDAMENTO            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
        await limparEstadoAnterior();
        const dados = await carregarDadosTeste();
        const processId = await iniciarProcesso(dados);
        await processarTasks(processId, dados);
        const instanceIds = await validarProcessoCamunda(processId);
        await verificarResultado(processId, dados, instanceIds);

        // INÍCIO BLOCO GESTÃO
        const agendamentoBase = await prisma.agendamento.findFirst({ where: { processInstanceId: processId } });
        if (!agendamentoBase) throw new Error('Agendamento base não encontrado para iniciar teste de gestão.');
        await testeGestaoAgendamento(agendamentoBase.id, dados);
        // FIM BLOCO GESTÃO

        console.log('\n🎉 TESTE CONCLUÍDO!');
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main().then(() => process.exit(process.exitCode ?? 0));