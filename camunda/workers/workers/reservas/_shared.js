const { libertarReservasPorIds, libertarReservas, limparReservasExpiradas } = require('../../services/reservas');

// Handler de libertar-reservas-processo (rollback): lê os ids das reservas
// guardados na variável `reservasTemporariasIds` e apaga-as.
async function libertarPorIdsDaTask(task) {
    const raw = task.variables.get('reservasTemporariasIds');
    const ids = raw ? JSON.parse(raw) : [];
    await libertarReservasPorIds(ids);
}

// Handler de libertar-reservas-temporarias (commit): apaga as reservas temporárias que
// foram convertidas em AgendamentoServico definitivos (BP143/BP212 já correram).
// Difere de libertarPorIdsDaTask em dois pontos:
//   1. Fallback se `reservasTemporariasIds` estiver vazio — apaga por
//      processInstanceId para garantir que não ficam órfãs após o commit.
//      Usa-se `subProcessInstanceId` (guardado quando as reservas foram criadas
//      no sub_gerar_selecionar_opcao) porque `task.processInstanceId` aqui
//      aponta ao processo principal e não apanharia as reservas do sub.
//   2. Corre `limparReservasExpiradas()` no fim como housekeeping global.
async function limparReservasAposCommit(task) {
    const raw = task.variables.get('reservasTemporariasIds');
    const ids = raw ? JSON.parse(raw) : [];
    if (ids.length > 0) {
        await libertarReservasPorIds(ids);
    } else {
        const subId = task.variables.get('subProcessInstanceId');
        await libertarReservas(subId || task.processInstanceId);
    }
    await limparReservasExpiradas();
}

module.exports = { libertarPorIdsDaTask, limparReservasAposCommit };