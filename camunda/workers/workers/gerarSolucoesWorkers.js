const { Variables } = require('camunda-external-task-client-js');
const { log } = require('../utils/logger');
const prisma = require('../utils/db');
const { verificarDisponibilidade } = require('../services/reservas');
const { getVariable, parseJsonSafe } = require('../utils/worker-utils');
const { addMinutes, addDays, startOfDay, areIntervalsOverlapping } = require('date-fns');

// Dias da semana no formato do schema
function getDiaSemana(data) {
    return ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'][data.getDay()];
}

// Verifica se o slot [inicio, fim] cabe no turno sem sobrepor a pausa
function slotCabeNoTurno(horario, dataBase, inicio, fim) {
    const toDateTime = (timeField) => {
        const d = new Date(dataBase);
        d.setUTCHours(timeField.getUTCHours(), timeField.getUTCMinutes(), 0, 0);
        return d;
    };

    const inicioTurno = toDateTime(horario.horaInicio);
    const fimTurno = toDateTime(horario.horaFim);

    if (inicio < inicioTurno || fim > fimTurno) return false;

    // Só verifica pausa se existir
    if (horario.pausaInicio && horario.pausaFim) {
        const pausaInicio = toDateTime(horario.pausaInicio);
        const pausaFim = toDateTime(horario.pausaFim);
        return !areIntervalsOverlapping(
            { start: inicio, end: fim },
            { start: pausaInicio, end: pausaFim },
            { inclusive: false }
        );
    }

    return true;
}

async function gerarSolucoes({
    servicosOrdenados = [],
    porteAnimal,
    dataPreferida,
    funcionarioPreferido = null,
    processInstanceId,
    diasParaProcurar = 7,
    maxOpcoes = 8,
}) {
    if (servicosOrdenados.length === 0) {
        throw new Error('Pelo menos um serviço é necessário para gerar soluções');
    }
    if (!porteAnimal) throw new Error('porteAnimal é obrigatório');
    if (!dataPreferida) throw new Error('dataPreferida é obrigatório');
    if (!processInstanceId) throw new Error('processInstanceId é obrigatório');

    log(
        'gerar-solucoes',
        `${servicosOrdenados.length} serviço(s) | porte=${porteAnimal} | data=${dataPreferida} | proc=${processInstanceId}`,
        'info'
    );

    const tiposNecessarios = servicosOrdenados.map((s) => s.tipoServicoId);

    const todosOsFuncionarios = await prisma.funcionario.findMany({
        where: {
            porteAnimais: { has: porteAnimal },
            funcionarioServico: { some: { tipoServicoId: { in: tiposNecessarios } } },
        },
        include: {
            horariosTrabalho: { where: { ativo: true } },
            funcionarioServico: { select: { tipoServicoId: true } },
        },
    });

    const todasAsSalas = await prisma.sala.findMany({
        where: {
            ativo: true,
            salasServico: { some: { tipoServicoId: { in: tiposNecessarios } } },
        },
        include: {
            salasServico: { select: { tipoServicoId: true } },
        },
    });

    const recursosPorServico = servicosOrdenados.map((servico) => ({
        servico,
        funcionarios: todosOsFuncionarios.filter((f) =>
            f.funcionarioServico.some((fs) => fs.tipoServicoId === servico.tipoServicoId)
        ),
        salas: todasAsSalas.filter((s) =>
            s.salasServico.some((ss) => ss.tipoServicoId === servico.tipoServicoId)
        ),
    }));

    const opcoes = [];
    const dataBase = new Date(dataPreferida);

    for (let dia = 0; dia < diasParaProcurar && opcoes.length < maxOpcoes; dia++) {
        const dataDoDia = addDays(startOfDay(dataBase), dia);
        const diaSemana = getDiaSemana(dataDoDia);

        const slotsInicio = new Set();
        for (const { funcionarios } of recursosPorServico) {
            for (const func of funcionarios) {
                for (const h of func.horariosTrabalho) {
                    if (!h.diasSemana.includes(diaSemana)) continue;

                    const inicioTurno = new Date(dataDoDia);
                    inicioTurno.setUTCHours(
                        h.horaInicio.getUTCHours(),
                        h.horaInicio.getUTCMinutes(),
                        0,
                        0
                    );

                    const horaMin =
                        dia === 0
                            ? new Date(Math.max(inicioTurno.getTime(), dataBase.getTime()))
                            : inicioTurno;

                    const minutos = horaMin.getUTCMinutes();
                    const resto = minutos % 15;
                    const cursor = resto === 0 ? new Date(horaMin) : addMinutes(horaMin, 15 - resto);

                    const fimTurno = new Date(dataDoDia);
                    fimTurno.setUTCHours(h.horaFim.getUTCHours(), h.horaFim.getUTCMinutes(), 0, 0);

                    let t = new Date(cursor);
                    while (t < fimTurno) {
                        slotsInicio.add(t.toISOString());
                        t = addMinutes(t, 15);
                    }
                }
            }
        }

        const slotsOrdenados = [...slotsInicio].sort();

        for (const slotStr of slotsOrdenados) {
            if (opcoes.length >= maxOpcoes) break;

            const solucao = await tentarConstruirSolucao(
                recursosPorServico,
                dataDoDia,
                new Date(slotStr),
                funcionarioPreferido,
                processInstanceId
            );

            if (solucao) opcoes.push(solucao);
        }
    }


    opcoes.sort((a, b) => {
        const proxA = Math.abs(new Date(a.dataHoraInicio) - dataBase);
        const proxB = Math.abs(new Date(b.dataHoraInicio) - dataBase);
        if (proxA !== proxB) return proxA - proxB;
        if (a.numFuncionariosDiferentes !== b.numFuncionariosDiferentes)
            return a.numFuncionariosDiferentes - b.numFuncionariosDiferentes;
        return new Date(a.dataHoraInicio) - new Date(b.dataHoraInicio);
    });

    log('gerar-solucoes', `✓ ${opcoes.length} opção(ões) gerada(s)`, 'success');
    return { solucoes: opcoes, duracaoTotalMinutos: opcoes[0]?.duracaoTotal ?? 0 };
}

