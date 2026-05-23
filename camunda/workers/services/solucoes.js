// Service: solucoes — gerador de propostas de horário.
// Dado um conjunto de serviços (já ordenados pela DMN), o porte do animal e uma data preferida,
// procura combinações viáveis de "funcionário + sala + hora de início" para os próximos N dias (default 7)
// e devolve até `maxOpcoes` (default 4) propostas para o funcionário escolher. Os recursos elegíveis vêm do schema
// (Funcionario.porteAnimais + horariosTrabalho, Sala.capacidade, tabelas FuncionarioServico/SalaServico).
// A disponibilidade contra agendamentos existentes e reservas de outros processos é validada via
// `verificarDisponibilidade` em ./reservas.
//
// Algoritmo em 3 fases (ordenação por critérios de negócio é delegada a `ordenarSolucoes`):
//   1. CARREGAR candidatos: funcionários elegíveis (porte + serviço) e salas elegíveis (serviço).
//      `recursosPorServico` calcula, por serviço, o subconjunto exacto que o consegue fazer.
//   2. CONSTRUIR slots do dia (múltiplos de 15min):
//        - Dia 1: a partir de max(início do turno, dataPreferida).
//        - Dias seguintes: a partir do início do turno (sem restrição de hora).
//   3. PARA CADA SLOT (cronologicamente): heurística `algumFuncCobre` (se ninguém trabalha até
//      slot + duracaoTotal, break do dia); senão `tentarConstruirSolucao` encadeia os serviços
//      e devolve solução ou null. Pára em maxOpcoes (default 4).
//
// Exemplo (Mia, PEQUENO, 4 serviços = 130min, dataPreferida 29/04/2026 17:00):
//   - Dia 1 (29/04): primeiro slot = 17:00. Fim mínimo 17:00+130min = 19:10 excede o último
//     turno (19:00) → `algumFuncCobre = false` → break sem uma única query. 29/04 descartado.
//   - Dia 2 (30/04): slots a partir de 08:00. 08:00/08:15 falham (TOSQUIA cairia antes das 09:00,
//     Sofia/Tiago (funcionários habilitados) ainda fora do turno). 08:30 é viável: Miguel faz BANHO 08:30–09:00, Sofia entra
//     às 09:00 e faz o resto → opção 1 com 2 funcs. 08:45 idem (2 funcs). 09:00 e 09:15: Sofia
//     disponível desde o início, preferida pega-a para BANHO e mantém-se via "anterior" → 1 func.
//   - Sort: todas a 30/04, ordem cronológica = ordem por proximidade → 08:30, 08:45, 09:00, 09:15.
//
// Nota importante: na prática, o critério 1 (proximidade) decide TUDO. O scheduler nunca gera
// duas soluções no mesmo slot, e como os slots são sempre ≥ dataPreferida no dia 1 e em dias
// futuros nos seguintes, a ordem cronológica equivale à ordem por proximidade. Os critérios 2
// (menos funcs) e 3 (mais cedo) são salvaguardas teóricas que raramente actuam.

const prisma = require('../utils/db');
const { log, debug } = require('../utils/logger');
const { verificarDisponibilidade } = require('./reservas');
const { addMinutes, addDays, startOfDay, areIntervalsOverlapping } = require('date-fns');

const TOPIC = 'scheduler';

// ajustes:
// Granularidade dos slots de início, em minutos. 15 é o equilíbrio actual entre cobertura (apanha a maioria das janelas válidas)
// e custo (cada slot extra pode gerar queries à BD via `verificarDisponibilidade`).
//
// Para oferecer mais granularidade (e potencialmente mais opções), reduzir:
//   const GRANULARIDADE_SLOT_MIN = 10;  // tenta a cada 10min — ~50% mais slots
// Para ser mais conservador (menos queries, mas pode falhar janelas curtas):
//   const GRANULARIDADE_SLOT_MIN = 30;  // tenta só a cada 30min
// Não mexer abaixo de 5min sem rever a heurística `algumFuncCobre` — pode quebrar a propriedade "se ninguém cobre este slot,
// nenhum slot seguinte também cobre" (verdadeira só porque slots subsequentes começam mais tarde).
const GRANULARIDADE_SLOT_MIN = 15;

// Formata um Date como HH:MM (UTC) — usado nos logs do scheduler.
function fmtH(d) { return d.toISOString().slice(11, 16); }

