// =====================================================
// TESTE AUTOMÁTICO - FLUXO DE AGENDAMENTO CAMUNDA
// =====================================================

import { createRequire } from 'node:module';
const req = createRequire(new URL('../backend/package.json', import.meta.url));

req('dotenv').config({ path: './backend/.env' });

const { addDays, setHours, setMinutes } = req('date-fns');
const { PrismaClient } = req('@prisma/client');

const prisma = new PrismaClient();
const CAMUNDA_API = 'http://localhost:8080/engine-rest';

const POLL_INTERVAL = 1500;
const MAX_TENTATIVAS = 40;

let dadosCache = {};
let indiceServico = 0;

async function request(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
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

    const response = await fetch(finalUrl, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

async function carregarDadosTeste() {
    console.log('📦 Carregar dados de teste da BD...\n');

    const cliente = await prisma.cliente.findFirst({
        include: { utilizador: true, animais: true }
    });

    if (!cliente) throw new Error('Nenhum cliente encontrado. Corre o seed!');

    const animal = cliente.animais[1];
    if (!animal) throw new Error('Cliente sem animais!');

    const servicos = await prisma.tipoServico.findMany({
        where: { ativo: true },
        take: 2
    });

    const funcionario = await prisma.funcionario.findFirst();

    dadosCache = {
        clienteId: cliente.id,
        clienteEmail: cliente.utilizador?.email,
        nomeCliente: cliente.utilizador?.nome,
        animalId: animal.id,
        porteAnimal: animal.porte,
        funcionarioId: funcionario?.id || null,
        servicos: servicos.map(s => ({
            tipoServicoId: s.id,
            nomeServico: s.tipo,
            duracaoMinutos: s.duracaoMinutos,
            pprecoBase: s.precoBase
        }))
    };

    console.log('✅ Dados carregados:');
    console.log(`   Cliente: ${dadosCache.nomeCliente}`);
    console.log(`   Animal : ${dadosCache.animalId} (${dadosCache.porteAnimal})`);
    console.log(`   Serviços: ${dadosCache.servicos.map(s => s.nomeServico).join(', ')}\n`);
}

async function iniciarProcesso() {
    console.log('🚀 Iniciar processo de agendamento...\n');

    const response = await request(`${CAMUNDA_API}/process-definition/key/agendamento/start`, 'POST', {
        variables: {
            clienteRegistado: { value: true, type: 'boolean' },
            funcionarioPreferido: { value: dadosCache.funcionarioId, type: 'string' },
            servicosIniciais: {
                value: JSON.stringify(dadosCache.servicos),
                type: 'json'
            },
            porteAnimal: { value: dadosCache.porteAnimal, type: 'string' },
            clienteEmail: { value: dadosCache.clienteEmail, type: 'string' }
        }
    });

    console.log(`✅ Processo iniciado com sucesso!`);
    console.log(`   Process Instance ID: ${response.id}`);
    console.log(`   🔗 Cockpit: http://localhost:8080/camunda/app/cockpit/default/#/process-instance/${response.id}\n`);

    await new Promise(r => setTimeout(r, 1000));
    return response.id;
}

async function buscarTasks() {
    return await request(`${CAMUNDA_API}/task`, 'GET', {
        params: {
            assignee: 'funcionario'
        }
    });
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

async function processoAindaAtivo(processInstanceId) {
    try {
        const inst = await request(`${CAMUNDA_API}/process-instance/${processInstanceId}`);
        return !!inst?.id;
    } catch (err) {
        if (String(err.message).includes('HTTP 404')) return false;
        throw err;
    }
}

async function processarTasks(processInstanceId) {
    let tentativas = 0;
    let tasksProcessadas = 0;

    console.log('🔄 Processar tasks automaticamente...\n');

    while (tentativas < MAX_TENTATIVAS) {
        const tasks = await buscarTasks();

        const tasksDoFluxo = tasks.filter(task =>
            [
                'Abrir ficha do cliente',
                'Selecionar porte do animal',
                'Selecionar animal',
                'Selecionar serviço',
                'Funcionário confirma ou altera serviços',
                'Selecionar serviço a adicionar',
                'Funcionário indica data e hora preferida',
                'Funcionário visualiza e seleciona opção',
                'Funcionário confirma agendamento',
                'Confirma agendamento'
            ].includes(task.name)
        );

        if (tasksDoFluxo.length === 0) {
            const ativo = await processoAindaAtivo(processInstanceId);

            if (!ativo) {
                console.log('\n✅ Processo terminou no Camunda!');
                break;
            }

            console.log('⏳ Sem user tasks neste momento; processo ainda ativo (provavelmente em external tasks)...');
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
                    variables = { porteAnimal: dadosCache.porteAnimal };
                    console.log(`   → Definir porte do animal: ${dadosCache.porteAnimal}`);
                    break;

                case 'Selecionar animal':
                    variables = { animalId: dadosCache.animalId };
                    console.log('   → Selecionar animal');
                    break;

                case 'Selecionar serviço': {
                    const servico = dadosCache.servicos[indiceServico];

                    variables = {
                        tipoServicoId: servico.tipoServicoId,
                        servicoTemp: {
                            tipoServicoId: servico.tipoServicoId,
                            nomeServico: servico.nomeServico
                        },
                        operacaoBemSucedida: true,
                        // volta ao ecrã enquanto houver mais serviços para escolher
                        adicionarOutroServico: indiceServico < dadosCache.servicos.length - 1
                    };

                    console.log(
                        `   → Selecionando serviço ${indiceServico + 1}/${dadosCache.servicos.length}: ${servico.nomeServico} (adicionarOutroServico=${indiceServico < dadosCache.servicos.length - 1})`
                    );

                    indiceServico++;
                    break;
                }

                case 'Funcionário confirma agendamento':
                case 'Confirma agendamento':
                    variables = { funcionarioConfirma: true };
                    console.log(`   → Funcionário confirma agendamento (${task.name})`);
                    break;

                // SUBPROCESSO sub_preparar_servicos: PREPARAR SERVIÇOS
                case 'Funcionário confirma ou altera serviços':
                    variables = {
                        servicosConfirmados: true,
                        servicosActualizados: dadosCache.servicos,
                        qtdServicos: dadosCache.servicos.length,
                        adicionarServico: false,
                        removerServico: false
                    };
                    console.log('   → Funcionário confirma serviços sem adicionar novos');
                    break;

                case 'Selecionar serviço a adicionar':
                    variables = { adicionarServico: false };
                    console.log('   → Não adicionar serviços extra (adicionarServico = false)');
                    break;

                // SUBPROCESSO sub_gerar_selecionar_opcao: GERAR E SELECIONAR OPÇÃO
                case 'Funcionário indica data e hora preferida': {
                    const dataPreferida = setHours(setMinutes(addDays(new Date(), 2), 0), 10);
                    variables = {
                        dataPreferida: dataPreferida.toISOString(),
                        horaPreferida: '10:00',
                        operacaoBemSucedida: true
                    };
                    console.log(`   → Definir data preferida: ${dataPreferida.toLocaleString('pt-PT')}`);
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
                console.log(`   ❌ Erro ao completar task ${task.id}: ${err.message}`);
            }
        }
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    tentativas++;
}


async function verificarResultado(processInstanceId) {
    console.log('\n📊 Verificar resultado final na BD...\n');

    const agendamento = await prisma.agendamento.findFirst({
        where: { processInstanceId: processInstanceId },
        include: { animal: true, servicos: true }
    });

    if (agendamento) {
        console.log('🎉 AGENDAMENTO CRIADO COM SUCESSO!');
        console.log(`   ID: ${agendamento.id}`);
        console.log(`   Data: ${agendamento.dataHoraInicio?.toLocaleString('pt-PT')}`);
        console.log(`   Valor: ${agendamento.valorTotal}€`);
        console.log(`   Serviços: ${agendamento.servicos.length}`);
    } else {
        console.log('❌ Nenhum agendamento encontrado na base de dados.');
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        TESTE AUTOMÁTICO - FLUXO DE AGENDAMENTO            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
        await carregarDadosTeste();
        const processId = await iniciarProcesso();
        await processarTasks(processId);
        await verificarResultado(processId);

        console.log('\n🎉 TESTE CONCLUÍDO!');
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();