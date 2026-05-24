import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useThemeContext } from '../../../contexts/ThemeContext';
import { ConfirmDialog } from '../../../components';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/Restore';
import WorkIcon from '@mui/icons-material/Work';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DEFAULT_CARGO_OPTIONS = [
  { value: 'TOSQUIADOR_SENIOR', label: 'Tosquiador Senior' },
  { value: 'TOSQUIADOR', label: 'Tosquiador' },
  { value: 'TOSQUIADOR_ESTAGIARIO', label: 'Tosquiador Estagiario' },
  { value: 'BANHISTA_SENIOR', label: 'Banhista Senior' },
  { value: 'BANHISTA', label: 'Banhista' },
  { value: 'BANHISTA_ESTAGIARIO', label: 'Banhista Estagiario' },
  { value: 'RECECIONISTA', label: 'Rececionista' },
  { value: 'ADMINISTRACAO', label: 'Administracao' },
];

const DEFAULT_PORTE_OPTIONS = [
  { value: 'EXTRA_PEQUENO', label: 'Extra pequeno' },
  { value: 'PEQUENO', label: 'Pequeno' },
  { value: 'MEDIO', label: 'Medio' },
  { value: 'GRANDE', label: 'Grande' },
  { value: 'EXTRA_GRANDE', label: 'Extra grande' },
];

const DEFAULT_DIA_OPTIONS = [
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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('btUser') || 'null');
  } catch (_error) {
    return null;
  }
}