/**
 * Converte um Date para o nome do dia, no formato que o schema usa em
 * HorarioTrabalho.diasSemana ('SEGUNDA', 'TERCA', ...). A ordem do array tem de bater certo com
 * Date.getDay() (0=Domingo, 6=Sábado), por isso DOMINGO está em primeiro.
 * @param {Date} data - Data cujo dia da semana se quer obter.
 * @returns {string} Nome do dia em maiúsculas ('SEGUNDA', 'TERCA', ..., 'DOMINGO').
 */
function getDiaSemana(data) {
    return ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'][data.getDay()];
}

/**
 * Combina o dia (de `dataBase`) com as horas/minutos UTC de `tf`, ignorando a parte da data de `tf`.
 * Isto existe porque a HorarioTrabalho guarda horaInicio/horaFim/pausaInicio/pausaFim como Time
 * (Prisma materializa-os num Date com uma data fictícia — só importam as horas). Para comparar
 * um slot real (29/04 10:30) com o turno (HH:MM apenas), é preciso juntar o dia ao HH:MM do turno.
 * @param {Date} dataBase - Data que fornece o dia (ano/mês/dia).
 * @param {Date} tf - Date do qual se extraem apenas as horas e minutos UTC.
 * @returns {Date} Novo Date com o dia de `dataBase` e as horas/minutos de `tf`.
 */
function combinarDataHora(dataBase, tf) {
    const d = new Date(dataBase);
    d.setUTCHours(tf.getUTCHours(), tf.getUTCMinutes(), 0, 0);
    return d;
}
/**
 * Verifica se o intervalo [inicio, fim] cabe inteiramente dentro do turno do funcionário e não
 * colide com a pausa de almoço, se existir.
 * Exemplo: HorarioTrabalho com horaInicio 09:00, horaFim 18:00, pausaInicio 13:00, pausaFim 14:00.
 *   slot 12:45 → 13:15 colide com a pausa → false
 *   slot 14:00 → 14:30 está fora da pausa e dentro do turno → true
 *   slot 17:45 → 18:15 ultrapassa o fim do turno → false
 * @param {object} horario - Registo HorarioTrabalho com horaInicio, horaFim, e pausaInicio e pausaFim.
 * @param {Date} dataBase - Dia em que o slot ocorre, usado por combinarDataHora para construir os timestamps do turno.
 * @param {Date} inicio - Início do slot a verificar.
 * @param {Date} fim - Fim do slot a verificar.
 * @returns {boolean} true se o slot cabe no turno sem colidir com a pausa; false caso contrário.
 */
function slotCabeNoTurno(horario, dataBase, inicio, fim) {
    const inicioTurno = combinarDataHora(dataBase, horario.horaInicio);
    const fimTurno = combinarDataHora(dataBase, horario.horaFim);

    if (inicio < inicioTurno || fim > fimTurno) return false;

    if (horario.pausaInicio && horario.pausaFim) {
        return !areIntervalsOverlapping(
            { start: inicio, end: fim },
            { start: combinarDataHora(dataBase, horario.pausaInicio), end: combinarDataHora(dataBase, horario.pausaFim) },
            { inclusive: false }
        );
    }

    return true;
}

