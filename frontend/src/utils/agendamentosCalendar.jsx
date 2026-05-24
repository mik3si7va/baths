import React from 'react';
import { Box, Typography } from '@mui/material';

// US - BET-37: lógica partilhada do calendário de agendamentos.
// Usado por:
//   - pages/calendar/calendar.jsx       (agenda geral)
//   - pages/salas/salaDetalhes.jsx      (agendamentos por sala)

// ajustes:
// Estados que aparecem na agenda. CANCELADO e NAO_COMPARECEU são excluídos por defeito - o slot fica imediatamente livre quando o estado muda.
// Para mostrar também cancelados/não comparência (auditoria): incluir 'CANCELADO', 'NAO_COMPARECEU' 
// e adicionar uma entrada em COR_POR_ESTADO (senão cai no fallback de CONFIRMADO em mapAgendamentosToEvents).
export const ESTADOS_VISIVEIS = ['CONFIRMADO', 'EM_ATENDIMENTO', 'CONCLUIDO'];

// ajustes:
// Cor de fundo (bg) + borda por estado do agendamento.
// Paleta alinhada com o verde B&T usado no header/calendario.
// Mudar afecta blocos no calendário E chips em ListaAgendamentos.
export const COR_POR_ESTADO = {
    CONFIRMADO: { bg: '#475C51', border: '#32433b', text: '#ffffff' },
    EM_ATENDIMENTO: { bg: '#6f7f73', border: '#475C51', text: '#ffffff' },
    CONCLUIDO: { bg: '#2f6b4f', border: '#24523d', text: '#ffffff' },
};

// Formata uma Date como HH:MM em UTC (consistente com cross-env TZ=UTC do backend).
export function fmtHoraUTC(d) {
    if (!d) return '';
    const data = d instanceof Date ? d : new Date(d);
    const h = String(data.getUTCHours()).padStart(2, '0');
    const m = String(data.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

// Formata data+hora como DD/MM/YYYY HH:MM em UTC.
export function fmtDataHoraUTC(d) {
    if (!d) return '';
    const data = d instanceof Date ? d : new Date(d);
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = data.getUTCFullYear();
    return `${dia}/${mes}/${ano} ${fmtHoraUTC(data)}`;
}

// Converte uma lista de agendamentos (da API) numa lista de eventos do FullCalendar.
// Cada AgendamentoServico gera um evento - assim os filtros por funcionário/sala mostram apenas os blocos relevantes.
// Agendamentos cancelados ou com não-comparência são excluídos (o horário fica livre nesses estados).
export function mapAgendamentosToEvents(agendamentos) {
    const visiveis = (Array.isArray(agendamentos) ? agendamentos : [])
        .filter((ag) => ESTADOS_VISIVEIS.includes(ag.estado));

    return visiveis.flatMap((ag) =>
        (ag.servicos || []).map((s) => {
            const cor = COR_POR_ESTADO[ag.estado] ?? COR_POR_ESTADO.CONFIRMADO;
            return {
                id: s.id,
                title: s.tipoServico?.tipo ?? 'Serviço',
                start: s.dataHoraInicio,
                end: s.dataHoraFim,
                backgroundColor: cor.bg,
                borderColor: cor.border,
                textColor: cor.text,
                extendedProps: {
                    agendamentoId: ag.id,
                    estado: ag.estado,
                    animal: ag.animal?.nome ?? null,
                    cliente: ag.animal?.cliente?.utilizador?.nome ?? null,
                    clienteTelefone: ag.animal?.cliente?.telefone ?? null,
                    funcionario: s.funcionario?.utilizador?.nome ?? null,
                    sala: s.sala?.nome ?? null,
                    tipoServico: s.tipoServico?.tipo ?? null,
                    precoNoMomento: Number(s.precoNoMomento ?? 0),
                    duracaoNoMomento: s.duracaoNoMomento ?? null,
                },
            };
        })
    );
}

// Render custom de cada bloco do calendário - passar a `<CalendarView eventContent={...} />`.
// FullCalendar chama esta função para cada evento; arg.event tem start/end/extendedProps.
export function renderBloco(arg) {
    // Eventos de fundo (ex: hora de almoço) usam o rendering padrão do FullCalendar.
    if (arg.event.display === 'background') return null;

    const ev = arg.event;
    const hora = fmtHoraUTC(ev.start);
    const animal = ev.extendedProps.animal ?? '';
    const funcionario = ev.extendedProps.funcionario ?? '';

    return (
        <Box sx={{
            color: '#fff',
            p: '2px 6px',
            overflow: 'hidden',
            lineHeight: 1.15,
        }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                {hora} · {animal}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', opacity: 0.92 }}>
                {funcionario}
            </Typography>
        </Box>
    );
}
