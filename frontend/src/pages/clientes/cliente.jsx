import React, { useState} from 'react';
import 
{
    Box, Typography, TextField, Button, Checkbox,
    FormControlLabel, FormGroup, Paper, Alert, Chip,
    CircularProgress, IconButton,
} from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';


const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const initialForm = 
{
  nome: '',
  email: '',
  telefone: '',
  nif: '',
};

export default function CreateClient() 
{
  const { colors } = useThemeContext();
  const [form, setForm] = useState(initialForm);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const handleChange = (field, value) => 
  {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => 
    {
    if (!form.nome.trim() || !form.email.trim() || !form.telefone.trim() || !form.nif.trim()) {
      return 'Preenche nome, email, telefone e NIF.';
    }

    if (!/^\d{9}$/.test(form.nif.trim()))
    {
      return 'O NIF deve ter 9 digitos.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.trim(),
        nif: form.nif.trim(),
      };

      const response = await fetch(`${API_BASE_URL}/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || `Erro ao criar cliente (${response.status})`);
      }

      setSucesso('Cliente registado com sucesso.');
      setForm(initialForm);
    } catch (error) {
      setErro(error.message || 'Erro ao criar cliente.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Registo de Clientes
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Formulario interno para a rececao registar novos clientes presencialmente no backoffice.
      </Typography>

      <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sucesso && <Alert severity="success">{sucesso}</Alert>}
          {erro && <Alert severity="error">{erro}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            <TextField
              label="Nome completo"
              value={form.nome}
              onChange={(event) => handleChange('nome', event.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => handleChange('email', event.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Telefone"
              value={form.telefone}
              onChange={(event) => handleChange('telefone', event.target.value)}
              required
              fullWidth
            />

            <TextField
              label="NIF"
              value={form.nif}
              onChange={(event) => handleChange('nif', event.target.value.replace(/\D/g, '').slice(0, 9))}
              required
              fullWidth
              inputProps={{ maxLength: 9 }}
              helperText="O NIF deve ter 9 digitos."
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            disabled={loadingSubmit}
            sx={{
              mt: 1,
              py: 1.5,
              alignSelf: 'flex-start',
              backgroundColor: colors.primary,
              '&:hover': { backgroundColor: `${colors.primary}dd` },
            }}
          >
            {loadingSubmit ? 'A registar...' : 'Registar Cliente'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
