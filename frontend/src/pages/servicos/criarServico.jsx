import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Alert,
  Stepper, Step, StepLabel, TextField, Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import { useThemeContext } from '../../contexts/ThemeContext';
import './criarServico.css';

// ── Metadados dos tipos de serviço ──────────────────────
const TIPO_META = {
  BANHO:               { icon: '🛁', label: 'Banho',                 sub: 'Requer porte',  requiresSize: true  },
  TOSQUIA_COMPLETA:    { icon: '✂️', label: 'Tosquia Completa',       sub: 'Requer porte',  requiresSize: true  },
  TOSQUIA_HIGIENICA:   { icon: '🪮', label: 'Tosquia Higiénica',      sub: 'Requer porte',  requiresSize: true  },
  CORTE_UNHAS:         { icon: '💅', label: 'Corte de Unhas',         sub: 'Preço único',   requiresSize: false },
  LIMPEZA_OUVIDOS:     { icon: '👂', label: 'Limpeza de Ouvidos',     sub: 'Preço único',   requiresSize: false },
  EXPRESSAO_GLANDULAS: { icon: '💉', label: 'Expressão de Glândulas', sub: 'Preço único',   requiresSize: false },
  LIMPEZA_DENTES:      { icon: '🦷', label: 'Limpeza de Dentes',      sub: 'Preço único',   requiresSize: false },
  APARAR_PELO_CARA:    { icon: '🐾', label: 'Aparar Pelo da Cara',    sub: 'Preço único',   requiresSize: false },
  ANTI_PULGAS:         { icon: '🦟', label: 'Anti-Pulgas',            sub: 'Preço único',   requiresSize: false },
  ANTI_QUEDA:          { icon: '🧴', label: 'Anti-Queda',             sub: 'Preço único',   requiresSize: false },
  REMOCAO_NOS:         { icon: '🪢', label: 'Remoção de Nós',         sub: 'Preço único',   requiresSize: false },
};

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

