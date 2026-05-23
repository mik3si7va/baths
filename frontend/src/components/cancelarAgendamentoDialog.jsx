import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Alert, Box, Stack,
} from '@mui/material';
import { fmtDataHoraUTC } from '../utils/agendamentosCalendar';
import { arrancarGestao, completarCadeia, aguardarFimGestao } from '../utils/camundaWizard';

// US - BET-36: cancelar agendamento existente.
//
// Fluxo Camunda (gestao_agendamento.bpmn, ramo CANCELAR):
//   1. POST /agendamentos/:id/processos/gestao → arranca instância
//   2. Completar TASK_ABRIR_AGENDAMENTO com { accaoFuncionario: 'CANCELAR' }
//   3. Completar TASK_REGISTAR_CANCELAMENTO com {} - confirmação consciente da acção irreversível, sem dados a passar ao fluxo.
//   4. BPMN segue sozinho: estado=CANCELADO (via inputParameter), email.

// IDs das user tasks do gestao_agendamento.bpmn. Coincidem com os `taskDefinitionKey` no Camunda Modeler - alterar aqui requer renomear também no BPMN.
const TASK_ABRIR_AGENDAMENTO = 'BP161';
const TASK_REGISTAR_CANCELAMENTO = 'BP164';

export default function CancelarAgendamentoDialog({ agendamento, open, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const fechar = () => {
        if (loading) return;
        setErro('');
        onClose();
    };

    const confirmar = async () => {
        if (!agendamento?.agendamentoId) {
            setErro('Agendamento sem identificador.');
            return;
        }
        setErro('');
        setLoading(true);
        try {
            const procId = await arrancarGestao(agendamento.agendamentoId);
            await completarCadeia(procId, [
                { chaveTarefa: TASK_ABRIR_AGENDAMENTO, variaveis: { accaoFuncionario: 'CANCELAR' } },
                { chaveTarefa: TASK_REGISTAR_CANCELAMENTO, variaveis: {} },
            ]);
            // Esperar pelo fim do processo: depois do "Registar cancelamento" o BPMN ainda corre o service task BP196 (estado=CANCELADO) e envio de email.
            // Sem este wait, o re-fetch apanha o estado anterior.
            await aguardarFimGestao(agendamento.agendamentoId);
            onSuccess?.();
            onClose();
        } catch (e) {
            setErro(e.message || 'Falha ao cancelar agendamento.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={fechar} maxWidth="sm" fullWidth>
            <DialogTitle>Cancelar agendamento</DialogTitle>
            <DialogContent dividers>
                {agendamento && (
                    <Stack spacing={2}>
                        <Alert severity="warning">
                            O agendamento será cancelado. Não é reversível.
                        </Alert>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Agendamento</Typography>
                            <Typography>
                                {agendamento.animal} - {agendamento.tipoServico}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {fmtDataHoraUTC(agendamento.inicio)}
                            </Typography>
                        </Box>
                        {erro && <Alert severity="error">{erro}</Alert>}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={fechar} disabled={loading}>
                    Voltar
                </Button>
                <Button
                    onClick={confirmar}
                    color="error"
                    variant="contained"
                    disabled={loading}
                >
                    {loading ? 'A cancelar...' : 'Confirmar cancelamento'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
