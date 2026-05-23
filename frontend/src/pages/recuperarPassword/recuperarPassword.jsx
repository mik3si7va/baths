import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';
import dogs from '../../assets/login_dogs.jpg';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function RecuperarPassword() {
  const { colors } = useThemeContext();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso(false);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/recuperar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao solicitar recuperacao.');
      }

      setSucesso(true);
    } catch (error) {
      setErro(error.message || 'Erro ao solicitar recuperacao.');
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
        elevation={4}
        sx={{
          width: 420,
          maxWidth: '100%',
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: colors.background,
        }}
      >
        <Box sx={{ position: 'relative', height: 150, overflow: 'hidden' }}>
          <img
            src={dogs}
            alt="Caes"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: 3,
          }}
        >
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: colors.text }}>
            Recuperar palavra-passe
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Indica o email da tua conta. Se existir uma conta ativa, enviamos um link valido por 24 horas.
          </Typography>

          {sucesso && (
            <Alert severity="success">
              Se o email estiver registado, vais receber um link para redefinir a palavra-passe.
            </Alert>
          )}
          {erro && <Alert severity="error">{erro}</Alert>}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
            sx={{ backgroundColor: colors.white, borderRadius: 1 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{ py: 1.5, fontSize: '15px', fontWeight: 600 }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: colors.white }} /> : 'Enviar link'}
          </Button>

          <Link
            href="/login"
            underline="hover"
            sx={{ fontSize: '13px', color: colors.primary, alignSelf: 'flex-start' }}
          >
            Voltar ao login
          </Link>
        </Box>
      </Paper>
    </Box>
  );
}