async function tentarConstruirSolucao(
    recursosPorServico,
    dataDoDia,
    inicioBase,
    funcionarioPreferido,
    processInstanceId
) {
    const servicosSolucao = [];
    let cursor = new Date(inicioBase);
    let funcAnteriorId = null;
    let salaAnteriorId = null;

    for (const { servico, funcionarios, salas } of recursosPorServico) {
        const fim = addMinutes(cursor, servico.duracaoMinutos);

        const funcsOrdenados = [...funcionarios].sort((a, b) => {
            const pa = a.id === funcionarioPreferido ? 0 : a.id === funcAnteriorId ? 1 : 2;
            const pb = b.id === funcionarioPreferido ? 0 : b.id === funcAnteriorId ? 1 : 2;
            return pa - pb;
        });

        let funcEscolhido = null;
        for (const func of funcsOrdenados) {
            const trabalhaNesteSlot = func.horariosTrabalho.some(
                (h) =>
                    h.diasSemana.includes(getDiaSemana(cursor)) &&
                    slotCabeNoTurno(h, dataDoDia, cursor, fim)
            );
            if (!trabalhaNesteSlot) continue;

            const disponivel = await verificarDisponibilidade({
                funcionarioId: func.id,
                salaId: null,
                dataHoraInicio: cursor.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId,
            });
            if (disponivel) {
                funcEscolhido = func;
                break;
            }
        }

        if (!funcEscolhido) return null;

        const salasOrdenadas = [...salas].sort((a, b) => {
            if (a.id === salaAnteriorId) return -1;
            if (b.id === salaAnteriorId) return 1;
            return b.capacidade - a.capacidade;
        });

        let salaEscolhida = null;
        for (const sala of salasOrdenadas) {
            const disponivel = await verificarDisponibilidade({
                salaId: sala.id,
                funcionarioId: null,
                dataHoraInicio: cursor.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId,
                capacidade: sala.capacidade,
            });
            if (disponivel) {
                salaEscolhida = sala;
                break;
            }
        }

        if (!salaEscolhida) return null;

        servicosSolucao.push({
            tipoServicoId: servico.tipoServicoId,
            nomeServico: servico.nomeServico ?? servico.nome ?? servico.tipoServicoId,
            ordem: servico.ordem,
            funcionarioId: funcEscolhido.id,
            salaId: salaEscolhida.id,
            dataHoraInicio: cursor.toISOString(),
            dataHoraFim: fim.toISOString(),
            precoBase: servico.precoBase,
            duracaoMinutos: servico.duracaoMinutos,
        });

        funcAnteriorId = funcEscolhido.id;
        salaAnteriorId = salaEscolhida.id;
        cursor = fim;
    }

    const numFuncs = new Set(servicosSolucao.map((s) => s.funcionarioId)).size;

    return {
        dataHoraInicio: servicosSolucao[0].dataHoraInicio,
        dataHoraFim: servicosSolucao[servicosSolucao.length - 1].dataHoraFim,
        duracaoTotal: servicosSolucao.reduce((s, x) => s + x.duracaoMinutos, 0),
        numFuncionariosDiferentes: numFuncs,
        servicos: servicosSolucao,
    };
}

// ─── Workers ──────────────────────────────────────────────────────────────

