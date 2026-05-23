import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    //IconButton,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material';
//import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import { useThemeContext } from '../../contexts/ThemeContext';
import { CalendarView, AgendamentoDialog, CancelarAgendamentoDialog, NaoCompareceuDialog, ListaAgendamentos, FaturarServicosDialog } from '../../components';
import MetodoPagamentoDialog from '../../components/metodoPagamentoDialog';
import { getProcessoGestaoActual, aguardarTarefa, completarTarefa, aguardarFimGestao } from '../../utils/camundaWizard';
import { mapAgendamentosToEvents, renderBloco } from '../../utils/agendamentosCalendar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ID da user task do gestao_agendamento.bpmn. Coincide com o `taskDefinitionKey` no Camunda Modeler - alterar aqui requer renomear também no BPMN.
const TASK_RECEBER_PAGAMENTO = 'BP184';

export default function SalaDetalhes() {
    const { id, nome } = useParams();
    const navigate = useNavigate();
    const { colors } = useThemeContext();
    const [selecionado, setSelecionado] = useState(null);
    const [aCancelar, setACancelar] = useState(null);
    const [aMarcarFalta, setAMarcarFalta] = useState(null);
    // Encadeamento BP56_sub3 (sub_faturar_servicos) -> BP184 (receber pagamento).
    const [aFaturarServicos, setAFaturarServicos] = useState(null);
    const [aReceberPagamento, setAReceberPagamento] = useState(null);
    const [pagamentoLoading, setPagamentoLoading] = useState(false);

    const [sala, setSala] = useState(null);
    const [agendamentos, setAgendamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');
    const [intervaloVisivel, setIntervaloVisivel] = useState(null);

    const events = useMemo(() => mapAgendamentosToEvents(agendamentos), [agendamentos]);

    // Guarda contra loop + uso de view.currentStart/End (em vez de start/end) —
    // ver comentários equivalentes em calendar.jsx.
    const actualizarIntervalo = useCallback(({ view }) => {
        const start = view.currentStart;
        const end = view.currentEnd;
        setIntervaloVisivel((prev) => {
            if (prev && prev.start.getTime() === start.getTime() && prev.end.getTime() === end.getTime()) {
                return prev;
            }
            return { start, end };
        });
    }, []);

    const nomeExibicao = sala?.nome
        ?? (nome ? decodeURIComponent(nome).replace(/_/g, ' ') : 'Sala sem nome');

    // navigateRef: `useNavigate` devolve referência nova a cada render. Se
    // metêssemos `navigate` no array de deps de `loadData` (useCallback abaixo),
    // ele seria recriado em todos os renders e o useEffect que chama `loadData`
    // dispararia re-fetch infinito. Manter a referência viva via ref permite
    // chamar `navigateRef.current('/salas')` dentro do loadData sem o pôr nas
    // deps. Padrão usado em React Router v6 com useCallback que depende de IDs.
    const navigateRef = useRef(navigate);

    useEffect(() => {
        navigateRef.current = navigate;
    }, [navigate]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setErro('');

        try {
            // Carregar sala
            const salaRes = await fetch(`${API_BASE_URL}/salas/${id}`);

            // Verificar se a sala existe
            if (salaRes.status === 404) {
                navigateRef.current('/salas');
                return;
            }

            // Verificar outros erros da sala antes de carregar agendamentos
            if (!salaRes.ok) {
                const errorData = await salaRes.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao carregar sala.');
            }

            // Carregar os agendamentos desta sala (filtra-os via query string ?salaId=:id).
            const agendamentosRes = await fetch(`${API_BASE_URL}/agendamentos?salaId=${id}`);
            if (!agendamentosRes.ok) {
                const errorData = await agendamentosRes.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao carregar agendamentos.');
            }

            const salaData = await salaRes.json();
            const agendamentosData = await agendamentosRes.json();

            setSala(salaData);
            setAgendamentos(Array.isArray(agendamentosData) ? agendamentosData : []);

        } catch (e) {
            setErro(e.message || 'Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Completa BP184 com o método escolhido. Aguarda o processo Camunda terminar
    // (BP185 + BP183 correm depois) antes de fazer re-fetch - só aí a Fatura está
    // criada na BD. Mesma lógica que em calendar.jsx::receberPagamento.
    const receberPagamento = async (metodoPagamento) => {
        if (!aReceberPagamento?.agendamentoId) return;
        setPagamentoLoading(true);
        try {
            const procId = await getProcessoGestaoActual(aReceberPagamento.agendamentoId);
            if (!procId) throw new Error('Nenhum processo de atendimento activo para este agendamento.');
            const tarefa = await aguardarTarefa(procId, TASK_RECEBER_PAGAMENTO);
            await completarTarefa(procId, tarefa.id, { metodoPagamento });
            // Espera o BPMN terminar (BP185 regista pagamento, BP183 gera fatura)
            // antes do re-fetch - só então a Fatura existe na BD.
            await aguardarFimGestao(aReceberPagamento.agendamentoId);
            setAReceberPagamento(null);
            await loadData();
        } finally {
            setPagamentoLoading(false);
        }
    };

    // Click num bloco - abre o dialog com detalhe completo.
    const abrirDetalhe = ({ event }) => {
        if (event.display === 'background') return;
        setSelecionado({
            inicio: event.start,
            fim: event.end,
            ...event.extendedProps,
        });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            {/* Cabeçalho */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {/*<IconButton onClick={() => navigate('/salas')} sx={{ color: colors.primary }}>
                    <ArrowBackIcon />
                </IconButton>*/}
                <MeetingRoomIcon sx={{ fontSize: 32, color: sala?.ativo ? colors.primary : colors.textSecondary }} />
                <Typography variant="h1" sx={{ color: colors.text }}>
                    {nomeExibicao}
                </Typography>
                <Chip
                    label={sala?.ativo ? 'Ativa' : 'Inativa'}
                    color={sala?.ativo ? 'success' : 'default'}
                    sx={{ fontSize: '12px' }}
                />
            </Box>

            {erro && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
                    {erro}
                </Alert>
            )}

            {/* Sala inativa — aviso */}
            {sala && !sala.ativo && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Esta sala está inativa e não está disponível para reservas.
                </Alert>
            )}

            {/* Detalhes da sala */}
            <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            <strong>Capacidade:</strong> {sala?.capacidade} {sala?.capacidade === 1 ? 'animal' : 'animais'}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            <strong>Preço por hora:</strong> €{sala?.precoHora}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            <strong>Equipamento:</strong> {sala?.equipamento}
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textSecondary }}>
                            Serviços compatíveis
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {(sala?.servicos || []).map((servico) => (
                                <Chip
                                    key={servico.tipoServicoId}
                                    label={servico.tipo}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                    </Box>

                    {/* Botão Reservar */}
                    <Box>
                        <Tooltip
                            title={
                                !sala?.ativo
                                    ? 'Sala inativa — não disponível para reservas'
                                    : 'Reservas de salas em breve'
                            }
                            arrow
                        >
                            <span>
                                <Button
                                    variant="contained"
                                    startIcon={<EventAvailableIcon />}
                                    disabled
                                    sx={{
                                        backgroundColor: colors.primary,
                                        '&.Mui-disabled': {
                                            backgroundColor: `${colors.primary}55`,
                                            color: colors.white,
                                        },
                                    }}
                                >
                                    Reservar
                                </Button>
                            </span>
                        </Tooltip>
                    </Box>
                </Box>
            </Paper>

            {/* Calendário de disponibilidade */}
            <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
                <Typography variant="h2" sx={{ mb: 3, color: colors.text }}>
                    Disponibilidade
                </Typography>

                <CalendarView
                    events={events}
                    onEventClick={abrirDetalhe}
                    eventContent={renderBloco}
                    onDatesSet={actualizarIntervalo}
                />
            </Paper>

            <ListaAgendamentos
                agendamentos={agendamentos}
                intervalo={intervaloVisivel}
                titulo="Agendamentos da sala no período visível"
                onCancelar={setACancelar}
                onNaoCompareceu={setAMarcarFalta}
                onReagendar={(ag) => navigate(`/agendamentos/${ag.agendamentoId}/reagendar`)}
                onReceberPagamento={setAFaturarServicos}
                onVerFatura={(ag) => navigate(`/faturas/${ag.faturaId}`)}
            />
            <AgendamentoDialog
                agendamento={selecionado}
                onClose={() => setSelecionado(null)}
                onSuccess={loadData}
            />

            <CancelarAgendamentoDialog
                agendamento={aCancelar}
                open={aCancelar !== null}
                onClose={() => setACancelar(null)}
                onSuccess={loadData}
            />

            <NaoCompareceuDialog
                agendamento={aMarcarFalta}
                open={aMarcarFalta !== null}
                onClose={() => setAMarcarFalta(null)}
                onSuccess={loadData}
            />

            <FaturarServicosDialog
                open={aFaturarServicos !== null}
                agendamento={aFaturarServicos}
                onClose={() => setAFaturarServicos(null)}
                onConfirmado={(ag) => {
                    setAFaturarServicos(null);
                    setAReceberPagamento(ag);
                }}
            />

            <MetodoPagamentoDialog
                open={aReceberPagamento !== null}
                onClose={() => !pagamentoLoading && setAReceberPagamento(null)}
                onConfirmar={receberPagamento}
                loading={pagamentoLoading}
            />
        </Box>
    );
}
