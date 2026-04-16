import React, { useEffect, useState, useMemo } from 'react';
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
import ContentCutIcon from '@mui/icons-material/ContentCut';

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

  const [deleteDialogOpen, setDeleteDialogOpen]   = useState(false);
  const [servicoToDelete, setServicoToDelete]     = useState(null);

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
      const regrasData = await resRegras.json();
      
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoadingSubmit(true);
    try {
      const resServico = await fetch(`${API_BASE_URL}/servicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: form.nomeServico.trim() }),
      });
      if (!resServico.ok) throw new Error('Erro ao criar serviço.');
      const novoServico = await resServico.json();

      const regrasPayload = form.requiresSize
        ? PORTES.map(({ value }) => ({
            tipoServicoId: novoServico.id,
            porteAnimal: value,
            precoBase: Number(form.regrasPorPorte[value].precoBase),
            duracaoMinutos: Number(form.regrasPorPorte[value].duracaoMinutos),
          }))
        : PORTES.map(({ value }) => ({
            tipoServicoId: novoServico.id,
            porteAnimal: value,
            precoBase: Number(form.precoUnico),
            duracaoMinutos: Number(form.duracaoUnica),
          }));

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
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/servicos/${servicoToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao inativar serviço.');
      setSucesso(`Serviço inativado com sucesso!`);
      await loadData();
    } catch (err) {
      setErro(err.message);
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Gestão de Serviços
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Cria serviços, define se o preço varia por porte e configura as regras de preço e duração.
      </Typography>

      {/* VERIFICAÇÃO DE CARREGAMENTO INICIAL */}
      {loadingInitial ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
          <CircularProgress color="primary" />
          <Typography sx={{ color: colors.textSecondary }}>A carregar dados...</Typography>
        </Box>
      ) : (
        <>
          {/* FORMULÁRIO DE CRIAÇÃO */}
          <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h2" sx={{ color: colors.text }}>Criar Novo Serviço</Typography>
              {sucesso && <Alert severity="success" onClose={() => setSucesso('')}>{sucesso}</Alert>}
              {erro && <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert>}

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="Nome do serviço"
                  value={form.nomeServico}
                  onChange={(e) => setForm({ ...form, nomeServico: e.target.value })}
                  error={!!errors.nomeServico}
                  helperText={errors.nomeServico}
                  fullWidth
                />
                <FormControlLabel
                  control={<Switch checked={form.requiresSize} onChange={(e) => setForm({ ...form, requiresSize: e.target.checked })} />}
                  label="Preço por porte"
                  sx={{ mt: 1 }}
                />
              </Box>

              {!form.requiresSize ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <TextField label="Preço base (€)" type="number" value={form.precoUnico} onChange={(e) => setForm({ ...form, precoUnico: e.target.value })} error={!!errors.precoUnico} fullWidth />
                  <TextField label="Duração (min)" type="number" value={form.duracaoUnica} onChange={(e) => setForm({ ...form, duracaoUnica: e.target.value })} error={!!errors.duracaoUnica} fullWidth />
                </Box>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f0e8', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Porte</th>
                        <th style={{ padding: '10px' }}>Preço (€)</th>
                        <th style={{ padding: '10px' }}>Duração (min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PORTES.map((p) => (
                        <tr key={p.value} style={{ borderBottom: '1px solid #ede8e0' }}>
                          <td style={{ padding: '10px' }}>{p.label}</td>
                          <td style={{ padding: '10px' }}>
                            <TextField size="small" type="number" value={form.regrasPorPorte[p.value].precoBase} onChange={(e) => updateRegraPorte(p.value, 'precoBase', e.target.value)} error={!!errors[`${p.value}_precoBase`]} />
                          </td>
                          <td style={{ padding: '10px' }}>
                            <TextField size="small" type="number" value={form.regrasPorPorte[p.value].duracaoMinutos} onChange={(e) => updateRegraPorte(p.value, 'duracaoMinutos', e.target.value)} error={!!errors[`${p.value}_duracaoMinutos`]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}

              <Button type="submit" variant="contained" disabled={loadingSubmit} sx={{ backgroundColor: colors.primary, alignSelf: 'flex-start', py: 1.5, px: 4 }}>
                {loadingSubmit ? <CircularProgress size={24} /> : 'Criar Serviço'}
              </Button>
            </Box>
          </Paper>

          {/* LISTA DE SERVIÇOS REGISTADOS */}
          <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="h2" sx={{ mb: 2, color: colors.text }}>Serviços Registados</Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {servicosOrdenados.map((s) => {
                const { count: nRegras, precoUnico } = getRegraInfo(s.id);
                const ordemPortes = PORTES.map(p => p.value);
                const regrasDoServico = regras
                  .filter(r => r.tipoServicoId === s.id)
                  .sort((a, b) => ordemPortes.indexOf(a.porteAnimal) - ordemPortes.indexOf(b.porteAnimal));

                return (
                  <Paper key={s.id} variant="outlined" sx={{ p: 2, borderRadius: 2, opacity: s.ativo ? 1 : 0.6 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ContentCutIcon sx={{ color: colors.primary }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{s.tipo}</Typography>
                          <Chip label={s.ativo ? 'Ativo' : 'Inativo'} size="small" color={s.ativo ? 'success' : 'default'} />
                        </Box>

                        <Box sx={{ mt: 1 }}>
                          {nRegras === 0 ? (
                            <Typography variant="body2" sx={{ color: 'gray' }}>Sem regras configuradas.</Typography>
                          ) : precoUnico ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Chip label="Preço único" size="small" variant="outlined" sx={{ height: 20, fontSize: '10px', alignSelf: 'flex-start', mb: 0.5 }} />
                              <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.85rem' }}>
                                • <strong>Preço:</strong> €{regrasDoServico[0]?.precoBase} ({regrasDoServico[0]?.duracaoMinutos} min)
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Chip label="Preço por porte" size="small" color="primary" variant="outlined" sx={{ mb: 1, height: 20, fontSize: '10px', alignSelf: 'flex-start' }} />
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

                      {s.ativo && (
                        <IconButton size="small" onClick={() => { setServicoToDelete(s); setDeleteDialogOpen(true); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        </>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Inativar Serviço"
        message={`Tem a certeza que pretende inativar o serviço "${servicoToDelete?.tipo}"?`}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}