import React, { useState, useEffect, useMemo } from 'react';
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
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Sala() {
    const { colors } = useThemeContext();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        nome: '',
        capacidade: '',
        equipamento: '',
        precoHora: ''
    });
    const [servicos, setServicos] = useState([]);
    const [servicosSelecionados, setServicosSelecionados] = useState([]);
    const [salas, setSalas] = useState([]);
    const [sucesso, setSucesso] = useState(false);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingSalas, setLoadingSalas] = useState(true);
    
    // Estado para controlar se está em modo edição
    const [editMode, setEditMode] = useState(false);
    const [editSalaId, setEditSalaId] = useState(null);
    const [editSalaAtiva, setEditSalaAtiva] = useState(true);
    
    // Estado para o diálogo de confirmação
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [salaToDelete, setSalaToDelete] = useState(null);

    // Mapa de serviços por ID
    const servicosById = useMemo(() => {
        return Object.fromEntries(servicos.map((s) => [s.id, s.tipo]));
    }, [servicos]);

    const carregarServicos = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/servicos`);
            if (!res.ok) throw new Error('Erro ao carregar serviços');
            const data = await res.json();
            setServicos(Array.isArray(data) ? data : []);
        } catch (err) {
            setErro(err.message);
        }
    };

    const carregarSalas = async () => {
        setLoadingSalas(true);
        try {
            const res = await fetch(`${API_BASE_URL}/salas/todas`);
            if (!res.ok) throw new Error('Erro ao carregar salas');
            const data = await res.json();
            setSalas(Array.isArray(data) ? data : []);
        } catch (err) {
            setErro(err.message);
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
        return [...salas].sort((a, b) => {
            if (a.ativo === b.ativo) return a.nome.localeCompare(b.nome);
            return a.ativo ? -1 : 1;
        });
    }, [salas]);

    const toggleServico = (id) => {
        setServicosSelecionados(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    // Limpar formulário e sair do modo edição
    const resetForm = () => {
        setForm({ nome: '', capacidade: '', equipamento: '', precoHora: '' });
        setServicosSelecionados([]);
        setEditMode(false);
        setEditSalaId(null);
        setEditSalaAtiva(true);
        setErro('');
    };

    // Preencher formulário para edição
    const handleEditClick = (sala) => {
        setEditMode(true);
        setEditSalaId(sala.id);
        setEditSalaAtiva(sala.ativo);
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
    const handleCancelEdit = () => {
        resetForm();
    };

    // Reativar sala (soft delete reverso)
    const handleReativar = async () => {
        if (!editSalaId) return;
        
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/salas/${editSalaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    capacidade: parseInt(form.capacidade),
                    precoHora: parseFloat(parseFloat(form.precoHora).toFixed(2)),
                    tipoServicoIds: servicosSelecionados
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao reativar sala.');
            }

            setSucesso('Sala reativada com sucesso!');
            resetForm();
            await carregarSalas();
            setTimeout(() => setSucesso(false), 3000);
        } catch (err) {
            setErro(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Criar ou atualizar sala
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');
        setSucesso(false);
        setLoading(true);

        // Validações
        if (!form.nome.trim()) {
            setErro('Nome da sala é obrigatório');
            setLoading(false);
            return;
        }
        if (!form.capacidade || parseInt(form.capacidade) < 1) {
            setErro('Capacidade deve ser um número positivo');
            setLoading(false);
            return;
        }
        if (!form.equipamento.trim()) {
            setErro('Equipamento é obrigatório');
            setLoading(false);
            return;
        }
        if (!form.precoHora || parseFloat(form.precoHora) <= 0) {
            setErro('Preço por hora deve ser um valor positivo');
            setLoading(false);
            return;
        }
        if (servicosSelecionados.length === 0) {
            setErro('Selecione pelo menos um serviço para a sala');
            setLoading(false);
            return;
        }

        try {
            let response;
            
            if (editMode && editSalaId) {
                // UPDATE - Editar sala existente
                response = await fetch(`${API_BASE_URL}/salas/${editSalaId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: form.nome.trim(),
                        capacidade: parseInt(form.capacidade),
                        equipamento: form.equipamento.trim(),
                        precoHora: parseFloat(parseFloat(form.precoHora).toFixed(2)),
                        tipoServicoIds: servicosSelecionados
                    }),
                });
            } else {
                // CREATE - Criar nova sala
                response = await fetch(`${API_BASE_URL}/salas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: form.nome.trim(),
                        capacidade: parseInt(form.capacidade),
                        equipamento: form.equipamento.trim(),
                        precoHora: parseFloat(parseFloat(form.precoHora).toFixed(2)),
                        tipoServicoIds: servicosSelecionados
                    }),
                });
            }

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || (editMode ? 'Erro ao atualizar sala.' : 'Erro ao criar sala.'));
            }

            setSucesso(editMode ? 'Sala atualizada com sucesso!' : 'Sala criada com sucesso!');
            resetForm();
            await carregarSalas();

            setTimeout(() => setSucesso(false), 3000);
        } catch (err) {
            setErro(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Abrir diálogo de confirmação para eliminar
    const handleDeleteClick = (sala) => {
        setSalaToDelete(sala);
        setDeleteDialogOpen(true);
    };

    // Confirmar e eliminar
    const handleConfirmDelete = async () => {
        if (!salaToDelete) return;
        
        try {
            const res = await fetch(`${API_BASE_URL}/salas/${salaToDelete.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao eliminar sala');
            }

            // Se a sala que estava a ser editada for eliminada, limpar formulário
            if (editMode && editSalaId === salaToDelete.id) {
                resetForm();
            }

            await carregarSalas();
            setSucesso(`Sala "${salaToDelete.nome}" ${salaToDelete.ativo ? 'inativada' : 'eliminada'} com sucesso!`);
            setTimeout(() => setSucesso(false), 3000);
        } catch (err) {
            setErro(err.message);
        } finally {
            setDeleteDialogOpen(false);
            setSalaToDelete(null);
        }
    };

    // Fechar diálogo
    const handleCloseDialog = () => {
        setDeleteDialogOpen(false);
        setSalaToDelete(null);
    };

    return (
        <Box>
            <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
                Gestão de Salas
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
                Criar novas salas com nome, capacidade, equipamento, serviços associados e preço por hora.
            </Typography>

            {/* Formulário de criação/edição */}
            <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {sucesso && <Alert severity="success">{sucesso}</Alert>}
                    {erro && <Alert severity="error">{erro}</Alert>}

                    {/* Título do formulário com indicador de modo edição */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h2" sx={{ color: colors.text }}>
                                {editMode ? 'Editar Sala' : 'Criar Nova Sala'}
                            </Typography>
                            {editMode && (
                                <Chip 
                                    size="small" 
                                    label={editSalaAtiva ? "Modo edição" : "Sala Inativa"}
                                    color={editSalaAtiva ? "warning" : "default"}
                                    variant="outlined"
                                />
                            )}
                        </Box>
                        
                        {/* Botão Reativar (só aparece se sala estiver inativa) */}
                        {editMode && !editSalaAtiva && (
                            <Button
                                variant="outlined"
                                color="success"
                                startIcon={<RestoreIcon />}
                                onClick={handleReativar}
                                disabled={loading}
                                size="small"
                            >
                                Reativar Sala
                            </Button>
                        )}
                    </Box>

                    <TextField
                        label="Nome da sala"
                        value={form.nome}
                        onChange={e => setForm({ ...form, nome: e.target.value })}
                        required
                        fullWidth
                        placeholder="Ex: Sala de Banho 1, Sala de Tosquia 1, Sala de Tratamentos..."
                    />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <TextField
                            label="Capacidade (nº de animais)"
                            type="number"
                            value={form.capacidade}
                            onChange={e => setForm({ ...form, capacidade: e.target.value })}
                            required
                            fullWidth
                            inputProps={{ min: 1 }}
                        />

                        <TextField
                            label="Preço por hora (€)"
                            type="number"
                            value={form.precoHora}
                            onChange={e => setForm({ ...form, precoHora: e.target.value })}
                            required
                            fullWidth
                        />
                    </Box>

                    <TextField
                        label="Equipamento"
                        value={form.equipamento}
                        onChange={e => setForm({ ...form, equipamento: e.target.value })}
                        required
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Ex: Banheira, mesa de tosquia, secador..."
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
                            startIcon={editMode ? <SaveIcon /> : null}
                            sx={{
                                flex: 1,
                                py: 1.5,
                                backgroundColor: colors.primary,
                                '&:hover': { backgroundColor: `${colors.primary}dd` }
                            }}
                        >
                            {loading ? <CircularProgress size={24} sx={{ color: colors.white }} /> : (editMode ? 'Atualizar Sala' : 'Criar Sala')}
                        </Button>
                        
                        {editMode && (
                            <Button
                                type="button"
                                variant="outlined"
                                onClick={handleCancelEdit}
                                startIcon={<CancelIcon />}
                                sx={{ py: 1.5, px: 3 }}
                            >
                                Cancelar
                            </Button>
                        )}
                    </Box>
                </Box>
            </Paper>

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

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); handleEditClick(sala); }}
                                        sx={{ color: colors.primary }}
                                        title="Editar sala"
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    {sala.ativo && (
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(sala); }}
                                            sx={{ color: colors.textSecondary }}
                                            title="Inativar sala"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>
                            </Box>
                        </Paper>
                    ))}
                </Box>
            </Paper>

            <ConfirmDialog
                open={deleteDialogOpen}
                title="Inativar Sala"
                message={
                    <>
                        <Typography>
                            Tem a certeza que pretende inativar a sala <strong>"{salaToDelete?.nome}"</strong>?
                        </Typography>
                        <Typography sx={{ mt: 1 }}>
                            A sala ficará indisponível para novos agendamentos. Pode reativá-la a qualquer momento através do botão de edição.
                        </Typography>
                    </>
                }
                confirmLabel="Inativar"
                confirmColor="warning"
                onConfirm={handleConfirmDelete}
                onClose={handleCloseDialog}
            />
        </Box>
    );
}