export default function CriarServicoPage() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const [step, setStep]                       = useState(0); // MUI Stepper é 0-indexed
  const [tipoSelecionado, setTipo]             = useState(null);
  const [tiposExistentes, setTiposExistentes]  = useState(new Set());
  const [regrasPorPorte, setRegrasPorPorte]    = useState(initRegrasPorPorte());
  const [precoUnico, setPrecoUnico]            = useState('');
  const [duracaoUnica, setDuracaoUnica]        = useState('');
  const [submitting, setSubmitting]            = useState(false);
  const [submitError, setSubmitError]          = useState('');
  const [submitSuccess, setSubmitSuccess]      = useState('');
  const [errors, setErrors]                    = useState({});

  useEffect(() => {
    fetch(`${API_BASE_URL}/servicos`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTiposExistentes(new Set(data.map((s) => s.tipo))))
      .catch(() => {});
  }, [API_BASE_URL]);

  const meta = tipoSelecionado ? TIPO_META[tipoSelecionado] : null;

  function updateRegraPorte(porte, field, value) {
    setRegrasPorPorte((prev) => ({ ...prev, [porte]: { ...prev[porte], [field]: value } }));
    setErrors((prev) => ({ ...prev, [`${porte}_${field}`]: null }));
  }

  function validateStep2() {
    const errs = {};
    if (meta.requiresSize) {
      PORTES.forEach(({ value }) => {
        const r = regrasPorPorte[value];
        if (!r.precoBase || Number(r.precoBase) <= 0)       errs[`${value}_precoBase`] = 'Obrigatório';
        if (!r.duracaoMinutos || Number(r.duracaoMinutos) <= 0) errs[`${value}_duracaoMinutos`] = 'Obrigatório';
      });
    } else {
      if (!precoUnico || Number(precoUnico) <= 0)     errs['precoUnico']  = 'Preço base obrigatório e deve ser positivo';
      if (!duracaoUnica || Number(duracaoUnica) <= 0) errs['duracaoUnica'] = 'Duração obrigatória e deve ser positiva';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const resServico = await fetch(`${API_BASE_URL}/servicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoSelecionado }),
      });
      if (!resServico.ok) {
        const err = await resServico.json();
        throw new Error(err.error || 'Erro ao criar serviço');
      }
      const novoServico = await resServico.json();
      const tipoServicoId = novoServico.id;

      const regrasPayload = meta.requiresSize
        ? PORTES.map(({ value }) => ({
            tipoServicoId,
            porteAnimal: value,
            precoBase: Number(regrasPorPorte[value].precoBase),
            duracaoMinutos: Number(regrasPorPorte[value].duracaoMinutos),
          }))
        : [{ tipoServicoId, porteAnimal: 'MEDIO', precoBase: Number(precoUnico), duracaoMinutos: Number(duracaoUnica) }];

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
        throw new Error(err.error || 'Erro ao criar regras de preço');
      }

      setSubmitSuccess(`Serviço "${meta.label}" criado com sucesso!`);
      setTimeout(() => navigate('/servicos'), 1800);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/servicos')}
          sx={{ color: colors.primary, minWidth: 'auto', px: 1 }}
        >
          Voltar
        </Button>
        <Typography variant="body1" sx={{ color: colors.textSecondary }}>/</Typography>
        <Typography variant="body1" sx={{ color: colors.text, fontWeight: 600 }}>Novo Serviço</Typography>
      </Box>

      <Typography variant="h1" sx={{ mb: 0.5, color: colors.text }}>Criar Novo Serviço</Typography>
      <Typography variant="body1" sx={{ mb: 3, color: colors.textSecondary }}>
        Define o tipo de serviço e as regras de preço por porte de animal.
      </Typography>

      {/* Stepper */}
      <Stepper activeStep={step} sx={{ mb: 3 }}>
        <Step>
          <StepLabel>Tipo de Serviço</StepLabel>
        </Step>
        <Step>
          <StepLabel>Preços &amp; Duração</StepLabel>
        </Step>
      </Stepper>

      {/* ── STEP 0: Escolha do tipo ── */}
      {step === 0 && (
        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h2" sx={{ color: colors.text, mb: 2 }}>
              Escolhe o tipo de serviço
            </Typography>
            <div className="tipo-grid">
              {Object.entries(TIPO_META).map(([value, info]) => {
                const jaExiste = tiposExistentes.has(value);
                return (
                  <button
                    key={value}
                    type="button"
                    className={[
                      'tipo-option',
                      tipoSelecionado === value ? 'selected' : '',
                      jaExiste ? 'disabled' : '',
                    ].join(' ')}
                    onClick={() => !jaExiste && setTipo(value)}
                    title={jaExiste ? 'Este serviço já está registado' : info.label}
                  >
                    <span className="tipo-option-icon">{info.icon}</span>
                    <span className="tipo-option-info">
                      <span className="tipo-option-label">{info.label}</span>
                      <span className="tipo-option-sub">
                        {jaExiste ? '⚠️ Já existe' : info.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, px: 3, py: 2, borderTop: '1px solid #ede8e0' }}>
            <Button variant="outlined" onClick={() => navigate('/servicos')}
              sx={{ borderColor: colors.primary, color: colors.primary }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              disabled={!tipoSelecionado}
              onClick={() => setStep(1)}
              sx={{ backgroundColor: colors.primary, '&:hover': { backgroundColor: colors.primary + 'dd' } }}
            >
              Continuar
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── STEP 1: Preços e duração ── */}
      {step === 1 && meta && (
        <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h2" sx={{ color: colors.text, mb: 2 }}>
              {meta.icon} {meta.label}
            </Typography>

            {submitSuccess && <Alert severity="success" sx={{ mb: 2 }}>{submitSuccess}</Alert>}
            {submitError  && <Alert severity="error"   sx={{ mb: 2 }}>{submitError}</Alert>}

            {meta.requiresSize ? (
              /* Tabela de preços por porte */
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Este serviço varia consoante o porte do animal. Preenche o preço base e a duração estimada para cada porte.
                </Alert>
                <div className="regras-table-wrap">
                  <table className="regras-table">
                    <thead>
                      <tr>
                        <th>Porte</th>
                        <th>Intervalo de peso</th>
                        <th>Preço base (€)</th>
                        <th>Duração (min)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PORTES.map(({ value, label, range }) => (
                        <tr key={value}>
                          <td>
                            <Chip label={label} size="small" sx={{
                              fontWeight: 700, fontSize: '0.75rem',
                              backgroundColor: 'rgba(71,92,81,0.08)',
                              color: colors.primary,
                              border: `1px solid ${colors.primary}44`,
                            }} />
                          </td>
                          <td style={{ color: colors.textSecondary, fontSize: '0.82rem' }}>{range}</td>
                          <td>
                            <input
                              type="number" min="0" step="0.01" placeholder="ex: 25.00"
                              value={regrasPorPorte[value].precoBase}
                              onChange={(e) => updateRegraPorte(value, 'precoBase', e.target.value)}
                              className={`input-inline ${errors[`${value}_precoBase`] ? 'error' : ''}`}
                            />
                          </td>
                          <td>
                            <input
                              type="number" min="1" step="1" placeholder="ex: 60"
                              value={regrasPorPorte[value].duracaoMinutos}
                              onChange={(e) => updateRegraPorte(value, 'duracaoMinutos', e.target.value)}
                              className={`input-inline ${errors[`${value}_duracaoMinutos`] ? 'error' : ''}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              /* Preço único */
              <>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Este serviço tem um preço único independente do porte do animal.
                </Alert>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <TextField
                    label="Preço base (€)"
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    placeholder="ex: 15.00"
                    value={precoUnico}
                    onChange={(e) => { setPrecoUnico(e.target.value); setErrors((p) => ({ ...p, precoUnico: null })); }}
                    error={!!errors.precoUnico}
                    helperText={errors.precoUnico}
                    sx={{ width: 180, backgroundColor: 'white', borderRadius: 1 }}
                  />
                  <TextField
                    label="Duração estimada (min)"
                    type="number"
                    inputProps={{ min: 1, step: 1 }}
                    placeholder="ex: 30"
                    value={duracaoUnica}
                    onChange={(e) => { setDuracaoUnica(e.target.value); setErrors((p) => ({ ...p, duracaoUnica: null })); }}
                    error={!!errors.duracaoUnica}
                    helperText={errors.duracaoUnica || 'Usado para bloquear o calendário'}
                    sx={{ width: 220, backgroundColor: 'white', borderRadius: 1 }}
                  />
                </Box>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, px: 3, py: 2, borderTop: '1px solid #ede8e0' }}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => setStep(0)}
              sx={{ borderColor: colors.primary, color: colors.primary }}>
              Voltar
            </Button>
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              disabled={submitting}
              onClick={handleSubmit}
              sx={{ backgroundColor: colors.primary, '&:hover': { backgroundColor: colors.primary + 'dd' } }}
            >
              {submitting ? 'A guardar…' : 'Criar Serviço'}
            </Button>
          </Box>
        </Paper>
      )}
    </>
  );
}