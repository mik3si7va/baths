import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function DefinirPassword() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);
  const [novaPassword, setNovaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/definir-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaPassword, confirmarPassword }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao definir palavra-passe.');
      }

      localStorage.setItem('btUser', JSON.stringify(body.user));
      localStorage.setItem('usernameB&T', body.user.email);
      navigate('/home', { replace: true });
    } catch (error) {
      setErro(error.message || 'Erro ao definir palavra-passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        px: 2,
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={4}
        sx={{
          width: 420,
          maxWidth: '100%',
          borderRadius: 3,
          p: 3,
          backgroundColor: colors.background,
        }}
      >
        <Typography variant="h1" sx={{ color: colors.text, mb: 1 }}>
          Definir palavra-passe
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
          Escolhe a palavra-passe que vais usar no backoffice B&T.
        </Typography>

        {!token && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Link invalido. Pede um novo convite ao administrador.
          </Alert>
        )}
        {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nova palavra-passe"
            type="password"
            value={novaPassword}
            onChange={(event) => setNovaPassword(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Confirmar nova palavra-passe"
            type="password"
            value={confirmarPassword}
            onChange={(event) => setConfirmarPassword(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={loading || !token} sx={{ py: 1.4 }}>
            {loading ? <CircularProgress size={22} sx={{ color: colors.white }} /> : 'Definir palavra-passe'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
