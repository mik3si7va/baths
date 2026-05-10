import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import KeyIcon from '@mui/icons-material/Key';
import RestoreIcon from '@mui/icons-material/Restore';
import { useThemeContext } from '../../contexts/ThemeContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ESTADO_LABEL = {
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
  BLOQUEADA: 'Bloqueada',
  PENDENTE_APROVACAO: 'Pendente',
  PENDENTE_VERIFICACAO: 'Pendente',
};

function estadoColor(estadoConta) {
  if (estadoConta === 'ATIVA') return 'success';
  if (estadoConta === 'INATIVA' || estadoConta === 'BLOQUEADA') return 'default';
  return 'warning';
}

export default function Contas() {
  const { colors } = useThemeContext();
  const [contas, setContas] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [conviteGerado, setConviteGerado] = useState(null);

  const contasOrdenadas = useMemo(() => {
    return [...contas].sort((a, b) => {
      if (a.estadoConta === b.estadoConta) return a.nomeCompleto.localeCompare(b.nomeCompleto);
      if (a.estadoConta === 'ATIVA') return -1;
      if (b.estadoConta === 'ATIVA') return 1;
      return a.nomeCompleto.localeCompare(b.nomeCompleto);
    });
  }, [contas]);

  const loadContas = async () => {
    setLoadingInitial(true);
    setErro('');

    try {
      const response = await fetch(`${API_BASE_URL}/contas/funcionarios`);
      if (!response.ok) {
        throw new Error('Erro ao carregar contas de funcionarios.');
      }

      const data = await response.json();
      setContas(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar contas de funcionarios.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadContas();
  }, []);

  const updateEstado = async (conta, estadoConta) => {
    if (estadoConta === 'INATIVA') {
      const confirmed = window.confirm(`Desativar a conta de "${conta.nomeCompleto}"?`);
      if (!confirmed) return;
    }

    setErro('');
    setSucesso('');
    setConviteGerado(null);
    setLoadingActionId(conta.id);

    try {
      const response = await fetch(`${API_BASE_URL}/contas/funcionarios/${conta.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoConta }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao atualizar conta.');
      }

      setSucesso(estadoConta === 'ATIVA' ? 'Conta ativada com sucesso.' : 'Conta desativada com sucesso.');
      await loadContas();
    } catch (e) {
      setErro(e.message || 'Erro ao atualizar conta.');
    } finally {
      setLoadingActionId(null);
    }
  };

  const enviarConvite = async (conta) => {
    const confirmed = window.confirm(`Enviar convite para definir palavra-passe a "${conta.nomeCompleto}"?`);
    if (!confirmed) return;

    setErro('');
    setSucesso('');
    setConviteGerado(null);
    setLoadingActionId(conta.id);

    try {
      const response = await fetch(`${API_BASE_URL}/contas/funcionarios/${conta.id}/convite`, {
        method: 'POST',
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao enviar convite.');
      }

      if (body.email?.debugVisible !== false) {
        setConviteGerado({
          nome: body.conta?.nomeCompleto || conta.nomeCompleto,
          email: body.conta?.email || conta.email,
          url: body.convite?.definirPasswordUrl,
          expiresAt: body.convite?.expiresAt,
          emailEnviado: Boolean(body.email?.sent),
          messageId: body.email?.messageId || null,
          accepted: body.email?.accepted || [],
          rejected: body.email?.rejected || [],
          smtp: body.email?.smtp || null,
        });
      }
      setSucesso(body.email?.sent ? 'Convite enviado por email com sucesso.' : 'Convite gerado com sucesso.');
      await loadContas();
    } catch (e) {
      setErro(e.message || 'Erro ao enviar convite.');
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Gestao de Contas
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Ativa, desativa e prepara o acesso ao backoffice para funcionarios ja registados.
      </Typography>

      <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h2" sx={{ color: colors.text }}>
            Contas de funcionarios
          </Typography>
          {loadingInitial && <CircularProgress size={20} />}
        </Box>

        {sucesso && <Alert severity="success" sx={{ mb: 2 }}>{sucesso}</Alert>}
        {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
        {conviteGerado && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {conviteGerado.emailEnviado ? 'Email enviado' : 'Link gerado'} para {conviteGerado.nome} ({conviteGerado.email}): <strong>{conviteGerado.url}</strong>
            {conviteGerado.messageId && (
              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                SMTP: {conviteGerado.smtp?.host}:{conviteGerado.smtp?.port} | Message ID: {conviteGerado.messageId}
              </Box>
            )}
            {conviteGerado.accepted.length > 0 && (
              <Box component="span" sx={{ display: 'block' }}>
                Accepted: {conviteGerado.accepted.join(', ')}
              </Box>
            )}
            {conviteGerado.rejected.length > 0 && (
              <Box component="span" sx={{ display: 'block' }}>
                Rejected: {conviteGerado.rejected.join(', ')}
              </Box>
            )}
          </Alert>
        )}

        {!loadingInitial && contas.length === 0 && (
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Ainda nao existem funcionarios registados.
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {contasOrdenadas.map((conta) => (
            <Paper key={conta.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text }}>
                      {conta.nomeCompleto}
                    </Typography>
                    <Chip
                      size="small"
                      label={ESTADO_LABEL[conta.estadoConta] || conta.estadoConta}
                      color={estadoColor(conta.estadoConta)}
                      sx={{ color: conta.estadoConta === 'ATIVA' ? colors.white : undefined, fontSize: '11px', height: 24 }}
                    />
                    <Chip
                      size="small"
                      label={conta.temPassword ? 'Com password' : 'Sem password'}
                      color={conta.temPassword ? 'primary' : 'warning'}
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                    {conta.email} | {conta.cargo} | {conta.tipoConta || 'FUNCIONARIO'}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton
                    size="small"
                    disabled={loadingActionId === conta.id}
                    onClick={() => updateEstado(conta, conta.estadoConta === 'ATIVA' ? 'INATIVA' : 'ATIVA')}
                    sx={{ color: colors.textSecondary }}
                    title={conta.estadoConta === 'ATIVA' ? 'Desativar conta' : 'Ativar conta'}
                    aria-label={conta.estadoConta === 'ATIVA' ? 'Desativar conta' : 'Ativar conta'}
                  >
                    {conta.estadoConta === 'ATIVA' ? <BlockIcon fontSize="small" /> : <RestoreIcon fontSize="small" />}
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={loadingActionId === conta.id}
                    onClick={() => enviarConvite(conta)}
                    sx={{ color: colors.primary }}
                    title="Enviar convite para definir palavra-passe"
                    aria-label="Enviar convite para definir palavra-passe"
                  >
                    <KeyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
