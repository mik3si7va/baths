const { libertarReservasPorIds, libertarReservas } = require('../../services/reservas');

// Handler partilhado entre libertar-reservas-opcao e libertar-reservas-processo.
async function libertarPorIdsDaTask(task) {
    /* Alternativa: libertar todas as reservas do processo
       await libertarReservas(task.processInstanceId);
    */
    const raw = task.variables.get('reservasTemporariasIds');
    const ids = raw ? JSON.parse(raw) : [];
    await libertarReservasPorIds(ids);
}

// Detecta o índice da opção atualmente escolhida (número ou string numérica).
// Se a opcaoSelecionada for um objeto (escolha por payload, raro), devolve -1.
function detectarIndiceAtual(task) {
    const raw = task.variables.get('opcaoSelecionada');
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && !isNaN(raw)) return Number(raw);
    return -1;
}

module.exports = { libertarPorIdsDaTask, detectarIndiceAtual };