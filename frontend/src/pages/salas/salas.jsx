import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, TextField, Button, Checkbox,
    FormControlLabel, FormGroup, Paper, Alert, Chip,
    CircularProgress, IconButton,
} from '@mui/material';
import { ConfirmDialog } from '../../components';
import { useThemeContext } from '../../contexts/ThemeContext';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';

import TextareaAutosize from "@mui/material/TextareaAutosize";


const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('btUser') || 'null');
    } catch (_error) {
        return null;
    }
}

export default function Sala() {
    const { colors } = useThemeContext();
    const navigate = useNavigate();
    const [user] = useState(() => getStoredUser());
    const isAdmin = user?.tipoConta === 'ADMIN';

    const [form, setForm] = useState({
        nome: '',
        capacidade: '',
        equipamento: '',
        precoHora: ''
    });
    const [servicos, setServicos] = useState([]);
    const [servicosSelecionados, setServicosSelecionados] = useState([]);
    const [salas, setSalas] = useState([]);
    const [sucesso, setSucesso] = useState('');
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingSalas, setLoadingSalas] = useState(true);

    // Estado para controlar se está em modo edição
    const [modoEdicao, setModoEdicao] = useState(false);
    const [idSalaEmEdicao, setIdSalaEmEdicao] = useState(null);
    const [salaEmEdicaoAtiva, setSalaEmEdicaoAtiva] = useState(true);

    // Estado para o diálogo de confirmação
    const [dialogoInativarAberto, setDialogoInativarAberto] = useState(false);
    const [salaParaInativar, setSalaParaInativar] = useState(null);

    // Estado para o diálogo de eliminação definitiva (hard delete)
    const [dialogoEliminarAberto, setDialogoEliminarAberto] = useState(false);
    const [salaParaEliminar, setSalaParaEliminar] = useState(null);

    // Diálogo de erro modal (BET-180): quando o backend devolve 409 ao tentar inativar uma sala com agendamentos futuros
    const [dialogoErroAberto, setDialogoErroAberto] = useState(false);
    const [dialogoErroMensagem, setDialogoErroMensagem] = useState('');

    // Ref para timeout de sucesso
    const successTimeoutRef = useRef(null);

    // Mapa de serviços por ID
    const servicosById = useMemo(() => {
        return Object.fromEntries(servicos.map((s) => [s.id, s.tipo]));
    }, [servicos]);

    // Auto-limpar mensagem de sucesso. Cleanup também trata do unmount - não é preciso um useEffect dedicado a unmount.
    useEffect(() => {
        if (sucesso) {
            successTimeoutRef.current = setTimeout(() => {
                setSucesso('');
            }, 3000);
        }
        return () => {
            if (successTimeoutRef.current) {
                clearTimeout(successTimeoutRef.current);
            }
        };
    }, [sucesso]);

    const carregarServicos = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/servicos`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao carregar serviços.');
            }
            const data = await res.json();
            setServicos(Array.isArray(data) ? data : []);
        } catch (err) {
            setErro(err.message || 'Erro ao carregar serviços.');
        }
    };

    const carregarSalas = async () => {
        setLoadingSalas(true);
        try {
            const res = await fetch(`${API_BASE_URL}/salas/todas`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao carregar salas.');
            }
            const data = await res.json();
            setSalas(Array.isArray(data) ? data : []);
        } catch (err) {
            setErro(err.message || 'Erro ao carregar salas.');
            setSalas([]);
        } finally {
            setLoadingSalas(false);
        }
    };

    useEffect(() => {
        carregarServicos();
        carregarSalas();
    }, []);

    // Salas ordenadas: ativas primeiro, inativas no final
    const salasOrdenadas = useMemo(() => {
        const visiveis = isAdmin ? salas : salas.filter((sala) => sala.ativo);
        return [...visiveis].sort((a, b) => {
            if (a.ativo === b.ativo) return a.nome.localeCompare(b.nome);
            return a.ativo ? -1 : 1;
        });
    }, [salas, isAdmin]);

    const toggleServico = (id) => {
        setServicosSelecionados(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    // Limpar formulário e sair do modo edição
    const resetForm = () => {
        setForm({ nome: '', capacidade: '', equipamento: '', precoHora: '' });
        setServicosSelecionados([]);
        setModoEdicao(false);
        setIdSalaEmEdicao(null);
        setSalaEmEdicaoAtiva(true);
        setErro('');
    };

    // Preencher formulário para edição
    const iniciarEdicao = (sala) => {
        setModoEdicao(true);
        setIdSalaEmEdicao(sala.id);
        setSalaEmEdicaoAtiva(sala.ativo);
        setForm({
            nome: sala.nome,
            capacidade: sala.capacidade.toString(),
            equipamento: sala.equipamento,
            precoHora: sala.precoHora.toString()
        });
        // Extrair IDs dos serviços associados
        const servicosIds = sala.servicos?.map(s => s.tipoServicoId) || [];
        setServicosSelecionados(servicosIds);

        // Scroll suave para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Cancelar edição
    const cancelarEdicao = () => {
        resetForm();
    };

    const validateForm = () => {
        if (!form.nome.trim()) {
            return 'Nome da sala é obrigatório.';
        }

        const capacidadeNum = parseInt(form.capacidade);
        if (isNaN(capacidadeNum) || capacidadeNum < 1) {
            return 'Capacidade deve ser um número positivo maior que zero.';
        }

        const precoNum = parseFloat(form.precoHora);
        if (isNaN(precoNum) || precoNum <= 0) {
            return 'Preço por hora deve ser um valor positivo maior que zero.';
        }

        if (!form.equipamento.trim()) {
            return 'Equipamento é obrigatório.';
        }

        if (servicosSelecionados.length === 0) {
            return 'Selecione pelo menos um serviço para a sala.';
        }

        return null;
    };

    // Reativar sala (soft delete reverso)
    const reativarSala = async () => {
        if (!idSalaEmEdicao) return;

        const validationError = validateForm();
        if (validationError) {
            setErro(validationError);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/salas/${idSalaEmEdicao}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: form.nome.trim(),
                    capacidade: parseInt(form.capacidade),
                    equipamento: form.equipamento.trim(),
                    precoHora: Number(parseFloat(form.precoHora).toFixed(2)),
                    tipoServicoIds: servicosSelecionados,
                    ativo: true
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao reativar sala.');
            }

            setSucesso('Sala reativada com sucesso!');
            resetForm();
            await carregarSalas();
        } catch (err) {
            setErro(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Criar ou atualizar sala
    const submeter = async (e) => {
        e.preventDefault();
        setErro('');
        setSucesso('');
        setLoading(true);

        // Validações
        const validationError = validateForm();
        if (validationError) {
            setErro(validationError);
            setLoading(false);
            return;
        }

        try {
            let response;
            const payload = {
                nome: form.nome.trim(),
                capacidade: parseInt(form.capacidade),
                equipamento: form.equipamento.trim(),
                precoHora: Number(parseFloat(form.precoHora).toFixed(2)),
                tipoServicoIds: servicosSelecionados
            };

            if (modoEdicao && idSalaEmEdicao) {
                // UPDATE - Editar sala existente
                response = await fetch(`${API_BASE_URL}/salas/${idSalaEmEdicao}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                // CREATE - Criar nova sala
                response = await fetch(`${API_BASE_URL}/salas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || (modoEdicao ? 'Erro ao atualizar sala.' : 'Erro ao criar sala.'));
            }

            setSucesso(modoEdicao ? 'Sala atualizada com sucesso!' : 'Sala criada com sucesso!');
            resetForm();
            await carregarSalas();
        } catch (err) {
            setErro(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Abrir diálogo de confirmação para eliminar
    const pedirInativacao = (sala) => {
        setSalaParaInativar(sala);
        setDialogoInativarAberto(true);
    };

    // Confirmar e eliminar
    const inativarSala = async () => {
        if (!salaParaInativar) return;

        try {
            const res = await fetch(`${API_BASE_URL}/salas/${salaParaInativar.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const message = err.error || 'Erro ao eliminar sala';

                // BET-180: 409 = sala tem agendamentos futuros
                if (res.status === 409) {
                    setDialogoInativarAberto(false);
                    setSalaParaInativar(null);
                    setDialogoErroMensagem(message);
                    setDialogoErroAberto(true);
                    return;
                }

                throw new Error(message);
            }

            // Se a sala que estava a ser editada for eliminada, limpar formulário
            if (modoEdicao && idSalaEmEdicao === salaParaInativar.id) {
                resetForm();
            }

            await carregarSalas();
            setSucesso(`Sala "${salaParaInativar.nome}" inativada com sucesso!`);
            setDialogoInativarAberto(false);
            setSalaParaInativar(null);
        } catch (err) {
            setErro(err.message);
            setDialogoInativarAberto(false);
            setSalaParaInativar(null);
        }
    };

    // Fechar diálogo
    const fecharDialogo = () => {
        setDialogoInativarAberto(false);
        setSalaParaInativar(null);
    };

    // Abrir diálogo de confirmação para eliminar definitivamente (hard delete)
    const pedirEliminacao = (sala) => {
        setSalaParaEliminar(sala);
        setDialogoEliminarAberto(true);
    };

    // Confirmar e eliminar definitivamente (hard delete via DELETE /salas/:id/permanente)
    const eliminarSala = async () => {
        if (!salaParaEliminar) return;

        try {
            const res = await fetch(`${API_BASE_URL}/salas/${salaParaEliminar.id}/permanente`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const message = err.error || 'Erro ao eliminar sala.';

                // 409 = registos associados (agendamentos) — abrir dialog modal de erro
                if (res.status === 409) {
                    setDialogoEliminarAberto(false);
                    setSalaParaEliminar(null);
                    setDialogoErroMensagem(message);
                    setDialogoErroAberto(true);
                    return;
                }

                throw new Error(message);
            }

            if (modoEdicao && idSalaEmEdicao === salaParaEliminar.id) {
                resetForm();
            }

            await carregarSalas();
            setSucesso(`Sala "${salaParaEliminar.nome}" eliminada com sucesso.`);
            setDialogoEliminarAberto(false);
            setSalaParaEliminar(null);
        } catch (err) {
            setErro(err.message);
            setDialogoEliminarAberto(false);
            setSalaParaEliminar(null);
        }
    };

    // Fechar diálogo de eliminação
    const fecharDialogoEliminar = () => {
        setDialogoEliminarAberto(false);
        setSalaParaEliminar(null);
    };

    return (
        <Box>
            <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
                Gestão de Salas
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
                {isAdmin
                    ? 'Criar novas salas com nome, capacidade, equipamento, servicos associados e preco por hora.'
                    : 'Consulta salas, servicos compativeis e agendas de disponibilidade.'}
            </Typography>

            {/* Formulário de criação/edição */}
            {isAdmin && (
            <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
                <Box component="form" onSubmit={submeter} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {sucesso && <Alert severity="success">{sucesso}</Alert>}
                    {erro && <Alert severity="error">{erro}</Alert>}

                    {/* Título do formulário com indicador de modo edição */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h2" sx={{ color: colors.text }}>
                                {modoEdicao ? 'Editar Sala' : 'Criar Nova Sala'}
                            </Typography>
                            {modoEdicao && (
                                <Chip
                                    size="small"
                                    label={salaEmEdicaoAtiva ? "Modo edição" : "Sala Inativa"}
                                    color={salaEmEdicaoAtiva ? "warning" : "default"}
                                    variant="outlined"
                                />
                            )}
                        </Box>

                        {/* Botão Reativar (só aparece se sala estiver inativa) */}
                        {modoEdicao && !salaEmEdicaoAtiva && (
                            <Button
                                variant="outlined"
                                color="success"
                                startIcon={<RestoreIcon />}
                                onClick={reativarSala}
                                disabled={loading}
                                size="small"
                            >
                                Reativar Sala
                            </Button>
                        )}
                    </Box>

                    <TextField
                        id="sala-nome"
                        name="nome"
                        label="Nome da sala"
                        value={form.nome}
                        onChange={e => setForm({ ...form, nome: e.target.value })}
                        required
                        fullWidth
                        placeholder="Ex: Sala de Banho 1, Sala de Tosquia 1, Sala de Tratamentos..."
                    />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <TextField
                            id="sala-capacidade"
                            name="capacidade"
                            label="Capacidade (nº de animais)"
                            type="number"
                            value={form.capacidade}
                            onChange={e => setForm({ ...form, capacidade: e.target.value })}
                            required
                            fullWidth
                            inputProps={{ min: 1, step: 1 }}
                        />

                        <TextField
                            id="sala-preco-hora"
                            name="precoHora"
                            label="Preço por hora (€)"
                            type="number"
                            value={form.precoHora}
                            onChange={e => setForm({ ...form, precoHora: e.target.value })}
                            required
                            fullWidth
                            inputProps={{
                                min: 0.01,
                                step: 0.01,
                            }}
                            placeholder="Ex: 10.50"
                            // BET-460: avisar o admin que alterar o preço não retroage - reservas já existentes mantêm o preço com que foram criados.
                            helperText={modoEdicao ? 'Alterações ao preço só afetam novas reservas. Reservas já marcadas mantêm o preço original.' : ''}
                        />
                    </Box>

                    <TextField
                        id="sala-equipamento"
                        name="equipamento"
                        label="Equipamento"
                        value={form.equipamento}
                        onChange={e => setForm({ ...form, equipamento: e.target.value })}
                        required
                        fullWidth
                        multiline
                        InputProps={{
                            inputComponent: TextareaAutosize,
                            inputProps: {
                                minRows: 2,
                                placeholder: "Ex: Banheira, mesa de tosquia, secador..."
                            }
                        }}
                    />

                    <Typography variant="h2" sx={{ mt: 1, color: colors.text }}>
                        Serviços compatíveis
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, mb: 1 }}>
                        Selecione pelo menos um serviço que pode ser realizado nesta sala.
                    </Typography>

                    <FormGroup sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: 1
                    }}>
                        {servicos.map(servico => (
                            <FormControlLabel
                                key={servico.id}
                                control={
                                    <Checkbox
                                        checked={servicosSelecionados.includes(servico.id)}
                                        onChange={() => toggleServico(servico.id)}
                                        sx={{
                                            color: colors.primary,
                                            '&.Mui-checked': { color: colors.primary }
                                        }}
                                    />
                                }
                                label={servico.tipo}
                            />
                        ))}
                    </FormGroup>

                    {/* Botões do formulário */}
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={loading}
                            startIcon={modoEdicao ? <SaveIcon /> : null}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                backgroundColor: colors.primary,
                                '&:hover': { backgroundColor: `${colors.primary}dd` }
                            }}
                        >
                            {loading ? <CircularProgress size={24} sx={{ color: colors.white }} /> : (modoEdicao ? 'Atualizar Sala' : 'Criar Sala')}
                        </Button>

                        {modoEdicao && (
                            <Button
                                type="button"
                                variant="outlined"
                                onClick={cancelarEdicao}
                                startIcon={<CancelIcon />}
                                sx={{ py: 1.5, px: 3 }}
                            >
                                Cancelar
                            </Button>
                        )}
                    </Box>
                </Box>
            </Paper>

            )}

            {/* Lista de salas existentes */}
            <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h2" sx={{ color: colors.text }}>
                        Salas Registadas
                    </Typography>
                    {loadingSalas && <CircularProgress size={20} />}
                </Box>

                {!loadingSalas && salas.length === 0 && (
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                        Ainda não existem salas registadas.
                    </Typography>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {salasOrdenadas.map((sala) => (
                        <Paper
                            key={sala.id}
                            variant="outlined"
                            onClick={() => {
                                const nomeUrl = encodeURIComponent(sala.nome.replace(/\s+/g, '_'));
                                navigate(`/salas/${sala.id}/${nomeUrl}`);
                            }}
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                cursor: 'pointer',
                                opacity: sala.ativo ? 1 : 0.55,
                                borderStyle: sala.ativo ? 'solid' : 'dashed',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    borderColor: colors.primary,
                                }
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                        <MeetingRoomIcon sx={{ fontSize: 20, color: colors.primary }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text }}>
                                            {sala.nome}
                                        </Typography>
                                        <Chip
                                            size="small"
                                            label={sala.ativo ? 'Ativa' : 'Inativa'}
                                            color={sala.ativo ? 'success' : 'default'}
                                            sx={{ color: colors.white, fontSize: '11px', height: 24 }}
                                        />
                                    </Box>

                                    <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                                        Capacidade: {sala.capacidade} {sala.capacidade === 1 ? 'animal' : 'animais'} |
                                        Preço: €{sala.precoHora}/hora
                                    </Typography>

                                    <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                                        {sala.equipamento}
                                    </Typography>

                                    {/* Serviços */}
                                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {(sala.servicos || []).map((servico) => (
                                            <Chip
                                                key={`${sala.id}-${servico.tipoServicoId}`}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                                label={servico.tipo || servicosById[servico.tipoServicoId] || servico.tipoServicoId}
                                            />
                                        ))}
                                    </Box>
                                </Box>

                                {isAdmin && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); iniciarEdicao(sala); }}
                                        sx={{ color: colors.primary }}
                                        title="Editar sala"
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    {sala.ativo && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); pedirInativacao(sala); }}
                                            sx={{ color: colors.textSecondary }}
                                            title="Inativar sala"
                                            aria-label="Desativar"
                                        >
                                            <BlockIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); pedirEliminacao(sala); }}
                                        sx={{ color: colors.textSecondary }}
                                        title="Eliminar sala"
                                        aria-label="Eliminar"
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                                )}
                            </Box>
                        </Paper>
                    ))}
                </Box>
            </Paper>

            <ConfirmDialog
                open={dialogoInativarAberto}
                title="Inativar Sala"
                message={
                    <>
                        <Typography>
                            Tem a certeza que pretende inativar a sala <strong>"{salaParaInativar?.nome}"</strong>?
                        </Typography>
                        <Typography sx={{ mt: 1 }}>
                            A sala ficará indisponível para novos agendamentos. Pode reativá-la a qualquer momento através do botão de edição.
                        </Typography>
                        <Typography sx={{ mt: 1, fontSize: '0.875rem', color: 'warning.main' }}>
                            A operação será recusada se existirem agendamentos futuros associados a esta sala.
                        </Typography>
                    </>
                }
                confirmLabel="Inativar"
                confirmColor="warning"
                onConfirm={inativarSala}
                onClose={fecharDialogo}
            />

            {/* Diálogo de eliminação definitiva (hard delete). A operação é
                recusada pelo backend se existirem registos associados (FK). */}
            <ConfirmDialog
                open={dialogoEliminarAberto}
                title="Eliminar Sala definitivamente"
                message={
                    <>
                        <Typography>
                            Tem a certeza que pretende eliminar definitivamente a sala <strong>"{salaParaEliminar?.nome}"</strong>?
                        </Typography>
                        <Typography sx={{ mt: 1 }}>
                            Esta acção remove a sala da base de dados — não é reversível.
                        </Typography>
                        <Typography sx={{ mt: 1, fontSize: '0.875rem', color: 'error.main' }}>
                            A operação será recusada se existirem agendamentos (passados ou futuros) que tenham usado esta sala.
                        </Typography>
                    </>
                }
                confirmLabel="Eliminar"
                confirmColor="error"
                onConfirm={eliminarSala}
                onClose={fecharDialogoEliminar}
            />

            {/* BET-180: diálogo modal de erro quando o backend bloqueia a inativação
                (sala com agendamentos futuros). Reutiliza o ConfirmDialog em modo
                hideCancel - só botão "OK" fecha o diálogo. */}
            <ConfirmDialog
                open={dialogoErroAberto}
                title="Não é possível inativar"
                message={
                    <Typography>{dialogoErroMensagem}</Typography>
                }
                confirmLabel="OK"
                confirmColor="primary"
                hideCancel
                onConfirm={() => { setDialogoErroAberto(false); setDialogoErroMensagem(''); }}
                onClose={() => { setDialogoErroAberto(false); setDialogoErroMensagem(''); }}
            />
        </Box>
    );
}
