import React, { useState } from 'react';
import {
    Box, Typography, Dialog, DialogTitle, DialogContent,
    DialogActions, Button, Stack, Chip, Alert, CircularProgress,
} from '@mui/material';
import { fmtDataHoraUTC, fmtHoraUTC } from '../utils/agendamentosCalendar';
import { arrancarGestao, getProcessoGestaoActual, completarCadeia, aguardarTarefa } from '../utils/camundaWizard';

// US - BET-37: dialog reutilizável com o detalhe completo de um agendamento.
// US (check-in/check-out): handlers internos por estado, fluxo ATENDER do gestao_agendamento.bpmn. Acções aparecem condicionalmente ao estado actual:
//   CONFIRMADO     -> Check-in
//   EM_ATENDIMENTO -> Check-out
//
// Reagendar/Cancelar/Pagamento/Fatura não vivem aqui - estão na ListaAgendamentos para evitar dialogs com vários botões e fluxos sobrepostos.
//
// Props:
//  agendamento  {object|null} - shape do calendar (com agendamentoId em extendedProps).
//  onClose      {function}    - callback do botão Fechar e backdrop.
//  onSuccess    {function?}   - chamado após Check-in/Check-out (parent re-fetch).

// ajustes: IDs das user tasks do gestao_agendamento.bpmn que este dialog dispara.
// Se algum ID mudar no BPMN, basta editar aqui.
const TASK_ABRIR_AGENDAMENTO = 'BP161';      // entry: escolhe o caminho via accaoFuncionario
const TASK_CHECK_IN = 'BP163';
const TASK_CHECK_OUT = 'BP178';
const TASK_INICIO_SUB_FATURAR = 'BP56_sub3'; // primeira user task do sub_faturar (após check-out)

export default function AgendamentoDialog({
    agendamento, onClose, onSuccess,
}) {
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const estado = agendamento?.estado;
    const podeCheckIn = estado === 'CONFIRMADO';
    const podeCheckOut = estado === 'EM_ATENDIMENTO';

    const fechar = () => {
        if (loading) return;
        setErro('');
        onClose();
    };

    const fazerCheckIn = async () => {
        if (!agendamento?.agendamentoId) {
            setErro('Agendamento sem identificador.');
            return;
        }
        setErro('');
        setLoading(true);
        try {
            const procId = await arrancarGestao(agendamento.agendamentoId);
            await completarCadeia(procId, [
                { chaveTarefa: TASK_ABRIR_AGENDAMENTO, variaveis: { accaoFuncionario: 'ATENDER' } },
                { chaveTarefa: TASK_CHECK_IN, variaveis: { checkIn: true } },
            ]);
            // Após o check-in, o worker BP169 actualiza o estado para EM_ATENDIMENTO.
            // Aguardar a próxima user task (check-out) garante que o worker já correu antes de fazer re-fetch.
            await aguardarTarefa(procId, TASK_CHECK_OUT);
            onSuccess?.();
            onClose();
        } catch (e) {
            setErro(e.message || 'Falha ao registar check-in.');
        } finally {
            setLoading(false);
        }
    };

    const fazerCheckOut = async () => {
        if (!agendamento?.agendamentoId) {
            setErro('Agendamento sem identificador.');
            return;
        }
        setErro('');
        setLoading(true);
        try {
            const procId = await getProcessoGestaoActual(agendamento.agendamentoId);
            if (!procId) throw new Error('Nenhum processo ATENDER activo para este agendamento.');
            await completarCadeia(procId, [
                { chaveTarefa: TASK_CHECK_OUT, variaveis: { checkOut: true } },
            ]);
            // Após o check-out, o worker BP179 actualiza o estado para CONCLUIDO e o BPMN entra no sub_faturar_servicos.
            // A próxima user task vive dentro do sub (não no parent - antes era BP184).
            // Aguardamos por ela para garantir que o estado já está em CONCLUIDO antes do re-fetch.
            await aguardarTarefa(procId, TASK_INICIO_SUB_FATURAR);
            onSuccess?.();
            onClose();
        } catch (e) {
            setErro(e.message || 'Falha ao registar check-out.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={agendamento !== null}
            onClose={fechar}
            maxWidth="sm"
            fullWidth
        >
            {agendamento && (
                <>
                    <DialogTitle>
                        {agendamento.animal} - {agendamento.tipoServico}
                    </DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={1.5}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Estado</Typography>
                                <Box><Chip label={estado} size="small" /></Box>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Horário</Typography>
                                <Typography>
                                    {fmtDataHoraUTC(agendamento.inicio)} → {fmtHoraUTC(agendamento.fim)}
                                    {agendamento.duracaoNoMomento && ` (${agendamento.duracaoNoMomento} min)`}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Sala</Typography>
                                <Typography>{agendamento.sala ?? '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Funcionário</Typography>
                                <Typography>{agendamento.funcionario ?? '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Dono do animal</Typography>
                                <Typography>{agendamento.cliente ?? '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Telefone</Typography>
                                <Typography>{agendamento.clienteTelefone ?? '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Preço</Typography>
                                <Typography>{agendamento.precoNoMomento?.toFixed(2)} €</Typography>
                            </Box>
                            {erro && <Alert severity="error">{erro}</Alert>}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={fechar} disabled={loading}>Fechar</Button>
                        {podeCheckIn && (
                            <Button
                                onClick={fazerCheckIn}
                                variant="contained"
                                color="primary"
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={16} /> : null}
                            >
                                Check-in
                            </Button>
                        )}
                        {podeCheckOut && (
                            <Button
                                onClick={fazerCheckOut}
                                variant="contained"
                                color="primary"
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={16} /> : null}
                            >
                                Check-out
                            </Button>
                        )}
                    </DialogActions>
                </>
            )}
        </Dialog>
    );
}