/**
 * Tenta construir uma solução completa começando exatamente em `inicioBase`. Encadeia os serviços
 * uns a seguir aos outros (o fim do serviço N é o início do serviço N+1) e, para cada um, escolhe
 * o melhor funcionário e a melhor sala disponíveis no momento.
 *
 * Critério de escolha do funcionário (por ordem de preferência, dentro dos disponíveis):
 *   1. O `funcionarioPreferido` indicado no início do processo, se estiver disponível.
 *   2. O mesmo funcionário que fez o serviço anterior — evita trocas a meio do agendamento.
 *   3. Qualquer outro funcionário compatível.
 *
 * Critério de escolha da sala (dentro das livres):
 *   1. A mesma sala do serviço anterior — evita mover o animal entre salas.
 *   2. Sala de menor capacidade primeiro — favorece salas especializadas. A polivalente
 *      tem a maior capacidade do catálogo e fica naturalmente em último, livre para casos
 *      em que não há alternativa (sem regra explícita "polivalente é fallback").
 *
 * Devolve null se em qualquer ponto não houver funcionário ou sala disponível para o serviço actual
 * (a tentativa falha; o caller pode tentar outro slot de início).
 *
 * `bloqueiosFuncionario` e `bloqueiosSala` são caches partilhadas pelo dia: quando uma chamada a
 * verificarDisponibilidade devolve "ocupado, livre em X", guardamos que o funcionário/sala está
 * bloqueado até X. Tentativas seguintes nesse dia que comecem antes de X saltam-no sem ir à BD.
 *
 * Exemplo (Mia, 30/04 QUINTA-FEIRA — primeiro slot viável = 08:30, opção 1 final):
 *   serviço 1 (BANHO, 30min):            08:30–09:00 → Miguel Torres disponível ✓ (Sofia ainda
 *                                         fora do turno — só entra às 09:00)
 *   serviço 2 (TOSQUIA_COMPLETA, 60min): 09:00–10:00 → Sofia disponível (entrou entretanto),
 *                                         funcionarioPreferido desempata a favor dela ✓
 *   serviço 3 (APARAR_PELO_CARA, 25min): 10:00–10:25 → Sofia (funcAnteriorId = Sofia) ✓
 *   serviço 4 (LIMPEZA_OUVIDOS, 15min):  10:25–10:40 → Sofia ✓
 * → devolve solução com 2 funcionários diferentes (Miguel + Sofia).
 * Os slots 08:00 e 08:15 foram tentados antes e devolveram null: TOSQUIA_COMPLETA ficava
 * em 08:30–09:30 e 08:45–09:45 respectivamente — Sofia e Tiago (funcionários habilitados) ainda fora do turno às 08:xx.
 *
 * @param {Array<{servico: object, funcionarios: object[], salas: object[]}>} recursosPorServico - Serviços com os respectivos candidatos elegíveis, pré-filtrados por gerarSolucoes.
 * @param {Date} dataDoDia - Início do dia (meia-noite UTC) — usado por combinarDataHora ao verificar turnos.
 * @param {Date} inicioBase - Instante exacto em que o primeiro serviço deve começar.
 * @param {string|null} funcionarioPreferido - ID do funcionário preferido pelo cliente (pode ser null).
 * @param {string} processInstanceId - ID do processo Camunda activo — passado a verificarDisponibilidade para ignorar as próprias reservas temporárias.
 * @param {Map<string, Date>} bloqueiosFuncionario - Cache de bloqueios de funcionários partilhada pelo dia; actualizada dentro desta função quando se detecta ocupação.
 * @param {Map<string, Date>} bloqueiosSala - Cache de bloqueios de salas partilhada pelo dia; actualizada dentro desta função quando se detecta ocupação.
 * @returns {Promise<object|null>} Solução completa com todos os serviços encadeados, ou null se impossível neste slot.
 */
