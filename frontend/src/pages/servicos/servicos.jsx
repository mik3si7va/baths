import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ConfirmDialog } from '../../components';
import { useThemeContext } from '../../contexts/ThemeContext';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const PORTES = [
  { value: 'EXTRA_PEQUENO', label: 'Extra Pequeno', range: '0.5 – 4.5 kg' },
  { value: 'PEQUENO',       label: 'Pequeno',       range: '5 – 9 kg'      },
  { value: 'MEDIO',         label: 'Médio',         range: '9.5 – 13.5 kg' },
  { value: 'GRANDE',        label: 'Grande',        range: '14 – 18 kg'    },
  { value: 'EXTRA_GRANDE',  label: 'Extra Grande',  range: '18.5+ kg'      },
];

function initRegrasPorPorte() {
  return PORTES.reduce((acc, p) => {
    acc[p.value] = { precoBase: '', duracaoMinutos: '' };
    return acc;
  }, {});
}

const initialForm = {
  nomeServico: '',
  requiresSize: false,
  precoUnico: '',
  duracaoUnica: '',
  regrasPorPorte: initRegrasPorPorte(),
};

export default function ServicosPage() {
  const { colors } = useThemeContext();

  const [form, setForm]                     = useState(initialForm);
  const [servicos, setServicos]             = useState([]);
  const [regras, setRegras]                 = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit]   = useState(false);
  const [erro, setErro]                     = useState('');
  const [sucesso, setSucesso]               = useState('');
  const [errors, setErrors]                 = useState({});

  // Estado para modo edição
  const [editMode, setEditMode]                   = useState(false);
  const [editServicoId, setEditServicoId]         = useState(null);
  const [editServicoAtivo, setEditServicoAtivo]   = useState(true);

  // Estados para Diálogos de Confirmação
  const [deleteDialogOpen, setDeleteDialogOpen]           = useState(false);
  const [servicoToDelete, setServicoToDelete]             = useState(null);
  const [updateConfirmOpen, setUpdateConfirmOpen]         = useState(false);
  const [reactivateConfirmOpen, setReactivateConfirmOpen] = useState(false);

  // Ref para timeout de sucesso
  const successTimeoutRef = useRef(null);

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Auto-limpar mensagem de sucesso após 3 segundos
  useEffect(() => {
    if (sucesso) {
      successTimeoutRef.current = setTimeout(() => setSucesso(''), 3000);
    }
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [sucesso]);

  const loadData = async () => {
    setLoadingInitial(true);
    setErro('');
    try {
      const [resServicos, resRegras] = await Promise.all([
        fetch(`${API_BASE_URL}/servicos`),
        fetch(`${API_BASE_URL}/regras-preco`),
      ]);
      if (!resServicos.ok) throw new Error('Erro ao carregar serviços.');
      if (!resRegras.ok)   throw new Error('Erro ao carregar regras de preço.');

      const servicosData = await resServicos.json();
      const regrasData   = await resRegras.json();

      setServicos(Array.isArray(servicosData) ? servicosData : []);
      setRegras(Array.isArray(regrasData) ? regrasData : []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar dados.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getPorteLabel = (value) => PORTES.find(p => p.value === value)?.label || value;

  const regrasByServico = useMemo(() => {
    return regras.reduce((acc, r) => {
      if (!acc[r.tipoServicoId]) acc[r.tipoServicoId] = { count: 0, precos: [] };
      acc[r.tipoServicoId].count += 1;
      acc[r.tipoServicoId].precos.push(Number(r.precoBase));
      return acc;
    }, {});
  }, [regras]);

  const getRegraInfo = (id) => {
    const info = regrasByServico[id];
    if (!info) return { count: 0, precoUnico: false };
    const precoUnico = new Set(info.precos).size === 1;
    return { count: info.count, precoUnico };
  };

  const servicosOrdenados = useMemo(() => {
    return [...servicos].sort((a, b) => {
      if (a.ativo === b.ativo) return a.tipo.localeCompare(b.tipo);
      return a.ativo ? -1 : 1;
    });
  }, [servicos]);

  const updateRegraPorte = (porte, field, value) => {
    setForm((prev) => ({
      ...prev,
      regrasPorPorte: {
        ...prev.regrasPorPorte,
        [porte]: { ...prev.regrasPorPorte[porte], [field]: value },
      },
    }));
    setErrors((prev) => ({ ...prev, [`${porte}_${field}`]: null }));
  };

  // Limpar formulário e sair do modo edição
  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setEditMode(false);
    setEditServicoId(null);
    setEditServicoAtivo(true);
    setErro('');
  };

  // Preencher formulário para edição de um serviço existente
  const handleEditClick = (servico) => {
    const regrasDoServico = regras.filter(r => r.tipoServicoId === servico.id);

    const precos = regrasDoServico.map(r => Number(r.precoBase));
    const precoUnico = new Set(precos).size === 1;
    const temRegras = regrasDoServico.length > 0;

    const regrasPorPorte = initRegrasPorPorte();
    regrasDoServico.forEach(r => {
      regrasPorPorte[r.porteAnimal] = {
        precoBase: String(r.precoBase),
        duracaoMinutos: String(r.duracaoMinutos),
      };
    });

    setForm({
      nomeServico: servico.tipo,
      requiresSize: temRegras && !precoUnico,
      precoUnico: temRegras && precoUnico ? String(regrasDoServico[0].precoBase) : '',
      duracaoUnica: temRegras && precoUnico ? String(regrasDoServico[0].duracaoMinutos) : '',
      regrasPorPorte,
    });

    setErrors({});
    setEditMode(true);
    setEditServicoId(servico.id);
    setEditServicoAtivo(servico.ativo);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const validateForm = () => {
    const errs = {};
    if (!form.nomeServico.trim()) errs.nomeServico = 'O nome do serviço é obrigatório.';

    if (form.requiresSize) {
      PORTES.forEach(({ value }) => {
        const r = form.regrasPorPorte[value];
        if (!r.precoBase || Number(r.precoBase) <= 0) errs[`${value}_precoBase`] = 'Obrigatório';
        if (!r.duracaoMinutos || Number(r.duracaoMinutos) <= 0) errs[`${value}_duracaoMinutos`] = 'Obrigatório';
      });
    } else {
      if (!form.precoUnico || Number(form.precoUnico) <= 0) errs.precoUnico = 'Preço base obrigatório.';
      if (!form.duracaoUnica || Number(form.duracaoUnica) <= 0) errs.duracaoUnica = 'Duração obrigatória.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildRegrasPayload = (tipoServicoId) => {
    if (form.requiresSize) {
      return PORTES.map(({ value }) => ({
        tipoServicoId,
        porteAnimal: value,
        precoBase: Number(form.regrasPorPorte[value].precoBase),
        duracaoMinutos: Number(form.regrasPorPorte[value].duracaoMinutos),
      }));
    }
    return PORTES.map(({ value }) => ({
      tipoServicoId,
      porteAnimal: value,
      precoBase: Number(form.precoUnico),
      duracaoMinutos: Number(form.duracaoUnica),
    }));
  };

  // ── REATIVAR (Execução após confirmação) ──────────────────────────────────
  const handleConfirmReativar = async () => {
    if (!editServicoId) return;

    setReactivateConfirmOpen(false);
    setLoadingSubmit(true);
    setErro('');
    setSucesso('');

    try {
      const res = await fetch(`${API_BASE_URL}/servicos/${editServicoId}/reativar`, {
        method: 'POST',
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        let errorMessage = 'Erro ao reativar serviço.';
        if (contentType.includes('application/json')) {
          const errData = await res.json();
          errorMessage = errData.error || errorMessage;
        } else {
          const text = await res.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setSucesso('Serviço reativado com sucesso!');
      resetForm();
      await loadData();
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // ── ATUALIZAR (Execução após confirmação) ──────────────────────────────────
  const handleConfirmUpdate = async () => {
    setUpdateConfirmOpen(false);
    setLoadingSubmit(true);
    setErro('');
    setSucesso('');

    try {
      const regrasPayload = buildRegrasPayload(editServicoId);

      const resUpdate = await fetch(`${API_BASE_URL}/servicos/${editServicoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: form.nomeServico.trim(),
          regrasPreco: regrasPayload,
        }),
      });

      if (!resUpdate.ok) {
        const errData = await resUpdate.json();
        throw new Error(errData.error || 'Erro ao atualizar serviço.');
      }

      setSucesso('Serviço atualizado com sucesso!');
      resetForm();
      await loadData();
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editMode && editServicoId) {
      // Abre diálogo de confirmação em vez de submeter logo
      setUpdateConfirmOpen(true);
    } else {
      // Fluxo normal para criação (POST)
      setLoadingSubmit(true);
      setErro('');
      setSucesso('');

      try {
        const resServico = await fetch(`${API_BASE_URL}/servicos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: form.nomeServico.trim() }),
        });
        if (!resServico.ok) throw new Error('Erro ao criar serviço.');
        const novoServico = await resServico.json();

        const regrasPayload = buildRegrasPayload(novoServico.id);

        await Promise.all(regrasPayload.map(r =>
          fetch(`${API_BASE_URL}/regras-preco`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(r),
          })
        ));

        setSucesso('Serviço criado com sucesso.');
        setForm(initialForm);
        await loadData();
      } catch (e) {
        setErro(e.message);
      } finally {
        setLoadingSubmit(false);
      }
    }
  };

  // ── INATIVAR (Execução após confirmação) ──────────────────────────────────
  const handleConfirmDelete = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/servicos/${servicoToDelete.id}`, { method: 'DELETE' });

      if (!res.ok) {
        // Ler sempre o body para obter a mensagem da API
        const errData = await res.json().catch(() => ({}));

        if (res.status === 409) {
          // Agendamentos futuros — mensagem descritiva vinda do servidor
          throw new Error(errData.error || 'Não é possível inativar o serviço porque tem agendamentos futuros associados.');
        }

        throw new Error(errData.error || 'Erro ao inativar serviço.');
      }

      if (editMode && editServicoId === servicoToDelete.id) {
        resetForm();
      }

      setSucesso(`Serviço "${servicoToDelete.tipo}" inativado com sucesso!`);
      await loadData();
    } catch (err) {
      setErro(err.message);
    } finally {
      setDeleteDialogOpen(false);
      setServicoToDelete(null);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Gestão de Serviços
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Cria e edita serviços, define se o preço varia por porte e configura as regras de preço e duração.
      </Typography>

      {loadingInitial ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
          <CircularProgress color="primary" />
          <Typography sx={{ color: colors.textSecondary }}>A carregar dados...</Typography>
        </Box>
      ) : (
        <>
          {/* ── FORMULÁRIO DE CRIAÇÃO / EDIÇÃO ─────────────────────────────── */}
          <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Cabeçalho do formulário */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h2" sx={{ color: colors.text }}>
                    {editMode ? 'Editar Serviço' : 'Criar Novo Serviço'}
                  </Typography>
                  {editMode && (
                    <Chip
                      size="small"
                      label={editServicoAtivo ? 'Modo edição' : 'Serviço Inativo'}
                      color={editServicoAtivo ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  )}
                </Box>

                {/* Botão Reativar */}
                {editMode && !editServicoAtivo && (
                  <Button
                    variant="outlined"
                    color="success"
                    startIcon={<RestoreIcon />}
                    onClick={() => setReactivateConfirmOpen(true)}
                    disabled={loadingSubmit}
                    size="small"
                  >
                    Reativar Serviço
                  </Button>
                )}
              </Box>

              {sucesso && <Alert severity="success" onClose={() => setSucesso('')}>{sucesso}</Alert>}
              {erro    && <Alert severity="error"   onClose={() => setErro('')}>{erro}</Alert>}

              {/* Aviso de serviço inativo */}
              {editMode && !editServicoAtivo && (
                <Alert severity="warning">
                  Este serviço está inativo. Pode reativá-lo clicando em <strong>Reativar Serviço</strong>, ou editar os seus dados e guardá-los (o serviço continuará inativo até ser reativado).
                </Alert>
              )}

              {/* Nota informativa sobre histórico — visível apenas em modo edição */}
              {editMode && (
                <Alert
                  severity="info"
                  icon={<InfoOutlinedIcon fontSize="inherit" />}
                >
                  As alterações às regras de preço aplicam-se apenas a <strong>novos agendamentos</strong>. O histórico de agendamentos passados mantém os preços e durações registados no momento da marcação.
                </Alert>
              )}

              {/* Nome + toggle preço por porte */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="Nome do serviço"
                  value={form.nomeServico}
                  onChange={(e) => {
                    setForm({ ...form, nomeServico: e.target.value });
                    setErrors((prev) => ({ ...prev, nomeServico: null }));
                  }}
                  error={!!errors.nomeServico}
                  helperText={errors.nomeServico}
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.requiresSize}
                      onChange={(e) => setForm({ ...form, requiresSize: e.target.checked })}
                    />
                  }
                  label="Preço por porte"
                  sx={{ mt: 1 }}
                />
              </Box>

              {/* Campos de preço */}
              {!form.requiresSize ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="Preço base (€)"
                    type="number"
                    value={form.precoUnico}
                    onChange={(e) => {
                      setForm({ ...form, precoUnico: e.target.value });
                      setErrors((prev) => ({ ...prev, precoUnico: null }));
                    }}
                    error={!!errors.precoUnico}
                    helperText={errors.precoUnico}
                    fullWidth
                    inputProps={{ min: 0.01, step: 0.01 }}
                  />
                  <TextField
                    label="Duração (min)"
                    type="number"
                    value={form.duracaoUnica}
                    onChange={(e) => {
                      setForm({ ...form, duracaoUnica: e.target.value });
                      setErrors((prev) => ({ ...prev, duracaoUnica: null }));
                    }}
                    error={!!errors.duracaoUnica}
                    helperText={errors.duracaoUnica}
                    fullWidth
                    inputProps={{ min: 1, step: 1 }}
                  />
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f0e8', textAlign: 'left' }}>
                        <th style={{ padding: '10px', fontWeight: 700, fontSize: '0.8rem', color: colors.text }}>Porte</th>
                        <th style={{ padding: '10px', fontWeight: 700, fontSize: '0.8rem', color: colors.text }}>Preço (€)</th>
                        <th style={{ padding: '10px', fontWeight: 700, fontSize: '0.8rem', color: colors.text }}>Duração (min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PORTES.map((p) => (
                        <tr key={p.value} style={{ borderBottom: '1px solid #ede8e0' }}>
                          <td style={{ padding: '10px' }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.label}</Typography>
                              <Typography variant="caption" sx={{ color: colors.textSecondary }}>{p.range}</Typography>
                            </Box>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <TextField
                              size="small"
                              type="number"
                              value={form.regrasPorPorte[p.value].precoBase}
                              onChange={(e) => updateRegraPorte(p.value, 'precoBase', e.target.value)}
                              error={!!errors[`${p.value}_precoBase`]}
                              helperText={errors[`${p.value}_precoBase`]}
                              inputProps={{ min: 0.01, step: 0.01 }}
                              sx={{ width: 120 }}
                            />
                          </td>
                          <td style={{ padding: '10px' }}>
                            <TextField
                              size="small"
                              type="number"
                              value={form.regrasPorPorte[p.value].duracaoMinutos}
                              onChange={(e) => updateRegraPorte(p.value, 'duracaoMinutos', e.target.value)}
                              error={!!errors[`${p.value}_duracaoMinutos`]}
                              helperText={errors[`${p.value}_duracaoMinutos`]}
                              inputProps={{ min: 1, step: 1 }}
                              sx={{ width: 120 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}

              {/* Botões do formulário */}
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loadingSubmit}
                  startIcon={editMode ? <SaveIcon /> : null}
                  sx={{
                    flex: 1,
                    py: 1.5,
                    backgroundColor: colors.primary,
                    '&:hover': { backgroundColor: `${colors.primary}dd` },
                  }}
                >
                  {loadingSubmit
                    ? <CircularProgress size={24} sx={{ color: colors.white }} />
                    : (editMode ? 'Atualizar Serviço' : 'Criar Serviço')}
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

          {/* ── LISTA DE SERVIÇOS REGISTADOS ───────────────────────────────── */}
          <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="h2" sx={{ mb: 2, color: colors.text }}>
              Serviços Registados
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {servicosOrdenados.map((s) => {
                const { count: nRegras, precoUnico } = getRegraInfo(s.id);
                const ordemPortes = PORTES.map(p => p.value);
                const regrasDoServico = regras
                  .filter(r => r.tipoServicoId === s.id)
                  .sort((a, b) => ordemPortes.indexOf(a.porteAnimal) - ordemPortes.indexOf(b.porteAnimal));

                const isBeingEdited = editMode && editServicoId === s.id;

                return (
                  <Paper
                    key={s.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      opacity: s.ativo ? 1 : 0.6,
                      borderStyle: s.ativo ? 'solid' : 'dashed',
                      borderColor: isBeingEdited ? colors.primary : undefined,
                      boxShadow: isBeingEdited ? `0 0 0 2px ${colors.primary}33` : undefined,
                      transition: 'all 0.2s',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                          <ContentCutIcon sx={{ color: colors.primary }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{s.tipo}</Typography>
                          <Chip
                            label={s.ativo ? 'Ativo' : 'Inativo'}
                            size="small"
                            color={s.ativo ? 'success' : 'default'}
                          />
                          {isBeingEdited && (
                            <Chip
                              label="A editar"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Box>

                        <Box sx={{ mt: 1 }}>
                          {nRegras === 0 ? (
                            <Typography variant="body2" sx={{ color: 'gray' }}>Sem regras configuradas.</Typography>
                          ) : precoUnico ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Chip
                                label="Preço único"
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '10px', alignSelf: 'flex-start', mb: 0.5 }}
                              />
                              <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.85rem' }}>
                                • <strong>Preço:</strong> €{regrasDoServico[0]?.precoBase} ({regrasDoServico[0]?.duracaoMinutos} min)
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Chip
                                label="Preço por porte"
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ mb: 1, height: 20, fontSize: '10px', alignSelf: 'flex-start' }}
                              />
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {regrasDoServico.map((r) => (
                                  <Typography key={r.id} variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.85rem' }}>
                                    • <strong>{getPorteLabel(r.porteAnimal)}:</strong> €{r.precoBase} ({r.duracaoMinutos} min)
                                  </Typography>
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Botões de ação */}
                      <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(s)}
                          sx={{ color: colors.primary }}
                          title="Editar serviço"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {s.ativo && (
                          <IconButton
                            size="small"
                            onClick={() => { setServicoToDelete(s); setDeleteDialogOpen(true); }}
                            sx={{ color: colors.textSecondary }}
                            title="Inativar serviço"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        </>
      )}

      {/* ── DIÁLOGO: CONFIRMAR ATUALIZAÇÃO ────────────────────────────────── */}
      <ConfirmDialog
        open={updateConfirmOpen}
        title="Confirmar Alterações"
        message={
          <>
            <Typography>
              Tem a certeza que pretende guardar as alterações no serviço <strong>"{form.nomeServico}"</strong>?
            </Typography>
            <Typography sx={{ mt: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
              Os agendamentos já existentes não são afectados — mantêm os preços e durações registados no momento da marcação.
            </Typography>
          </>
        }
        confirmLabel="Guardar"
        confirmColor="primary"
        onConfirm={handleConfirmUpdate}
        onClose={() => setUpdateConfirmOpen(false)}
      />

      {/* ── DIÁLOGO: CONFIRMAR REATIVAÇÃO ─────────────────────────────────── */}
      <ConfirmDialog
        open={reactivateConfirmOpen}
        title="Reativar Serviço"
        message={
          <Typography>
            Deseja reativar o serviço <strong>"{form.nomeServico}"</strong>? Ele voltará a estar disponível para agendamentos.
          </Typography>
        }
        confirmLabel="Reativar"
        confirmColor="success"
        onConfirm={handleConfirmReativar}
        onClose={() => setReactivateConfirmOpen(false)}
      />

      {/* ── DIÁLOGO: INATIVAR ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Inativar Serviço"
        message={
          <>
            <Typography>
              Tem a certeza que pretende inativar o serviço <strong>"{servicoToDelete?.tipo}"</strong>?
            </Typography>
            <Typography sx={{ mt: 1 }}>
              O serviço ficará indisponível para novos agendamentos. Pode consultar o histórico existente normalmente.
            </Typography>
            <Typography sx={{ mt: 1, fontSize: '0.875rem', color: 'warning.main' }}>
              A operação será recusada se existirem agendamentos futuros associados a este serviço.
            </Typography>
          </>
        }
        confirmLabel="Inativar"
        confirmColor="warning"
        onConfirm={handleConfirmDelete}
        onClose={() => { setDeleteDialogOpen(false); setServicoToDelete(null); }}
      />
    </Box>
  );
}