import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Chip, Paper, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useThemeContext } from '../../contexts/ThemeContext';
import './servicos.css';

const TIPO_META = {
  BANHO:               { icon: '🛁', label: 'Banho' },
  TOSQUIA_COMPLETA:    { icon: '✂️', label: 'Tosquia Completa' },
  TOSQUIA_HIGIENICA:   { icon: '🪮', label: 'Tosquia Higiénica' },
  CORTE_UNHAS:         { icon: '💅', label: 'Corte de Unhas' },
  LIMPEZA_OUVIDOS:     { icon: '👂', label: 'Limpeza de Ouvidos' },
  EXPRESSAO_GLANDULAS: { icon: '💉', label: 'Expressão de Glândulas' },
  LIMPEZA_DENTES:      { icon: '🦷', label: 'Limpeza de Dentes' },
  APARAR_PELO_CARA:    { icon: '🐾', label: 'Aparar Pelo da Cara' },
  ANTI_PULGAS:         { icon: '🦟', label: 'Tratamento Anti-Pulgas' },
  ANTI_QUEDA:          { icon: '🧴', label: 'Tratamento Anti-Queda' },
  REMOCAO_NOS:         { icon: '🪢', label: 'Remoção de Nós' },
};

const REQUIRES_SIZE = new Set(['BANHO', 'TOSQUIA_COMPLETA', 'TOSQUIA_HIGIENICA']);

export default function ServicosPage() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();

  const [servicos, setServicos] = useState([]);
  const [regras, setRegras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [resServicos, resRegras] = await Promise.all([
          fetch(`${API_BASE_URL}/servicos`),
          fetch(`${API_BASE_URL}/regras-preco`),
        ]);
        if (!resServicos.ok) throw new Error(`Erro ao carregar serviços (${resServicos.status})`);
        if (!resRegras.ok) throw new Error(`Erro ao carregar regras de preço (${resRegras.status})`);
        setServicos(await resServicos.json());
        setRegras(await resRegras.json());
      } catch (err) {
        setError(err.message || 'Não foi possível carregar os serviços.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [API_BASE_URL]);

  const regrasCountByServico = regras.reduce((acc, r) => {
    acc[r.tipoServicoId] = (acc[r.tipoServicoId] || 0) + 1;
    return acc;
  }, {});

  const totalAtivos = servicos.filter((s) => s.ativo).length;
  const totalInativos = servicos.length - totalAtivos;

  return (
    <>
      {/* Cabeçalho da página */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h1" sx={{ color: colors.text }}>
            Serviços da Clínica
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textSecondary, mt: 0.5 }}>
            Gere os serviços disponíveis e as suas regras de preço.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/servicos/novo')}
          sx={{ backgroundColor: colors.primary, '&:hover': { backgroundColor: colors.primary + 'dd' } }}
        >
          Novo Serviço
        </Button>
      </Box>

      {/* Chips de resumo */}
      {!loading && !error && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { value: servicos.length, label: 'Total' },
            { value: totalAtivos,     label: 'Ativos' },
            { value: totalInativos,   label: 'Inativos' },
            { value: regras.length,   label: 'Regras Preço' },
          ].map((chip) => (
            <Paper key={chip.label} elevation={2} sx={{ borderRadius: 3, px: 3, py: 1.5, textAlign: 'center', minWidth: 100 }}>
              <Typography variant="h1" sx={{ color: colors.primary, fontSize: '28px' }}>
                {chip.value}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {chip.label}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}

      {/* Tabela */}
      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: colors.primary }} />
          </Box>
        )}

        {!loading && error && (
          <Typography sx={{ p: 4, textAlign: 'center', color: 'error.main' }}>⚠️ {error}</Typography>
        )}

        {!loading && !error && servicos.length === 0 && (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '3rem', mb: 1 }}>🐾</Typography>
            <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 2 }}>
              Ainda não existem serviços registados.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/servicos/novo')}
              sx={{ backgroundColor: colors.primary }}>
              Criar primeiro serviço
            </Button>
          </Box>
        )}

        {!loading && !error && servicos.length > 0 && (
          <table className="servicos-table">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Requer Porte</th>
                <th>Regras de Preço</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((servico) => {
                const meta = TIPO_META[servico.tipo] || { icon: '🐾', label: servico.tipo };
                const requiresSize = REQUIRES_SIZE.has(servico.tipo);
                const nRegras = regrasCountByServico[servico.id] || 0;
                return (
                  <tr key={servico.id}>
                    <td>
                      <span className="tipo-label">
                        <span className="tipo-icon">{meta.icon}</span>
                        {meta.label}
                      </span>
                    </td>
                    <td>
                      <Chip
                        label={requiresSize ? 'Sim' : 'Não'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          backgroundColor: requiresSize ? 'rgba(71,92,81,0.12)' : '#f4f4f5',
                          color: requiresSize ? colors.primary : '#71717a',
                          border: `1px solid ${requiresSize ? colors.primary + '55' : '#e4e4e7'}`,
                        }}
                      />
                    </td>
                    <td>
                      <Typography variant="body1" sx={{ color: colors.primary, fontWeight: 600 }}>
                        {nRegras > 0 ? `${nRegras} regra${nRegras !== 1 ? 's' : ''}` : '—'}
                      </Typography>
                    </td>
                    <td>
                      <Chip
                        label={servico.ativo ? 'Ativo' : 'Inativo'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          backgroundColor: servico.ativo ? 'rgba(34,197,94,0.1)' : '#fef2f2',
                          color: servico.ativo ? '#16a34a' : '#dc2626',
                          border: `1px solid ${servico.ativo ? 'rgba(34,197,94,0.3)' : '#fecaca'}`,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Paper>
    </>
  );
}