async function tentarConstruirSolucao(
    recursosPorServico,
    dataDoDia,
    inicioBase,
    funcionarioPreferido,
    processInstanceId,
    bloqueiosFuncionario,
    bloqueiosSala,
    agendamentoIdIgnorar
) {
    const servicosSolucao = [];
    let cursor = new Date(inicioBase);
    let funcAnteriorId = null;
    let salaAnteriorId = null;

    for (const { servico, funcionarios, salas } of recursosPorServico) {
        const fim = addMinutes(cursor, servico.duracaoMinutos);
        const nomeServico = servico.nomeServico ?? servico.nome ?? servico.tipoServicoId;

        debug(TOPIC, `    [${nomeServico}] ${fmtH(cursor)}–${fmtH(fim)} (${servico.duracaoMinutos}min) — ${funcionarios.length} func(s) candidato(s)`);

        // Ordenar candidatos: preferido (0) → anterior (1) → outros (2). O sort é estável,
        // por isso dentro de cada grupo a ordem original é mantida.
        const funcsOrdenados = [...funcionarios].sort((a, b) => {
            const pa = a.id === funcionarioPreferido ? 0 : a.id === funcAnteriorId ? 1 : 2;
            const pb = b.id === funcionarioPreferido ? 0 : b.id === funcAnteriorId ? 1 : 2;
            return pa - pb;
        });

        // Coleciona todos os funcionários disponíveis para este slot (não só o primeiro).
        // Os restantes vão para `outrosDisponiveis` no resultado — o frontend mostra
        // alternativas ao funcionário sem ter de re-correr o scheduler.
        const funcsDisponiveis = [];
        for (const func of funcsOrdenados) {
            const nome = func.utilizador?.nome ?? func.id;

            const bloqueadoAte = bloqueiosFuncionario.get(func.id);
            if (bloqueadoAte && cursor < bloqueadoAte) {
                debug(TOPIC, `      ${nome}: cache bloqueado até ${fmtH(bloqueadoAte)}`);
                continue;
            }

            const trabalhaNesteSlot = func.horariosTrabalho.some(
                (h) => h.diasSemana.includes(getDiaSemana(cursor)) && slotCabeNoTurno(h, dataDoDia, cursor, fim)
            );
            if (!trabalhaNesteSlot) {
                const turnoNoDia = func.horariosTrabalho.find((h) => h.diasSemana.includes(getDiaSemana(cursor)));
                const turnoStr = turnoNoDia
                    ? `turno ${fmtH(combinarDataHora(dataDoDia, turnoNoDia.horaInicio))}–${fmtH(combinarDataHora(dataDoDia, turnoNoDia.horaFim))}`
                    : 'não trabalha neste dia';
                debug(TOPIC, `      ${nome}: fora do turno (${turnoStr})`);
                continue;
            }

            const result = await verificarDisponibilidade({
                funcionarioId: func.id,
                salaId: null,
                dataHoraInicio: cursor.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId,
                agendamentoIdIgnorar,
            });

            if (result.ok) {
                debug(TOPIC, `      ${nome}: disponível ✓`);
                funcsDisponiveis.push(func);
            } else if (result.livreEm) {
                debug(TOPIC, `      ${nome}: ocupado até ${fmtH(new Date(result.livreEm))}`);
                // Cache: este funcionário está ocupado até result.livreEm — saltamos em
                // tentativas posteriores que comecem antes desse momento.
                bloqueiosFuncionario.set(func.id, result.livreEm);
            } else {
                debug(TOPIC, `      ${nome}: ocupado (sem data de libertação)`);
            }
        }

        if (funcsDisponiveis.length === 0) {
            debug(TOPIC, `    [${nomeServico}] sem funcionário disponível → slot descartado`);
            return null;
        }
        const funcEscolhido = funcsDisponiveis[0];
        debug(TOPIC, `    [${nomeServico}] funcionário escolhido: ${funcEscolhido.utilizador?.nome ?? funcEscolhido.id}`);

        // Sala anterior primeiro (animal não muda de sítio); depois salas especializadas
        // (menor capacidade) antes da polivalente — reserva a polivalente para último recurso.
        const salasOrdenadas = [...salas].sort((a, b) => {
            if (a.id === salaAnteriorId) return -1;
            if (b.id === salaAnteriorId) return 1;
            return a.capacidade - b.capacidade;
        });

        let salaEscolhida = null;
        for (const sala of salasOrdenadas) {
            const nomeSala = sala.nome ?? sala.id;

            const bloqueadaAte = bloqueiosSala.get(sala.id);
            if (bloqueadaAte && cursor < bloqueadaAte) {
                debug(TOPIC, `      sala ${nomeSala}: cache bloqueada até ${fmtH(bloqueadaAte)}`);
                continue;
            }

            const result = await verificarDisponibilidade({
                salaId: sala.id,
                funcionarioId: null,
                dataHoraInicio: cursor.toISOString(),
                dataHoraFim: fim.toISOString(),
                processInstanceId,
                agendamentoIdIgnorar,
                // Passamos a capacidade que já temos em memória para evitar uma query extra
                // dentro de verificarDisponibilidade.
                capacidade: sala.capacidade,
            });

            if (result.ok) {
                debug(TOPIC, `      sala ${nomeSala}: disponível ✓`);
                salaEscolhida = sala;
                break;
            }

            if (result.livreEm) {
                debug(TOPIC, `      sala ${nomeSala}: ocupada até ${fmtH(new Date(result.livreEm))}`);
                bloqueiosSala.set(sala.id, result.livreEm);
            } else {
                debug(TOPIC, `      sala ${nomeSala}: ocupada (sem data de libertação)`);
            }
        }

        if (!salaEscolhida) {
            debug(TOPIC, `    [${nomeServico}] sem sala disponível → slot descartado`);
            return null;
        }
        debug(TOPIC, `    [${nomeServico}] sala escolhida: ${salaEscolhida.nome ?? salaEscolhida.id}`);

        servicosSolucao.push({
            tipoServicoId: servico.tipoServicoId,
            nomeServico: servico.nomeServico ?? servico.nome ?? servico.tipoServicoId,
            duracaoMinutos: servico.duracaoMinutos,
            precoBase: servico.precoBase,
            funcionarioId: funcEscolhido.id,
            nomeFuncionario: funcEscolhido.utilizador?.nome ?? funcEscolhido.id,
            outrosDisponiveis: funcsDisponiveis.slice(1).map(f => ({
                id: f.id,
                nome: f.utilizador?.nome ?? f.id,
            })),
            salaId: salaEscolhida.id,
            nomeSala: salaEscolhida.nome ?? salaEscolhida.id,
            dataHoraInicio: cursor.toISOString(),
            dataHoraFim: fim.toISOString(),
        });

        // Avança para o próximo serviço. O cursor passa a ser o fim deste; o próximo serviço começa
        // exatamente quando este acaba (sem intervalos entre serviços).
        funcAnteriorId = funcEscolhido.id;
        salaAnteriorId = salaEscolhida.id;
        cursor = fim;
    }

    // Quantos funcionários diferentes a solução envolve. Usado depois para preferir soluções com
    // menos trocas de funcionário (melhor experiência para o cliente e o animal).
    const numFuncs = new Set(servicosSolucao.map((s) => s.funcionarioId)).size;

    return {
        dataHoraInicio: servicosSolucao[0].dataHoraInicio,
        dataHoraFim: servicosSolucao[servicosSolucao.length - 1].dataHoraFim,
        duracaoTotal: servicosSolucao.reduce((acc, s) => acc + s.duracaoMinutos, 0),
        valorTotal: servicosSolucao.reduce((acc, s) => acc + (Number(s.precoBase) || 0), 0),
        numFuncionariosDiferentes: numFuncs,
        servicos: servicosSolucao,
    };
}

