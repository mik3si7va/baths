import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';

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

  const [form, setForm]                   = useState(initialForm);
  const [servicos, setServicos]           = useState([]);
  const [regras, setRegras]               = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [erro, setErro]                   = useState('');
  const [sucesso, setSucesso]             = useState('');
  const [errors, setErrors]               = useState({});

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
      setServicos(await resServicos.json());
      setRegras(await resRegras.json());
    } catch (e) {
      setErro(e.message || 'Erro ao carregar dados.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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

    if (!form.nomeServico.trim()) {
      errs.nomeServico = 'O nome do serviço é obrigatório.';
    }

    if (form.requiresSize) {
      PORTES.forEach(({ value }) => {
        const r = form.regrasPorPorte[value];
        if (!r.precoBase || Number(r.precoBase) <= 0)
          errs[`${value}_precoBase`] = 'Obrigatório';
        if (!r.duracaoMinutos || Number(r.duracaoMinutos) <= 0)
          errs[`${value}_duracaoMinutos`] = 'Obrigatório';
      });
    } else {
      if (!form.precoUnico || Number(form.precoUnico) <= 0)
        errs.precoUnico = 'Preço base obrigatório e deve ser positivo.';
      if (!form.duracaoUnica || Number(form.duracaoUnica) <= 0)
        errs.duracaoUnica = 'Duração obrigatória e deve ser positiva.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!validateForm()) return;

    setLoadingSubmit(true);
    try {
      const resServico = await fetch(`${API_BASE_URL}/servicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: form.nomeServico.trim() }),
      });
      if (!resServico.ok) {
        const err = await resServico.json();
        throw new Error(err.error || 'Erro ao criar serviço.');
      }
      const novoServico = await resServico.json();
      const tipoServicoId = novoServico.id;

      const regrasPayload = form.requiresSize
        ? PORTES.map(({ value }) => ({
            tipoServicoId,
            porteAnimal: value,
            precoBase: Number(form.regrasPorPorte[value].precoBase),
            duracaoMinutos: Number(form.regrasPorPorte[value].duracaoMinutos),
          }))
        : [{
            tipoServicoId,
            porteAnimal: 'MEDIO',
            precoBase: Number(form.precoUnico),
            duracaoMinutos: Number(form.duracaoUnica),
          }];

      const resRegras = await Promise.all(
        regrasPayload.map((regra) =>
          fetch(`${API_BASE_URL}/regras-preco`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regra),
          })
        )
      );
      const falhou = resRegras.find((r) => !r.ok);
      if (falhou) {
        const err = await falhou.json();
        throw new Error(err.error || 'Erro ao criar regras de preço.');
      }

      setSucesso('Serviço criado com sucesso.');
      setForm(initialForm);
      await loadData();
    } catch (e) {
      setErro(e.message || 'Erro ao criar serviço.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const regrasCountByServico = regras.reduce((acc, r) => {
    acc[r.tipoServicoId] = (acc[r.tipoServicoId] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Gestão de Serviços
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Cria serviços com nome livre, define se o preço varia por porte e configura as regras de preço.
      </Typography>

      {/* ── Formulário de criação ── */}
      <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sucesso && <Alert severity="success">{sucesso}</Alert>}
          {erro    && <Alert severity="error">{erro}</Alert>}

          {/* Nome + toggle */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 2, alignItems: 'flex-start' }}>
            <TextField
              label="Nome do serviço"
              placeholder="Ex: Banho completo, Tosquia, Corte de unhas..."
              value={form.nomeServico}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, nomeServico: e.target.value }));
                setErrors((prev) => ({ ...prev, nomeServico: null }));
              }}
              error={!!errors.nomeServico}
              helperText={errors.nomeServico}
              required
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.requiresSize}
                  onChange={(e) => setForm((prev) => ({ ...prev, requiresSize: e.target.checked }))}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: colors.primary },
                  }}
                />
              }
              label={
                <Typography variant="body1" sx={{ color: colors.text, whiteSpace: 'nowrap' }}>
                  Preço por porte
                </Typography>
              }
              sx={{ mt: { xs: 0, md: 1 } }}
            />
          </Box>

          {/* Preço único */}
          {!form.requiresSize && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
              <TextField
                label="Preço base (€)"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="ex: 15.00"
                value={form.precoUnico}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, precoUnico: e.target.value }));
                  setErrors((prev) => ({ ...prev, precoUnico: null }));
                }}
                error={!!errors.precoUnico}
                helperText={errors.precoUnico}
                fullWidth
              />
              <TextField
                label="Duração estimada (min)"
                type="number"
                inputProps={{ min: 1, step: 1 }}
                placeholder="ex: 30"
                value={form.duracaoUnica}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, duracaoUnica: e.target.value }));
                  setErrors((prev) => ({ ...prev, duracaoUnica: null }));
                }}
                error={!!errors.duracaoUnica}
                helperText={errors.duracaoUnica}
                fullWidth
              />
            </Box>
          )}

          {/* Tabela de preços por porte */}
          {form.requiresSize && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Preenche o preço base e a duração estimada para cada porte de animal.
              </Alert>
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f5f0e8', borderBottom: '2px solid #e0dbd0' }}>
                      {['Porte', 'Peso', 'Preço base (€)', 'Duração (min)'].map((h) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#102622' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PORTES.map(({ value, label, range }) => (
                      <tr key={value} style={{ borderBottom: '1px solid #ede8e0' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <Chip label={label} size="small" sx={{ fontWeight: 700, fontSize: '0.75rem', backgroundColor: 'rgba(71,92,81,0.08)', color: colors.primary, border: `1px solid ${colors.primary}44` }} />
                        </td>
                        <td style={{ padding: '10px 14px', color: colors.textSecondary, fontSize: '0.82rem' }}>{range}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <TextField
                            type="number"
                            size="small"
                            inputProps={{ min: 0, step: 0.01 }}
                            placeholder="ex: 25.00"
                            value={form.regrasPorPorte[value].precoBase}
                            onChange={(e) => updateRegraPorte(value, 'precoBase', e.target.value)}
                            error={!!errors[`${value}_precoBase`]}
                            sx={{ width: 110 }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <TextField
                            type="number"
                            size="small"
                            inputProps={{ min: 1, step: 1 }}
                            placeholder="ex: 60"
                            value={form.regrasPorPorte[value].duracaoMinutos}
                            onChange={(e) => updateRegraPorte(value, 'duracaoMinutos', e.target.value)}
                            error={!!errors[`${value}_duracaoMinutos`]}
                            sx={{ width: 110 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Box>
          )}

          <Button
            type="submit"
            variant="contained"
            disabled={loadingSubmit || loadingInitial}
            sx={{
              mt: 1,
              py: 1.5,
              alignSelf: 'flex-start',
              backgroundColor: colors.primary,
              '&:hover': { backgroundColor: `${colors.primary}dd` },
            }}
          >
            {loadingSubmit ? 'A criar...' : 'Criar Serviço'}
          </Button>
        </Box>
      </Paper>

      {/* ── Lista de serviços registados ── */}
      <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h2" sx={{ color: colors.text }}>
            Serviços registados
          </Typography>
          {loadingInitial && <CircularProgress size={20} />}
        </Box>

        {!loadingInitial && servicos.length === 0 && (
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Ainda não existem serviços registados.
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {servicos.map((s) => {
            const nRegras = regrasCountByServico[s.id] || 0;
            return (
              <Paper key={s.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text }}>
                  {s.tipo}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {nRegras > 0 ? `${nRegras} regra${nRegras !== 1 ? 's' : ''} de preço` : 'Sem regras de preço'}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={s.ativo ? 'Ativo' : 'Inativo'}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      backgroundColor: s.ativo ? 'rgba(34,197,94,0.1)' : '#fef2f2',
                      color: s.ativo ? '#16a34a' : '#dc2626',
                      border: `1px solid ${s.ativo ? 'rgba(34,197,94,0.3)' : '#fecaca'}`,
                    }}
                  />
                  {nRegras > 0 && (
                    <Chip
                      label={nRegras === 5 ? 'Preço por porte' : 'Preço único'}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(71,92,81,0.08)',
                        color: colors.primary,
                        border: `1px solid ${colors.primary}44`,
                      }}
                    />
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}