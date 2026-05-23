// Utilitário de timestamps gerados no servidor.
// O projeto usa convenção "naive UTC" - wall-clock de Lisboa empacotada como  Date UTC, sem conversão real de fuso.
// Coerente com os timestamps de input do utilizador (agendamento.dataHoraInicio, etc.), que também são naive.
//
// Usado por: faturacao.js (dataEmissao, pagoEm), agendamentos.js (checkIn/checkOut, dataResumo).
// Funciona independentemente do TZ do processo Node - usa `Intl`que tem as zonas embutidas.

// ajustes: fuso de referência para os timestamps gerados pelo servidor.
// Ex.: clínica em Madrid, mudar para 'Europe/Madrid'.
const TZ_REFERENCIA = 'Europe/Lisbon';

function agoraNaiveLisboa() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ_REFERENCIA,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const get = (t) => partes.find(p => p.type === t).value;
    return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.000Z`);
}

module.exports = { agoraNaiveLisboa };