/**
 * Entrada principal do scheduler. Procura até `maxOpcoes` soluções viáveis nos próximos
 * `diasParaProcurar` dias a partir de `dataPreferida`.
 *
 * Algoritmo em 3 fases (ordenação por critérios de negócio é delegada a `ordenarSolucoes`):
 *
 * 1. Carrega da BD os funcionários elegíveis (que cobrem o porte do animal e fazem pelo menos
 *    um dos tipos de serviço pedidos) e as salas elegíveis (ativas e que suportam pelo menos
 *    um dos tipos). Uma só query por entidade — o resto é filtragem em memória.
 *
 * 2. Constrói `recursosPorServico`: para cada serviço da lista, calcula o subconjunto de
 *    funcionários e salas que o conseguem fazer. Um funcionário pode aparecer só nalguns
 *    serviços (ex: alguém só faz BANHO mas não TOSQUIA_COMPLETA).
 *
 * 3. Para cada dia (até encontrar maxOpcoes):
 *    a. Constrói o conjunto de slots de início (múltiplos de 15 min):
 *       - Dia 1: a partir de max(início do turno, dataPreferida).
 *       - Dias seguintes: a partir do início do turno (sem restrição de hora).
 *       Granularidade de 15 min cobre a maioria dos casos sem explodir o número de tentativas.
 *    b. Por cada slot (ordenado): heurística `algumFuncCobre` (se ninguém trabalha até
 *       slot+duracaoTotal, break); senão `tentarConstruirSolucao` devolve solução ou null.
 *    c. Pára quando atinge maxOpcoes (no total, não por dia).
 *
 * Devolve as opções pela ordem cronológica em que foram geradas. A ordenação por critérios
 * de negócio (proximidade → menos funcionários diferentes → mais cedo) é responsabilidade
 * exclusiva de `ordenarSolucoes`, invocado no passo seguinte do BPMN (BP91).
 * O `funcionarioPreferido` é a primeira preferência dentro de `tentarConstruirSolucao`
 * (peso 0 no sort dos candidatos disponíveis — não é desempate, é prioridade máxima).
 *
 * Exemplo A (Mia, dataPreferida 29/04 17:00):
 *   - Dia 1 (29/04): slot mínimo = max(08:00, 17:00) = 17:00. Fim mínimo 19:10 > 19:00 (último
 *     turno) → algumFuncCobre = false → break. 29/04 descartado sem queries.
 *   - Dia 2 (30/04): slots a partir de 08:00. 08:00 e 08:15 falham (TOSQUIA cairia antes das
 *     09:00). 08:30 viável: Miguel faz BANHO 08:30–09:00, Sofia entra e faz o resto → 2 funcs.
 *     08:45 idem. 09:00 e 09:15: Sofia disponível desde o início, preferida → 1 func cada.
 *   - Resultado: 4 opções 08:30, 08:45, 09:00, 09:15 (ordem cronológica = proximidade).
 *
 * Exemplo B (Mia, dataPreferida 29/04 09:00):
 *   - Dia 1 (29/04): slot mínimo = max(08:00, 09:00) = 09:00. Sofia disponível desde 09:00 e
 *     preferida → faz todos os 4 serviços (1 func) em todas as soluções. 4 opções: 09:00,
 *     09:15, 09:30, 09:45. Não chega a tentar 30/04.
 *   - Todas com Sofia porque é preferida e disponível (se for o caso) desde o primeiro slot.
 *
 * @param {object} params
 * @param {Array<object>} params.servicosOrdenados - Serviços a agendar, já ordenados pela DMN. Cada um com tipoServicoId, duracaoMinutos, precoBase e nomeServico.
 * @param {string} params.porteAnimal - Porte do animal ('PEQUENO', 'MEDIO', etc.) — filtra os funcionários elegíveis.
 * @param {string} params.dataPreferida - ISO 8601. Âncora de proximidade: o scheduler privilegia soluções mais próximas deste momento.
 * @param {string|null} [params.funcionarioPreferido=null] - ID do funcionário preferido pelo cliente (opcional).
 * @param {string} params.processInstanceId - ID do processo Camunda activo.
 * @param {number} [params.diasParaProcurar=7] - Janela de pesquisa em dias a partir de dataPreferida.
 * @param {number} [params.maxOpcoes=4] - Número máximo de soluções a devolver.
 * @returns {Promise<{solucoes: object[], duracaoTotalMinutos: number}>} Lista de soluções ordenadas e duração total da primeira.
 */
