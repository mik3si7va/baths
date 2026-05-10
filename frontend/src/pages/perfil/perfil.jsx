import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('btUser') || 'null');
  } catch (_error) {
    return null;
  }
}

export default function Perfil() {
  const { colors } = useThemeContext();
  const storedUser = useMemo(() => getStoredUser(), []);
  const [perfil, setPerfil] = useState(null);
  const [telefone, setTelefone] = useState('');
  const [passwordAtual, setPasswordAtual] = useState('');
  const [novaPassword, setNovaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const loadPerfil = useCallback(async () => {
    if (!storedUser?.id) {
      setErro('Sessao invalida. Volta a fazer login.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const response = await fetch(`${API_BASE_URL}/perfil/${storedUser.id}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao carregar perfil.');
      }

      setPerfil(body);
      setTelefone(body.telefone || '');
    } catch (error) {
      setErro(error.message || 'Erro ao carregar perfil.');
    } finally {
      setLoading(false);
    }
  }, [storedUser?.id]);

  useEffect(() => {
    loadPerfil();
  }, [loadPerfil]);

  const guardarPerfil = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');
    setSavingPerfil(true);

    try {
      const response = await fetch(`${API_BASE_URL}/perfil/${storedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao guardar perfil.');
      }

      setPerfil(body);
      setTelefone(body.telefone || '');
      setSucesso('Perfil atualizado com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao guardar perfil.');
    } finally {
      setSavingPerfil(false);
    }
  };

  const guardarPassword = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');
    setSavingPassword(true);

    try {
      const response = await fetch(`${API_BASE_URL}/perfil/${storedUser.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordAtual, novaPassword, confirmarPassword }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao alterar palavra-passe.');
      }

      setPasswordAtual('');
      setNovaPassword('');
      setConfirmarPassword('');
      setSucesso('Palavra-passe atualizada com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao alterar palavra-passe.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Perfil
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Gere os teus dados de contacto e a palavra-passe da conta.
      </Typography>

      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      {sucesso && <Alert severity="success" sx={{ mb: 2 }}>{sucesso}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Paper component="form" onSubmit={guardarPerfil} elevation={2} sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="h2" sx={{ color: colors.text, mb: 2 }}>
              Dados de perfil
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Nome" value={perfil?.nome || ''} disabled fullWidth />
              <TextField label="Email" value={perfil?.email || ''} disabled fullWidth />
              <TextField label="Tipo de conta" value={perfil?.tipoConta || ''} disabled fullWidth />
              {perfil?.cargo && <TextField label="Cargo" value={perfil.cargo} disabled fullWidth />}
              <TextField
                label="Telefone"
                value={telefone}
                onChange={(event) => setTelefone(event.target.value)}
                required
                fullWidth
              />
              <Button type="submit" variant="contained" disabled={savingPerfil} sx={{ mt: 1 }}>
                {savingPerfil ? <CircularProgress size={22} sx={{ color: colors.white }} /> : 'Guardar perfil'}
              </Button>
            </Box>
          </Paper>

          <Paper component="form" onSubmit={guardarPassword} elevation={2} sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="h2" sx={{ color: colors.text, mb: 2 }}>
              Alterar palavra-passe
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Palavra-passe atual"
                type="password"
                value={passwordAtual}
                onChange={(event) => setPasswordAtual(event.target.value)}
                required
                fullWidth
              />
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

              <Button type="submit" variant="contained" disabled={savingPassword} sx={{ mt: 1 }}>
                {savingPassword ? <CircularProgress size={22} sx={{ color: colors.white }} /> : 'Alterar palavra-passe'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
