import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useThemeContext } from '../../../contexts/ThemeContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CARGO_OPTIONS = [
  { value: 'TOSQUIADOR_SENIOR', label: 'Tosquiador Senior' },
  { value: 'TOSQUIADOR', label: 'Tosquiador' },
  { value: 'TOSQUIADOR_ESTAGIARIO', label: 'Tosquiador Estagiario' },
  { value: 'BANHISTA_SENIOR', label: 'Banhista Senior' },
  { value: 'BANHISTA', label: 'Banhista' },
  { value: 'BANHISTA_ESTAGIARIO', label: 'Banhista Estagiario' },
  { value: 'RECECIONISTA', label: 'Rececionista' },
  { value: 'ADMINISTRACAO', label: 'Administracao' },
];

const PORTE_OPTIONS = [
  { value: 'EXTRA_PEQUENO', label: 'Extra pequeno' },
  { value: 'PEQUENO', label: 'Pequeno' },
  { value: 'MEDIO', label: 'Medio' },
  { value: 'GRANDE', label: 'Grande' },
  { value: 'EXTRA_GRANDE', label: 'Extra grande' },
];

const DIA_OPTIONS = [
  { value: 'SEGUNDA', label: 'Segunda' },
  { value: 'TERCA', label: 'Terca' },
  { value: 'QUARTA', label: 'Quarta' },
  { value: 'QUINTA', label: 'Quinta' },
  { value: 'SEXTA', label: 'Sexta' },
  { value: 'SABADO', label: 'Sabado' },
];

function enumLabel(options, value) {
  return options.find((o) => o.value === value)?.label || value;
}

function compareHHmm(a, b) {
  return a.localeCompare(b);
}

const initialForm = {
  nomeCompleto: '',
  cargo: '',
  telefone: '',
  email: '',
  porteAnimais: [],
  tipoServicoIds: [],
  horario: {
    diasSemana: [],
    horaInicio: '09:00',
    horaFim: '18:00',
    pausaInicio: '13:00',
    pausaFim: '14:00',
  },
};