async function gerarSolucoes({
    servicosOrdenados = [],
    porteAnimal,
    dataPreferida,
    funcionarioPreferido = null,
    processInstanceId,
    diasParaProcurar = 7,
    maxOpcoes = 4,
    agendamentoIdIgnorar = null,
}) {
    if (servicosOrdenados.length === 0) throw new Error('Pelo menos um serviço é necessário');
    if (!porteAnimal) throw new Error('porteAnimal é obrigatório');
    if (!dataPreferida) throw new Error('dataPreferida é obrigatório');
    if (!processInstanceId) throw new Error('processInstanceId é obrigatório');

    const tiposNecessarios = servicosOrdenados.map((s) => s.tipoServicoId);

    // Funcionários candidatos: cobrem o porte e fazem pelo menos um dos tipos pedidos.
    // O filtro fino (que tipos cada um faz) é depois aplicado em memória, em recursosPorServico.
    const todosOsFuncionarios = await prisma.funcionario.findMany({
        where: {
            porteAnimais: { has: porteAnimal },
            funcionarioServico: { some: { tipoServicoId: { in: tiposNecessarios } } },
        },
        include: {
            utilizador: { select: { nome: true } },
            horariosTrabalho: { where: { ativo: true } },
            funcionarioServico: { select: { tipoServicoId: true } },
        },
    });

    // Salas candidatas: ativas e que suportam pelo menos um dos tipos.
    const todasAsSalas = await prisma.sala.findMany({
        where: {
            ativo: true,
            salasServico: { some: { tipoServicoId: { in: tiposNecessarios } } },
        },
        include: {
            salasServico: { select: { tipoServicoId: true } },
        },
    });

    // Para cada serviço, calcula o subconjunto de funcionários e salas que efectivamente o cobrem.
    const recursosPorServico = servicosOrdenados.map((servico) => ({
        servico,
        funcionarios: todosOsFuncionarios.filter((f) =>
            f.funcionarioServico.some((fs) => fs.tipoServicoId === servico.tipoServicoId)
        ),
        salas: todasAsSalas.filter((s) =>
            s.salasServico.some((ss) => ss.tipoServicoId === servico.tipoServicoId)
        ),
    }));

    debug(TOPIC, `Funcionários elegíveis (${todosOsFuncionarios.length}): ${todosOsFuncionarios.map((f) => f.utilizador?.nome ?? f.id).join(', ')}`);
    debug(TOPIC, `Salas elegíveis (${todasAsSalas.length}): ${todasAsSalas.map((s) => s.nome ?? s.id).join(', ')}`);
    for (const { servico, funcionarios, salas } of recursosPorServico) {
        debug(TOPIC, `  ${servico.nomeServico ?? servico.nome ?? servico.tipoServicoId}: funcs=[${funcionarios.map((f) => f.utilizador?.nome ?? f.id).join(', ')}] salas=[${salas.map((s) => s.nome ?? s.id).join(', ')}]`);
    }

    const duracaoTotalMinutos = servicosOrdenados.reduce((sum, s) => sum + s.duracaoMinutos, 0);

    const opcoes = [];
    const dataBase = new Date(dataPreferida);

    for (let dia = 0; dia < diasParaProcurar && opcoes.length < maxOpcoes; dia++) {
        const dataDoDia = addDays(startOfDay(dataBase), dia);
        const diaSemana = getDiaSemana(dataDoDia);

        // Heurística de exclusão precoce do dia: se algum serviço da lista não tem
        // nenhum funcionário elegível a trabalhar neste dia (todos os candidatos de
        // folga), é impossível construir solução em qualquer slot — descartamos o
        // dia inteiro sem construir slots nem fazer queries.
        // Exemplo: TOSQUIA_COMPLETA só é feita por Sofia e Tiago; ambos de folga na
        // segunda → segunda inteira descartada aqui em vez de tentar N slots em vão.
        const servicoSemFuncs = recursosPorServico.find(({ funcionarios }) =>
            !funcionarios.some((f) =>
                f.horariosTrabalho.some((h) => h.diasSemana.includes(diaSemana))
            )
        );
        if (servicoSemFuncs) {
            const nomeServ = servicoSemFuncs.servico.nomeServico
                ?? servicoSemFuncs.servico.nome
                ?? servicoSemFuncs.servico.tipoServicoId;
            log(TOPIC, `── Dia ${dia + 1}/${diasParaProcurar}: ${dataDoDia.toISOString().slice(0, 10)} (${diaSemana}) — descartado: nenhum funcionário elegível para "${nomeServ}" trabalha neste dia`, 'info');
            continue;
        }

        // Caches reiniciados por dia: a disponibilidade muda quando muda o dia.
        const bloqueiosFuncionario = new Map();
        const bloqueiosSala = new Map();

        // Conjunto de instantes possíveis de início para este dia (15 em 15 min, dentro dos turnos
        // de qualquer funcionário elegível). Set evita duplicados quando vários funcionários têm
        // turnos sobrepostos.
        const slotsInicio = new Set();
        for (const { funcionarios } of recursosPorServico) {
            for (const func of funcionarios) {
                for (const h of func.horariosTrabalho) {
                    if (!h.diasSemana.includes(diaSemana)) continue;

                    const inicioTurno = combinarDataHora(dataDoDia, h.horaInicio);

                    // No 1º dia, não procurar slots ANTES da hora preferida do utilizador
                    // (não faz sentido oferecer 09:00 quando ele pediu 14:00). Consequência:
                    // se a hora preferida for cedo (ex: 09:00 e há turno desde 08:00), slots
                    // anteriores como 08:30 nunca são tentados — mesmo que fossem viáveis.
                    // Nos dias seguintes, a hora preferida deixa de ser limite mínimo: começa
                    // sempre no início do turno.
                    const horaMin = dia === 0
                        ? new Date(Math.max(inicioTurno.getTime(), dataBase.getTime()))
                        : inicioTurno;

                    // Arredondar para o próximo múltiplo de GRANULARIDADE_SLOT_MIN —
                    // com o default (15), slots ficam em :00, :15, :30, :45.
                    const minutos = horaMin.getUTCMinutes();
                    const resto = minutos % GRANULARIDADE_SLOT_MIN;
                    const cursor = resto === 0
                        ? new Date(horaMin)
                        : addMinutes(horaMin, GRANULARIDADE_SLOT_MIN - resto);

                    const fimTurno = combinarDataHora(dataDoDia, h.horaFim);

                    let t = new Date(cursor);
                    while (t < fimTurno) {
                        slotsInicio.add(t.toISOString());
                        t = addMinutes(t, GRANULARIDADE_SLOT_MIN);
                    }
                }
            }
        }

        log(TOPIC, `── Dia ${dia + 1}/${diasParaProcurar}: ${dataDoDia.toISOString().slice(0, 10)} (${diaSemana}) — ${slotsInicio.size} slot(s) a tentar`, 'info');

        // Tenta cada slot por ordem cronológica até encontrar maxOpcoes (no total).
        for (const slotStr of [...slotsInicio].sort()) {
            if (opcoes.length >= maxOpcoes) break;

            const slotInicio = new Date(slotStr);
            const fimMinimo = addMinutes(slotInicio, duracaoTotalMinutos);

            // Descarta o slot se nenhum funcionário trabalha até ao fim mínimo possível.
            // É uma verificação heurística (qualquer funcionário elegível, não o específico
            // de cada serviço): se ninguém cobre até fimMinimo, nenhum slot deste ponto em
            // diante pode funcionar (os seguintes começam ainda mais tarde) → break.
            // Exemplo (Mia, 29/04): slot 17:00 + 130min = fim mínimo 19:10; o funcionário
            // mais tardio termina às 19:00 → algumFuncCobre = false → break imediato.
            // 29/04 inteiro descartado sem uma única query à BD; scheduler avança para 30/04.
            const algumFuncCobre = todosOsFuncionarios.some(f =>
                f.horariosTrabalho.some(h => {
                    if (!h.diasSemana.includes(diaSemana)) return false;
                    return fimMinimo <= combinarDataHora(dataDoDia, h.horaFim);
                })
            );
            if (!algumFuncCobre) {
                debug(TOPIC, `  slot ${fmtH(slotInicio)}: fim mínimo ${fmtH(fimMinimo)} excede todos os turnos — restantes slots do dia descartados`);
                break;
            }

            debug(TOPIC, `  slot ${fmtH(slotInicio)}`);

            const solucao = await tentarConstruirSolucao(
                recursosPorServico,
                dataDoDia,
                slotInicio,
                funcionarioPreferido,
                processInstanceId,
                bloqueiosFuncionario,
                bloqueiosSala,
                agendamentoIdIgnorar
            );

            if (solucao) {
                log(TOPIC, `  ✓ opção ${opcoes.length + 1}: ${fmtH(new Date(solucao.dataHoraInicio))}–${fmtH(new Date(solucao.dataHoraFim))} (${solucao.numFuncionariosDiferentes} func(s))`, 'success');
                opcoes.push(solucao);
            }
        }
    }

    // Ordenação por critérios de negócio é responsabilidade exclusiva de `ordenarSolucoes`
    // (executado a seguir no BPMN, BP91 → topic ordenar-solucoes). Aqui devolvemos as
    // opções pela ordem em que foram geradas (cronológica natural do scheduler), que
    // empiricamente já equivale à ordem por proximidade na maioria dos casos.

    log(TOPIC, `✓ ${opcoes.length} opção(ões) gerada(s)`, 'success');
    return { solucoes: opcoes, duracaoTotalMinutos: opcoes[0]?.duracaoTotal ?? 0 };
}

