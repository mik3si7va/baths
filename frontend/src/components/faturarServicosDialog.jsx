import React, { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { aguardarTarefa, completarTarefa, getProcessoGestaoActual, getVariaveis } from '../utils/camundaWizard';

// US sub_faturar_servicos: gere as user tasks BP56_sub3 (confirmar/alterar serviços),
// BP58_sub3 (seleccionar serviço a adicionar) e Activity_1fxujz7_sub3 (seleccionar serviço a remover) do sub-processo `sub_faturar_servicos`.
//
// Abre-se entre check-out e o pagamento - equivalente operacional a "o funcionário confirma os serviços realmente prestados antes da fatura sair".

// ajustes: IDs das user tasks do sub_faturar_servicos do agendamento.bpmn.
// Se algum ID mudar no BPMN, basta editar esta lista (zero alterações na lógica).
const TASK_CONFIRMAR = 'BP56_sub3';
const TASK_SELECIONAR_ADICIONAR = 'BP58_sub3';
const TASK_SELECIONAR_REMOVER = 'Activity_1fxujz7_sub3';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Parse defensivo: a variável Camunda chega como string JSON na maioria dos casos,
// mas pode chegar já como array em algumas configurações. Aceitamos ambos.
function parseServicos(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
}

export default function FaturarServicosDialog({ open, agendamento, onClose, onConfirmado }) {
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [servicos, setServicos] = useState([]);
    const [carregandoLista, setCarregandoLista] = useState(false);
    const [tiposServico, setTiposServico] = useState([]);
    const [tipoServicoAdicionar, setTipoServicoAdicionar] = useState('');

    // Catálogo de tipos de serviço para o select de adicionar.
    // Carregado uma vez quando o dialog abre.
    // O backend faz a filtragem por porte no worker `obter-preco-duracao`, por isso aqui mostramos tudo - se o porte não tiver regra de preço,
    // o BPMN cai no notificador de erro do gateway BP79_sub3 (Operação bem sucedida?).
    useEffect(() => {
        if (!open) return;
        let cancelado = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/servicos`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelado) setTiposServico(Array.isArray(data) ? data : []);
            } catch { /* ignora - sem catálogo, o select fica vazio */ }
        })();
        return () => { cancelado = true; };
    }, [open]);

    // Quando o dialog abre, lê os serviços actuais do processo Camunda.
    // A var `servicosActualizados` é populada pelo worker `carregar-dados-agendamento` logo no início do gestao_agendamento (BP206),
    // e mantida pelos workers de adicionar/remover/calcular ao longo do sub_faturar_servicos.
    useEffect(() => {
        if (!open || !agendamento?.agendamentoId) {
            setServicos([]);
            return;
        }
        let cancelado = false;
        (async () => {
            setErro('');
            setCarregandoLista(true);
            try {
                const procId = await getProcessoGestaoActual(agendamento.agendamentoId);
                if (!procId) throw new Error('Nenhum processo de atendimento activo.');
                const vars = await getVariaveis(procId);
                if (cancelado) return;
                setServicos(parseServicos(vars?.servicosActualizados));
            } catch (e) {
                if (!cancelado) setErro(e.message || 'Falha ao carregar serviços.');
            } finally {
                if (!cancelado) setCarregandoLista(false);
            }
        })();
        return () => { cancelado = true; };
    }, [open, agendamento?.agendamentoId]);

    const fechar = () => {
        if (loading) return;
        setErro('');
        onClose();
    };

    // Recarrega a lista do processo.
    // Usado depois de cada add/remove para reflectir o estado actualizado de `servicosActualizados` no Camunda.
    const recarregarLista = async (procId) => {
        const vars = await getVariaveis(procId);
        setServicos(parseServicos(vars?.servicosActualizados));
    };

    // Adiciona um serviço: completa BP56_sub3 com `adicionarServico=true` -> BPMN abre BP58_sub3 para identificar QUAL -> completa-a com o tipoServicoId.
    // Os workers `obter-preco-duracao` e `adicionar-servico-lista` correm e o BPMN volta a BP56_sub3.
    const adicionarServico = async () => {
        if (!agendamento?.agendamentoId || !tipoServicoAdicionar) return;
        const tipoId = tipoServicoAdicionar;
        // Resolver nome do tipo a partir do catálogo carregado - passamos em servicoTemp.nomeServico para o worker `adicionar-servico-lista`
        // poder gravar o nome na lista (em vez de cair no fallback "Serviço").
        const tipoEscolhido = tiposServico.find((t) => t.id === tipoId);
        setErro('');
        setLoading(true);
        try {
            const procId = await getProcessoGestaoActual(agendamento.agendamentoId);
            if (!procId) throw new Error('Nenhum processo de atendimento activo.');
            const tConfirma = await aguardarTarefa(procId, TASK_CONFIRMAR);
            await completarTarefa(procId, tConfirma.id, { adicionarServico: true, removerServico: false });
            const tSelec = await aguardarTarefa(procId, TASK_SELECIONAR_ADICIONAR);
            await completarTarefa(procId, tSelec.id, {
                tipoServicoId: tipoId,
                servicoTemp: {
                    tipoServicoId: tipoId,
                    nomeServico: tipoEscolhido?.tipo || 'Serviço',
                },
            });
            // Espera o loop voltar a BP56_sub3 (workers de preço + adicionar correm entretanto).
            await aguardarTarefa(procId, TASK_CONFIRMAR);
            await recarregarLista(procId);
            setTipoServicoAdicionar('');
        } catch (e) {
            setErro(e.message || 'Falha ao adicionar serviço.');
        } finally {
            setLoading(false);
        }
    };

    // Remove um serviço: completa BP56_sub3 com `removerServico=true` -> BPMN abre Activity_1fxujz7_sub3 para identificar QUAL -> completa-a com o tipoServicoId.
    // O worker `remover-servico-lista` actualiza a variável, e o BPMN volta a BP56_sub3.
    const removerServico = async (tipoServicoId) => {
        if (!agendamento?.agendamentoId || !tipoServicoId) return;
        setErro('');
        setLoading(true);
        try {
            const procId = await getProcessoGestaoActual(agendamento.agendamentoId);
            if (!procId) throw new Error('Nenhum processo de atendimento activo.');
            const tConfirma = await aguardarTarefa(procId, TASK_CONFIRMAR);
            await completarTarefa(procId, tConfirma.id, { adicionarServico: false, removerServico: true });
            const tSelec = await aguardarTarefa(procId, TASK_SELECIONAR_REMOVER);
            await completarTarefa(procId, tSelec.id, { servicoARemover: tipoServicoId });
            // Espera o loop voltar a BP56_sub3 (worker remover-servico-lista corre entretanto).
            await aguardarTarefa(procId, TASK_CONFIRMAR);
            await recarregarLista(procId);
        } catch (e) {
            setErro(e.message || 'Falha ao remover serviço.');
        } finally {
            setLoading(false);
        }
    };

    // Completa BP56_sub3 com ambos os flags a false -> BPMN avança para BP184 (pagamento).
    // Os passos seguintes adicionam suporte a "Adicionar" e "Remover" antes do confirmar.
    const confirmarSemAlterar = async () => {
        if (!agendamento?.agendamentoId) {
            setErro('Agendamento sem identificador.');
            return;
        }
        setErro('');
        setLoading(true);
        try {
            const procId = await getProcessoGestaoActual(agendamento.agendamentoId);
            if (!procId) throw new Error('Nenhum processo de atendimento activo para este agendamento.');
            const tarefa = await aguardarTarefa(procId, TASK_CONFIRMAR);
            await completarTarefa(procId, tarefa.id, {
                adicionarServico: false,
                removerServico: false,
            });
            onConfirmado?.(agendamento);
        } catch (e) {
            setErro(e.message || 'Falha ao confirmar serviços.');
        } finally {
            setLoading(false);
        }
    };

    if (!agendamento) return null;

    return (
        <Dialog open={open} onClose={fechar} maxWidth="sm" fullWidth>
            <DialogTitle>
                Faturar serviços prestados - {agendamento.animal}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        Confirma os serviços prestados antes de receber o pagamento.
                    </Typography>

                    <Divider />

                    <Typography variant="overline" color="text.secondary">
                        Serviços actuais ({servicos.length})
                    </Typography>

                    {carregandoLista && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={24} />
                        </Box>
                    )}

                    {!carregandoLista && servicos.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Sem serviços associados ao agendamento.
                        </Typography>
                    )}

                    {!carregandoLista && servicos.length > 0 && (
                        <Stack spacing={1}>
                            {servicos.map((s, i) => (
                                <Paper key={s.tipoServicoId || i} variant="outlined" sx={{ p: 1.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                                            {s.nomeServico || s.nome || 'Serviço'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {Number(s.precoBase ?? 0).toFixed(2)} €
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            disabled={loading || !s.tipoServicoId}
                                            onClick={() => removerServico(s.tipoServicoId)}
                                            aria-label={`Remover ${s.nomeServico || 'serviço'}`}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Paper>
                            ))}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1.5, mt: 0.5 }}>
                                <Typography variant="body2">
                                    Total: <b>{servicos.reduce((s, x) => s + Number(x.precoBase || 0), 0).toFixed(2)} €</b>
                                </Typography>
                            </Box>
                        </Stack>
                    )}

                    <Divider />

                    <Typography variant="overline" color="text.secondary">
                        Adicionar serviço
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <FormControl fullWidth size="small" disabled={loading || tiposServico.length === 0}>
                            <InputLabel id="add-tipo-label">Tipo de serviço</InputLabel>
                            <Select
                                labelId="add-tipo-label"
                                label="Tipo de serviço"
                                value={tipoServicoAdicionar}
                                onChange={(e) => setTipoServicoAdicionar(e.target.value)}
                            >
                                {tiposServico.map((t) => (
                                    <MenuItem key={t.id} value={t.id}>{t.tipo}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={adicionarServico}
                            disabled={loading || !tipoServicoAdicionar}
                        >
                            Adicionar
                        </Button>
                    </Box>

                    {erro && <Alert severity="error">{erro}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={fechar} disabled={loading}>
                    Cancelar
                </Button>
                <Button
                    variant="contained"
                    onClick={confirmarSemAlterar}
                    // Bloquear confirmação com lista vazia evita o caminho BP67 -> BP61 -> BP63 do BPMN (notificar-erro OPERACIONAL, qtdServicos==0),
                    // que devolve o processo a BP56_sub3 enquanto o frontend já avançou para o pagamento.
                    disabled={loading || servicos.length === 0}
                    title={servicos.length === 0 ? 'Adicione pelo menos um serviço antes de confirmar.' : ''}
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                >
                    Confirmar e ir para pagamento
                </Button>
            </DialogActions>
        </Dialog>
    );
}