export default function Funcionarios() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();
  const [user] = useState(() => getStoredUser());
  const isAdmin = user?.tipoConta === 'ADMIN';

  const [form, setForm] = useState(initialForm);
  const [cargoOptions, setCargoOptions] = useState(DEFAULT_CARGO_OPTIONS);
  const [porteOptions, setPorteOptions] = useState(DEFAULT_PORTE_OPTIONS);
  const [diaOptions, setDiaOptions] = useState(DEFAULT_DIA_OPTIONS);
  const [servicos, setServicos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingDeleteId, setLoadingDeleteId] = useState(null);
  const [loadingStatusId, setLoadingStatusId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Estados para diálogos de confirmação
  const [dialogoDesativarAberto, setDialogoDesativarAberto] = useState(false);
  const [funcionarioParaDesativar, setFuncionarioParaDesativar] = useState(null);
  const [dialogoEliminarAberto, setDialogoEliminarAberto] = useState(false);
  const [funcionarioParaEliminar, setFuncionarioParaEliminar] = useState(null);

  // Diálogo de erro modal: quando o backend devolve 409 (ex: funcionario com agendamentos futuros)
  const [dialogoErroAberto, setDialogoErroAberto] = useState(false);
  const [dialogoErroMensagem, setDialogoErroMensagem] = useState('');

  const servicosById = useMemo(() => {
    return Object.fromEntries(servicos.map((s) => [s.id, s.tipo]));
  }, [servicos]);

  const funcionariosVisiveis = useMemo(() => {
    return isAdmin ? funcionarios : funcionarios.filter((f) => f.ativo);
  }, [funcionarios, isAdmin]);

  const loadData = async () => {
    setLoadingInitial(true);
    setErro('');

    try {
      const [opcoesRes, servicosRes, funcionariosRes] = await Promise.all([
        fetch(`${API_BASE_URL}/funcionarios/opcoes`),
        fetch(`${API_BASE_URL}/servicos`),
        fetch(`${API_BASE_URL}/funcionarios`),
      ]);

      if (!opcoesRes.ok) {
        throw new Error('Erro ao carregar opcoes de funcionarios.');
      }

      if (!servicosRes.ok) {
        throw new Error('Erro ao carregar servicos.');
      }

      if (!funcionariosRes.ok) {
        throw new Error('Erro ao carregar funcionarios.');
      }

      const opcoesData = await opcoesRes.json();
      const servicosData = await servicosRes.json();
      const funcionariosData = await funcionariosRes.json();

      setCargoOptions(Array.isArray(opcoesData.cargos) ? opcoesData.cargos : DEFAULT_CARGO_OPTIONS);
      setPorteOptions(Array.isArray(opcoesData.portes) ? opcoesData.portes : DEFAULT_PORTE_OPTIONS);
      setDiaOptions(Array.isArray(opcoesData.diasSemana) ? opcoesData.diasSemana : DEFAULT_DIA_OPTIONS);
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

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleEdit = (funcionario) => {
    const horario = funcionario.horariosTrabalho?.[0] || initialForm.horario;

    setForm({
      nomeCompleto: funcionario.nomeCompleto || '',
      cargo: funcionario.cargo || '',
      telefone: funcionario.telefone || '',
      email: funcionario.email || '',
      porteAnimais: funcionario.porteAnimais || [],
      tipoServicoIds: (funcionario.servicos || []).map((s) => s.tipoServicoId),
      horario: {
        diasSemana: horario.diasSemana || [],
        horaInicio: horario.horaInicio || initialForm.horario.horaInicio,
        horaFim: horario.horaFim || initialForm.horario.horaFim,
        pausaInicio: horario.pausaInicio || initialForm.horario.pausaInicio,
        pausaFim: horario.pausaFim || initialForm.horario.pausaFim,
      },
    });
    setEditingId(funcionario.id);
    setErro('');
    setSucesso('');
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

      const funcionarioUrl = editingId
        ? `${API_BASE_URL}/funcionarios/${editingId}`
        : `${API_BASE_URL}/funcionarios`;
      const submitLabel = editingId ? 'atualizar' : 'criar';

      const response = await fetch(funcionarioUrl, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || `Erro ao ${submitLabel} funcionario (${response.status})`);
      }

      setSucesso(editingId ? 'Funcionario atualizado com sucesso.' : 'Funcionario criado com sucesso.');
      resetForm();
      await loadData();
    } catch (e) {
      setErro(e.message || `Erro ao ${editingId ? 'atualizar' : 'criar'} funcionario.`);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Helper interno: muda o estado ativo (true ou false) sem confirmação.
  // Usado directamente para activar; via dialog para desactivar.
  const aplicarToggleAtivo = async (funcionario, nextAtivo) => {
    setErro('');
    setSucesso('');
    setLoadingStatusId(funcionario.id);

    try {
      const response = await fetch(`${API_BASE_URL}/funcionarios/${funcionario.id}/ativo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ativo: nextAtivo }),
      });
      const body = await response.json();

      if (!response.ok) {
        const message = body.error || `Erro ao ${nextAtivo ? 'ativar' : 'desativar'} funcionario (${response.status})`;
        if (response.status === 409) {
          setDialogoErroMensagem(message);
          setDialogoErroAberto(true);
          return;
        }
        throw new Error(message);
      }

      setSucesso(nextAtivo ? 'Funcionario ativado com sucesso.' : 'Funcionario desativado com sucesso.');
      await loadData();
    } catch (e) {
      setErro(e.message || `Erro ao ${nextAtivo ? 'ativar' : 'desativar'} funcionario.`);
    } finally {
      setLoadingStatusId(null);
    }
  };

  // Activar não requer confirmação.
  const handleAtivar = (funcionario) => aplicarToggleAtivo(funcionario, true);

  // Desactivar pede confirmação via dialog.
  const pedirDesativacao = (funcionario) => {
    setFuncionarioParaDesativar(funcionario);
    setDialogoDesativarAberto(true);
  };

  const confirmarDesativacao = async () => {
    if (!funcionarioParaDesativar) return;
    const alvo = funcionarioParaDesativar;
    setDialogoDesativarAberto(false);
    setFuncionarioParaDesativar(null);
    await aplicarToggleAtivo(alvo, false);
  };

  // Eliminar definitivamente (hard delete) pede confirmação via dialog.
  const pedirEliminacao = (funcionario) => {
    setFuncionarioParaEliminar(funcionario);
    setDialogoEliminarAberto(true);
  };

  const confirmarEliminacao = async () => {
    if (!funcionarioParaEliminar) return;

    const alvo = funcionarioParaEliminar;
    setErro('');
    setSucesso('');
    setLoadingDeleteId(alvo.id);

    try {
      const response = await fetch(`${API_BASE_URL}/funcionarios/${alvo.id}`, {
        method: 'DELETE',
      });
      const body = await response.json();

      if (!response.ok) {
        const message = body.error || `Erro ao eliminar funcionario (${response.status})`;
        if (response.status === 409) {
          setDialogoEliminarAberto(false);
          setFuncionarioParaEliminar(null);
          setDialogoErroMensagem(message);
          setDialogoErroAberto(true);
          return;
        }
        throw new Error(message);
      }

      if (editingId === alvo.id) {
        resetForm();
      }

      setSucesso(`Funcionario "${alvo.nomeCompleto}" eliminado com sucesso.`);
      await loadData();
      setDialogoEliminarAberto(false);
      setFuncionarioParaEliminar(null);
    } catch (e) {
      setErro(e.message || 'Erro ao eliminar funcionario.');
      setDialogoEliminarAberto(false);
      setFuncionarioParaEliminar(null);
    } finally {
      setLoadingDeleteId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Gestao de Funcionarios
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        {isAdmin
          ? 'Cria funcionarios com horario de trabalho, contactos, porte de animais e servicos que pode realizar.'
          : 'Consulta a equipa, horarios, especialidades e agendas pessoais.'}
      </Typography>

      {isAdmin && (
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
              {cargoOptions.map((option) => (
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
            {porteOptions.map((porte) => (
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

          <Alert severity="info">Domingo é dia de descanso semanal e nao pode ser selecionado.</Alert>

          <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
            {diaOptions.map((dia) => (
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

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loadingSubmit || loadingInitial}
              sx={{
                mt: 1,
                py: 1.5,
                flexGrow: 1,
                backgroundColor: colors.primary,
                '&:hover': { backgroundColor: `${colors.primary}dd` },
              }}
            >
              {loadingSubmit
                ? editingId ? 'A guardar...' : 'A criar...'
                : editingId ? 'Guardar alteracoes' : 'Criar Funcionario'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outlined"
                disabled={loadingSubmit}
                onClick={resetForm}
                sx={{ mt: 1, py: 1.5 }}
              >
                Cancelar edicao
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
      )}

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
          {funcionariosVisiveis.map((f) => (
            <Paper
              key={f.id}
              variant="outlined"
              onClick={() => {
                const nomeUrl = encodeURIComponent((f.nomeCompleto || 'funcionario').replace(/\s+/g, '_'));
                navigate(`/funcionarios/${f.id}/${nomeUrl}`);
              }}
              sx={{
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                opacity: f.ativo ? 1 : 0.55,
                borderStyle: f.ativo ? 'solid' : 'dashed',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  borderColor: colors.primary,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <WorkIcon sx={{ fontSize: 20, color: colors.primary }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text }}>
                    {f.nomeCompleto}
                  </Typography>
                  <Chip
                    size="small"
                    label={f.ativo ? 'Ativo' : 'Inativo'}
                    color={f.ativo ? 'success' : 'default'}
                    sx={{ color: colors.white, fontSize: '11px', height: 24 }}
                  />
                </Box>
                {isAdmin && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleEdit(f); }}
                      sx={{ color: colors.primary }}
                      title="Editar funcionario"
                      aria-label="Editar"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={loadingStatusId === f.id}
                      onClick={(e) => { e.stopPropagation(); f.ativo ? pedirDesativacao(f) : handleAtivar(f); }}
                      sx={{ color: colors.textSecondary }}
                      title={f.ativo ? 'Desativar funcionario' : 'Ativar funcionario'}
                      aria-label={f.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {f.ativo ? <BlockIcon fontSize="small" /> : <RestoreIcon fontSize="small" />}
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={loadingDeleteId === f.id}
                      onClick={(e) => { e.stopPropagation(); pedirEliminacao(f); }}
                      sx={{ color: colors.textSecondary }}
                      title="Eliminar funcionario"
                      aria-label="Eliminar"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {enumLabel(cargoOptions, f.cargo)} | {f.email} | {f.telefone}
              </Typography>

              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(f.horariosTrabalho?.[0]?.diasSemana || []).map((dia) => (
                  <Chip key={`${f.id}-${dia}`} size="small" label={enumLabel(diaOptions, dia)} />
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

      {/* ── DIÁLOGO: DESATIVAR ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={dialogoDesativarAberto}
        title="Desativar Funcionário"
        message={
          <>
            <Typography>
              Tem a certeza que pretende desativar o funcionário <strong>"{funcionarioParaDesativar?.nomeCompleto}"</strong>?
            </Typography>
            <Typography sx={{ mt: 1 }}>
              O funcionário ficará indisponível para novos agendamentos. Pode reativá-lo a qualquer momento.
            </Typography>
            <Typography sx={{ mt: 1, fontSize: '0.875rem', color: 'warning.main' }}>
              A operação será recusada se existirem agendamentos futuros associados a este funcionário.
            </Typography>
          </>
        }
        confirmLabel="Desativar"
        confirmColor="warning"
        onConfirm={confirmarDesativacao}
        onClose={() => { setDialogoDesativarAberto(false); setFuncionarioParaDesativar(null); }}
      />

      {/* ── DIÁLOGO: ELIMINAR DEFINITIVAMENTE (hard delete) ───────────────── */}
      <ConfirmDialog
        open={dialogoEliminarAberto}
        title="Eliminar Funcionário definitivamente"
        message={
          <>
            <Typography>
              Tem a certeza que pretende eliminar definitivamente o funcionário <strong>"{funcionarioParaEliminar?.nomeCompleto}"</strong>?
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Esta acção remove o funcionário da base de dados — não é reversível.
            </Typography>
            <Typography sx={{ mt: 1, fontSize: '0.875rem', color: 'error.main' }}>
              A operação será recusada se existirem agendamentos (passados ou futuros).
            </Typography>
          </>
        }
        confirmLabel="Eliminar"
        confirmColor="error"
        onConfirm={confirmarEliminacao}
        onClose={() => { setDialogoEliminarAberto(false); setFuncionarioParaEliminar(null); }}
      />

      {/* Diálogo modal de erro: backend bloqueou a operação (ex: funcionario com agendamentos futuros). */}
      <ConfirmDialog
        open={dialogoErroAberto}
        title="Não é possível concluir a operação"
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