/**
 * Reordena uma lista de soluções já existente (sem reconstruir nada). Usado pelo worker
 * `ordenar-solucoes`, que corre depois de gerar-solucoes para garantir que a primeira opção
 * apresentada ao funcionário é a "melhor" segundo os mesmos critérios da geração:
 *   1. Proximidade à dataPreferida (a mais próxima primeiro).
 *   2. Menos funcionários diferentes envolvidos (continuidade para o cliente/animal).
 *   3. Mais cedo na cronologia, em caso de empate.
 * @param {object[]} solucoes - Lista de soluções geradas por gerarSolucoes.
 * @param {string} dataPreferida - ISO 8601. Ponto de referência para calcular proximidade.
 * @returns {object[]} Nova lista ordenada (não muta o array original).
 */
function ordenarSolucoes(solucoes, dataPreferida) {
    const dataBase = new Date(dataPreferida);
    return [...solucoes].sort((a, b) => {
        const diffA = Math.abs(new Date(a.dataHoraInicio) - dataBase);
        const diffB = Math.abs(new Date(b.dataHoraInicio) - dataBase);
        if (diffA !== diffB) return diffA - diffB;

        const funcA = new Set((a.servicos || []).map((s) => s.funcionarioId)).size;
        const funcB = new Set((b.servicos || []).map((s) => s.funcionarioId)).size;
        if (funcA !== funcB) return funcA - funcB;

        return new Date(a.dataHoraInicio) - new Date(b.dataHoraInicio);
    });
}

module.exports = { gerarSolucoes, ordenarSolucoes };