module.exports = (client) => {
    client.subscribe('gerar-solucoes', async ({ task, taskService }) => {
        const vars = new Variables();

        try {
            const servicosOrdenados = (() => {
                const s1 = parseJsonSafe(getVariable(task, 'servicosOrdenados'), []);
                if (Array.isArray(s1) && s1.length > 0) return s1;

                const s2 = parseJsonSafe(getVariable(task, 'servicosActualizados'), []);
                if (Array.isArray(s2) && s2.length > 0) return s2;

                return [];
            })();

            console.log(
                '[DEBUG GERAR-SOLUCOES] servicosOrdenados:\n',
                JSON.stringify(servicosOrdenados, null, 2)
            );

            const porteAnimal = getVariable(task, 'porteAnimal');
            const dataPreferida = getVariable(task, 'dataPreferida') ?? new Date().toISOString();
            const funcionarioPreferido = getVariable(task, 'funcionarioPreferido', null);
            const processInstanceId = task.processInstanceId;

            const resultado = await gerarSolucoes({
                servicosOrdenados,
                porteAnimal,
                dataPreferida,
                funcionarioPreferido,
                processInstanceId,
                diasParaProcurar: 7,
                maxOpcoes: 8,
            });

            console.log(
                '[DEBUG GERAR-SOLUCOES] resumo:',
                JSON.stringify(
                    resultado.solucoes.map((sol, i) => ({
                        idx: i,
                        inicio: sol.dataHoraInicio,
                        fim: sol.dataHoraFim,
                        duracaoTotal: sol.duracaoTotal,
                        numFuncionariosDiferentes: sol.numFuncionariosDiferentes,
                        servicos: (sol.servicos || []).map(s => ({
                            nomeServico: s.nomeServico,
                            funcionarioId: s.funcionarioId,
                            salaId: s.salaId,
                            precoBase: s.precoBase,
                            duracaoMinutos: s.duracaoMinutos
                        }))
                    })),
                    null,
                    2
                )
            );


            vars.set('solucoes', JSON.stringify(resultado.solucoes));
            vars.set('operacaoBemSucedida', resultado.solucoes.length > 0);
            vars.set('quantidadeSolucoes', resultado.solucoes.length);

            if (resultado.solucoes.length === 0) {
                vars.set(
                    'mensagemErro',
                    'Não foi encontrada disponibilidade nos próximos 7 dias'
                );
            }

            await taskService.complete(task, vars);
            log(
                'gerar-solucoes',
                `✓ ${resultado.solucoes.length} solução(ões) | proc=${processInstanceId}`,
                'success'
            );
        } catch (err) {
            log('gerar-solucoes', `Erro persistência: ${err.message}`, 'error');
            throw err;
            //log('gerar-solucoes', `Erro: ${err.message}`, 'error');
            //vars.set('operacaoBemSucedida', false);
            //vars.set('solucoes', '[]');
            //vars.set('mensagemErro', err.message);
            //await taskService.complete(task, vars);
        }
    });

    client.subscribe('ordenar-solucoes', async ({ task, taskService }) => {
        const vars = new Variables();

        try {
            const rawSolucoes = getVariable(task, 'solucoes', '[]');
            const dataPreferida = getVariable(task, 'dataPreferida');

            const solucoes = parseJsonSafe(rawSolucoes, []);
            const solucoesOrdenadas = [...solucoes].sort((a, b) => {
                const diffA =
                    Math.abs(new Date(a.dataHoraInicio) - new Date(dataPreferida));
                const diffB =
                    Math.abs(new Date(b.dataHoraInicio) - new Date(dataPreferida));
                if (diffA !== diffB) return diffA - diffB;

                const funcA = new Set((a.servicos || []).map((s) => s.funcionarioId)).size;
                const funcB = new Set((b.servicos || []).map((s) => s.funcionarioId)).size;
                if (funcA !== funcB) return funcA - funcB;

                return new Date(a.dataHoraInicio) - new Date(b.dataHoraInicio);
            });


            vars.set('solucoes', JSON.stringify(solucoesOrdenadas));

            if (solucoesOrdenadas.length > 0) {
                const sol = solucoesOrdenadas[0];
                const valorTotal = (sol.servicos || []).reduce(
                    (s, x) => s + (Number(x.precoBase) || 0),
                    0
                );

                vars.set('dataHoraInicio', sol.dataHoraInicio);
                vars.set('dataHoraFim', sol.dataHoraFim);
                vars.set('valorTotal', valorTotal);

                const funcId = sol.servicos?.[0]?.funcionarioId;
                const salaId = sol.servicos?.[0]?.salaId;
                if (funcId) vars.set('funcionarioId', funcId);
                if (salaId) vars.set('salaId', salaId);


                vars.set('opcaoSelecionadaNormalizada', JSON.stringify(sol));
            }

            vars.set('operacaoBemSucedida', solucoesOrdenadas.length > 0);

            await taskService.complete(task, vars);
            log(
                'ordenar-solucoes',
                `✓ ${solucoesOrdenadas.length} solução(ões) ordenada(s)`,
                'success'
            );
        } catch (err) {
            log('ordenar-solucoes', `Erro: ${err.message}`, 'error');
            vars.set('operacaoBemSucedida', false);
            vars.set('solucoes', '[]');
            await taskService.complete(task, vars);
        }
    });
};