export default function Users() {
  const { colors } = useThemeContext();

  const [form, setForm] = useState(initialForm);
  const [servicos, setServicos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const servicosById = useMemo(() => {
    return Object.fromEntries(servicos.map((s) => [s.id, s.tipo]));
  }, [servicos]);

  const loadData = async () => {
    setLoadingInitial(true);
    setErro('');

    try {
      const [servicosRes, funcionariosRes] = await Promise.all([
        fetch(`${API_BASE_URL}/servicos`),
        fetch(`${API_BASE_URL}/funcionarios`),
      ]);

      if (!servicosRes.ok) {
        throw new Error('Erro ao carregar servicos.');
      }

      if (!funcionariosRes.ok) {
        throw new Error('Erro ao carregar funcionarios.');
      }

      const servicosData = await servicosRes.json();
      const funcionariosData = await funcionariosRes.json();

      setServicos(Array.isArray(servicosData) ? servicosData : []);
      setFuncionarios(Array.isArray(funcionariosData) ? funcionariosData : []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar dados.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleArrayValue = (field, value) => {
    setForm((prev) => {
      const current = prev[field];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      return { ...prev, [field]: next };
    });
  };

  const toggleDiaSemana = (dia) => {
    setForm((prev) => {
      const current = prev.horario.diasSemana;
      const next = current.includes(dia)
        ? current.filter((d) => d !== dia)
        : [...current, dia];

      return {
        ...prev,
        horario: {
          ...prev.horario,
          diasSemana: next,
        },
      };
    });
  };

  const handleHorarioChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      horario: {
        ...prev.horario,
        [key]: value,
      },
    }));
  };

  const validateForm = () => {
    if (!form.nomeCompleto || !form.cargo || !form.telefone || !form.email) {
      return 'Preenche nome, cargo, telefone e email.';
    }

    if (form.porteAnimais.length === 0) {
      return 'Seleciona pelo menos um porte de animal.';
    }

    if (form.horario.diasSemana.length === 0) {
      return 'Seleciona pelo menos um dia de trabalho.';
    }

    if (compareHHmm(form.horario.horaInicio, form.horario.horaFim) >= 0) {
      return 'horaInicio deve ser menor que horaFim.';
    }

    if (compareHHmm(form.horario.pausaInicio, form.horario.pausaFim) >= 0) {
      return 'pausaInicio deve ser menor que pausaFim.';
    }

    if (compareHHmm(form.horario.pausaInicio, form.horario.horaInicio) < 0 || compareHHmm(form.horario.pausaFim, form.horario.horaFim) > 0) {
      return 'A pausa de almoco deve estar dentro do horario de trabalho.';
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    const validationError = validateForm();
    if (validationError) {
      setErro(validationError);
      return;
    }

    setLoadingSubmit(true);

    try {
      const payload = {
        nomeCompleto: form.nomeCompleto.trim(),
        cargo: form.cargo,
        telefone: form.telefone.trim(),
        email: form.email.trim().toLowerCase(),
        porteAnimais: form.porteAnimais,
        tipoServicoIds: form.tipoServicoIds,
        horario: {
          diasSemana: form.horario.diasSemana,
          horaInicio: form.horario.horaInicio,
          horaFim: form.horario.horaFim,
          pausaInicio: form.horario.pausaInicio,
          pausaFim: form.horario.pausaFim,
        },
      };

      const response = await fetch(`${API_BASE_URL}/funcionarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || `Erro ao criar funcionario (${response.status})`);
      }

      setSucesso('Funcionario criado com sucesso.');
      setForm(initialForm);
      await loadData();
    } catch (e) {
      setErro(e.message || 'Erro ao criar funcionario.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Gestao de Funcionarios
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Cria funcionarios com horario de trabalho, contactos, porte de animais e servicos que pode realizar.
      </Typography>

      <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sucesso && <Alert severity="success">{sucesso}</Alert>}
          {erro && <Alert severity="error">{erro}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            <TextField
              label="Nome completo"
              value={form.nomeCompleto}
              onChange={(e) => setForm((prev) => ({ ...prev, nomeCompleto: e.target.value }))}
              required
              fullWidth
            />

            <TextField
              select
              label="Cargo"
              value={form.cargo}
              onChange={(e) => setForm((prev) => ({ ...prev, cargo: e.target.value }))}
              required
              fullWidth
            >
              {CARGO_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Telefone"
              value={form.telefone}
              onChange={(e) => setForm((prev) => ({ ...prev, telefone: e.target.value }))}
              required
              fullWidth
            />

            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
              fullWidth
            />
          </Box>

          <Typography variant="h2" sx={{ mt: 1, color: colors.text }}>
            Porte de animais
          </Typography>
          <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
            {PORTE_OPTIONS.map((porte) => (
              <FormControlLabel
                key={porte.value}
                control={
                  <Checkbox
                    checked={form.porteAnimais.includes(porte.value)}
                    onChange={() => toggleArrayValue('porteAnimais', porte.value)}
                    sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                  />
                }
                label={porte.label}
              />
            ))}
          </FormGroup>

          <Typography variant="h2" sx={{ mt: 1, color: colors.text }}>
            Servicos que pode realizar
          </Typography>
          <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
            {servicos.map((servico) => (
              <FormControlLabel
                key={servico.id}
                control={
                  <Checkbox
                    checked={form.tipoServicoIds.includes(servico.id)}
                    onChange={() => toggleArrayValue('tipoServicoIds', servico.id)}
                    sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                  />
                }
                label={servico.tipo}
              />
            ))}
          </FormGroup>

          <Typography variant="h2" sx={{ mt: 1, color: colors.text }}>
            Horario de trabalho
          </Typography>

          <Alert severity="info">Domingo e dia de descanso semanal e nao pode ser selecionado.</Alert>

          <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
            {DIA_OPTIONS.map((dia) => (
              <FormControlLabel
                key={dia.value}
                control={
                  <Checkbox
                    checked={form.horario.diasSemana.includes(dia.value)}
                    onChange={() => toggleDiaSemana(dia.value)}
                    sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                  />
                }
                label={dia.label}
              />
            ))}
          </FormGroup>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            <TextField
              label="Hora inicio"
              type="time"
              value={form.horario.horaInicio}
              onChange={(e) => handleHorarioChange('horaInicio', e.target.value)}
              inputProps={{ step: 60 }}
              required
              fullWidth
            />
            <TextField
              label="Hora fim"
              type="time"
              value={form.horario.horaFim}
              onChange={(e) => handleHorarioChange('horaFim', e.target.value)}
              inputProps={{ step: 60 }}
              required
              fullWidth
            />
            <TextField
              label="Pausa inicio"
              type="time"
              value={form.horario.pausaInicio}
              onChange={(e) => handleHorarioChange('pausaInicio', e.target.value)}
              inputProps={{ step: 60 }}
              fullWidth
            />
            <TextField
              label="Pausa fim"
              type="time"
              value={form.horario.pausaFim}
              onChange={(e) => handleHorarioChange('pausaFim', e.target.value)}
              inputProps={{ step: 60 }}
              fullWidth
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            disabled={loadingSubmit || loadingInitial}
            sx={{
              mt: 1,
              py: 1.5,
              backgroundColor: colors.primary,
              '&:hover': { backgroundColor: `${colors.primary}dd` },
            }}
          >
            {loadingSubmit ? 'A criar...' : 'Criar Funcionario'}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h2" sx={{ color: colors.text }}>
            Funcionarios registados
          </Typography>
          {loadingInitial && <CircularProgress size={20} />}
        </Box>

        {!loadingInitial && funcionarios.length === 0 && (
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Ainda nao existem funcionarios registados.
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {funcionarios.map((f) => (
            <Paper key={f.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text }}>
                {f.nomeCompleto}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {enumLabel(CARGO_OPTIONS, f.cargo)} | {f.email} | {f.telefone}
              </Typography>

              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(f.horariosTrabalho?.[0]?.diasSemana || []).map((dia) => (
                  <Chip key={`${f.id}-${dia}`} size="small" label={enumLabel(DIA_OPTIONS, dia)} />
                ))}
              </Box>

              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(f.servicos || []).map((s) => (
                  <Chip key={`${f.id}-${s.tipoServicoId}`} size="small" color="primary" variant="outlined" label={s.tipo || servicosById[s.tipoServicoId] || s.tipoServicoId} />
                ))}
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
