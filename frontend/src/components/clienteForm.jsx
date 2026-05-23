import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useThemeContext } from '../contexts/ThemeContext';

// US - BET-126: formulário de registo de cliente (extraído de pages/clientes/clientes.jsx).
// Reutilizado em /agendamentos/novo (cliente novo) sem redirecionar para /clientes.
// Cria o cliente via POST /clientes; depois o parent encadeia o registo do animal.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const initialClienteForm = {
  nome: '',
  email: '',
  telefone: '',
  password: '',
  confirmarPassword: '',
  nif: '',
  morada: '',
};

export default function ClienteForm({ onClienteCriado, submitLabel }) {
  const { colors } = useThemeContext();
  const [form, setForm] = useState(initialClienteForm);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const validate = () => {
    if (!form.nome.trim()) return 'Nome é obrigatório.';
    if (!form.email.trim()) return 'Email é obrigatório.';
    if (!form.telefone.trim()) return 'Telefone é obrigatório.';
    if (!form.password.trim()) return 'Password é obrigatória.';
    if (form.password.trim().length < 8)
      return 'A password deve ter pelo menos 8 caracteres.';
    if (form.password !== form.confirmarPassword)
      return 'As passwords não coincidem.';
    if (form.nif.trim() && !/^\d{9}$/.test(form.nif.trim()))
      return 'O NIF deve ter 9 dígitos numéricos.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    const err = validate();
    if (err) {
      setErro(err);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone.trim(),
          password: form.password.trim(),
          nif: form.nif.trim() || undefined,
          morada: form.morada.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Erro (${res.status})`);
      onClienteCriado(body);
    } catch (err) {
      setErro(err.message || 'Erro ao registar cliente.');
    } finally {
      setLoading(false);
    }
  };

  const eyeBtn = (show, toggle) => (
    <InputAdornment position="end">
      <IconButton onClick={toggle} edge="end" size="small">
        {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {erro && (
        <Alert severity="error" onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        <TextField
          label="Nome completo"
          name="nome"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
          required
          fullWidth
          placeholder="Ex: João Silva"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
          fullWidth
          placeholder="Ex: joao.silva@email.com"
          helperText="Será usado para acesso ao sistema."
        />
        <TextField
          label="Telefone"
          name="telefone"
          value={form.telefone}
          onChange={(e) =>
            set('telefone', e.target.value.replace(/\D/g, '').slice(0, 15))
          }
          required
          fullWidth
          placeholder="Ex: 910000000"
        />
        <TextField
          label="NIF (opcional)"
          name="nif"
          value={form.nif}
          onChange={(e) =>
            set('nif', e.target.value.replace(/\D/g, '').slice(0, 9))
          }
          fullWidth
          inputProps={{ maxLength: 9 }}
          placeholder="Ex: 123456789"
          helperText="9 dígitos numéricos."
        />
        <TextField
          label="Morada (opcional)"
          name="morada"
          value={form.morada}
          onChange={(e) => set('morada', e.target.value)}
          fullWidth
          placeholder="Ex: Rua das Flores, 10, Lisboa"
          sx={{ gridColumn: { md: '1 / -1' } }}
        />

        <Divider sx={{ gridColumn: '1 / -1', my: 0.5 }} />

        <TextField
          label="Password"
          name="password"
          type={showPwd ? 'text' : 'password'}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          required
          fullWidth
          helperText="Mínimo 8 caracteres."
          InputProps={{
            endAdornment: eyeBtn(showPwd, () => setShowPwd((v) => !v)),
          }}
        />
        <TextField
          label="Confirmar password"
          name="confirmarPassword"
          type={showConf ? 'text' : 'password'}
          value={form.confirmarPassword}
          onChange={(e) => set('confirmarPassword', e.target.value)}
          required
          fullWidth
          InputProps={{
            endAdornment: eyeBtn(showConf, () => setShowConf((v) => !v)),
          }}
        />
      </Box>

      <Button
        type="submit"
        variant="contained"
        disabled={loading}
        sx={{
          mt: 1,
          py: 1.5,
          alignSelf: 'flex-start',
          backgroundColor: colors.primary,
          '&:hover': { backgroundColor: `${colors.primary}dd` },
        }}
      >
        {loading ? (
          <CircularProgress size={22} sx={{ color: '#fff' }} />
        ) : (
          submitLabel || 'Continuar para o Animal →'
        )}
      </Button>
    </Box>
  );
}
