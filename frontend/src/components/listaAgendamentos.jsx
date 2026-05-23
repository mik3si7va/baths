import React, { useMemo } from 'react';
import { Box, Paper, Typography, Chip, Button, Stack, Divider } from '@mui/material';
import { fmtDataHoraUTC, COR_POR_ESTADO } from '../utils/agendamentosCalendar';

// US - BET-35/BET-36/BET-37/BET-43: lista de agendamentos para mostrar abaixo de um calendário (calendar.jsx, salaDetalhes.jsx).
// Acompanha a view actual do FullCalendar via prop `intervalo` (start/end vindos do datesSet).
//
// Botões por estado:
//   CONFIRMADO -> Reagendar · Não compareceu · Cancelar
//   CONCLUIDO  -> Pagamento (se sem fatura) · Fatura (se já há fatura emitida)
//
// Props:
//   agendamentos        {Array}    - raw da API (com .id, .estado, .fatura, ...)
//   intervalo           {object?}  - { start: Date, end: Date } do FullCalendar; se null, mostra todos
//   titulo              {string?}  - título do bloco
//   onReagendar         {function?} - botão Reagendar (CONFIRMADO)
//   onCancelar          {function?} - botão Cancelar (CONFIRMADO)
//   onNaoCompareceu     {function?} - botão Não Compareceu (CONFIRMADO)
//   onReceberPagamento  {function?} - botão Pagamento (CONCLUIDO sem fatura)
//   onVerFatura         {function?} - botão Fatura (CONCLUIDO com fatura)

const ESTADOS_EDITAVEIS = ['CONFIRMADO'];

// Constrói um shape compatível com AgendamentoDialog e os outros dialogs (esperam `agendamentoId`, `animal`, `tipoServico`, `inicio`, `estado`).
function vistaAgendamento(ag) {
    const primeiroServico = ag.servicos?.[0];
    const nomesServicos = (ag.servicos || [])
        .map((s) => s.tipoServico?.tipo)
        .filter(Boolean)
        .join(', ');
    return {
        agendamentoId: ag.id,
        animal: ag.animal?.nome ?? '-',
        tipoServico: nomesServicos || primeiroServico?.tipoServico?.tipo || '-',
        inicio: ag.dataHoraInicio,
        estado: ag.estado,
        faturaId: ag.fatura?.id ?? null,
        faturaNumero: ag.fatura?.numero ?? null,
    };
}

export default function ListaAgendamentos({
    agendamentos = [],
    intervalo = null,
    titulo = 'Lista de agendamentos',
    onReagendar,
    onCancelar,
    onNaoCompareceu,
    onReceberPagamento,
    onVerFatura,
}) {
    const filtrados = useMemo(() => {
        const todos = Array.isArray(agendamentos) ? agendamentos : [];
        const dentroDoIntervalo = intervalo
            ? todos.filter((ag) => {
                const d = new Date(ag.dataHoraInicio);
                return d >= intervalo.start && d < intervalo.end;
            })
            : todos;
        return [...dentroDoIntervalo].sort(
            (a, b) => new Date(a.dataHoraInicio) - new Date(b.dataHoraInicio)
        );
    }, [agendamentos, intervalo]);

    return (
        <Paper elevation={2} sx={{ p: 3, mt: 3, borderRadius: 3 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>
                {titulo}
            </Typography>

            {filtrados.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Sem agendamentos neste período.
                </Typography>
            ) : (
                <Stack divider={<Divider />} spacing={1.5}>
                    {filtrados.map((ag) => {
                        const cor = COR_POR_ESTADO[ag.estado];
                        const podeAlterar = ESTADOS_EDITAVEIS.includes(ag.estado);
                        const vista = vistaAgendamento(ag);
                        // CONCLUIDO sem fatura -> pagamento por receber.
                        // CONCLUIDO com fatura -> já está paga (na ordem actual do BPMN,
                        // BP184/BP185 correm antes de BP183, logo fatura só existe se pago).
                        const podeReceberPagamento = ag.estado === 'CONCLUIDO' && !vista.faturaId;
                        const temFatura = vista.faturaId !== null;
                        return (
                            <Box
                                key={ag.id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    flexWrap: 'wrap',
                                }}
                            >
                                <Box sx={{ flex: 1, minWidth: 220 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {fmtDataHoraUTC(ag.dataHoraInicio)} - {vista.animal}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: 'block' }}
                                    >
                                        {vista.tipoServico}
                                    </Typography>
                                </Box>
                                <Chip
                                    label={ag.estado}
                                    size="small"
                                    sx={{
                                        bgcolor: cor?.bg ?? 'grey.300',
                                        color: cor ? '#fff' : 'text.primary',
                                        fontWeight: 700,
                                    }}
                                />
                                {podeAlterar && onReagendar && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => onReagendar(vista)}
                                    >
                                        Reagendar
                                    </Button>
                                )}
                                {podeAlterar && onNaoCompareceu && (
                                    <Button
                                        size="small"
                                        color="warning"
                                        variant="outlined"
                                        onClick={() => onNaoCompareceu(vista)}
                                    >
                                        Não compareceu
                                    </Button>
                                )}
                                {podeAlterar && onCancelar && (
                                    <Button
                                        size="small"
                                        color="error"
                                        variant="contained"
                                        onClick={() => onCancelar(vista)}
                                    >
                                        Cancelar
                                    </Button>
                                )}
                                {podeReceberPagamento && onReceberPagamento && (
                                    <Button
                                        size="small"
                                        color="success"
                                        variant="contained"
                                        onClick={() => onReceberPagamento(vista)}
                                    >
                                        Pagamento
                                    </Button>
                                )}
                                {temFatura && onVerFatura && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => onVerFatura(vista)}
                                    >
                                        Fatura
                                    </Button>
                                )}
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Paper>
    );
}
