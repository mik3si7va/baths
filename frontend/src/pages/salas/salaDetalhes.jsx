import React, { useEffect, useState } from 'react';
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
import { CalendarView } from '../../components';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function SalaDetalhes() {
    const { id, nome } = useParams();
    const navigate = useNavigate();
    const { colors } = useThemeContext();

    const [sala, setSala] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    const nomeExibicao = sala?.nome
        ?? (nome ? decodeURIComponent(nome).replace(/_/g, ' ') : 'Sala sem nome');

    const loadData = async () => {
        setLoading(true);
        setErro('');

        try {
            // TODO: filtrar por sala quando API suportar GET /events?salaId=:id
            // Carregar sala
            const salaRes = await fetch(`${API_BASE_URL}/salas/${id}`);

            // Verificar se a sala existe
            if (salaRes.status === 404) {
                navigate('/salas');
                return;
            }

            //Verificar outros erros da sala antes de carregar eventos
            if (!salaRes.ok) {
                const errorData = await salaRes.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao carregar sala.');
            }

            // Carregar os eventos se a sala estiver OK
            const eventsRes = await fetch(`${API_BASE_URL}/events`);

            if (!eventsRes.ok) {
                const errorData = await eventsRes.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao carregar eventos.');
            }

            // Processar dados
            const salaData = await salaRes.json();
            const eventsData = await eventsRes.json();

            setSala(salaData);

            const mapped = (Array.isArray(eventsData) ? eventsData : []).map((e) => ({
                id: String(e.id),
                title: e.title,
                start: e.startAt || e.start,
                end: e.endAt || e.end,
            }));

            setEvents(mapped);
        } catch (e) {
            setErro(e.message || 'Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

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

                <CalendarView events={events} />
            </Paper>
        </Box>
    );
}
