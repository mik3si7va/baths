import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Typography,
} from '@mui/material';
import WorkIcon from '@mui/icons-material/Work';
import { useThemeContext } from '../../../contexts/ThemeContext';
import {
  AgendamentoDialog,
  CalendarView,
  CancelarAgendamentoDialog,
  FaturarServicosDialog,
  ListaAgendamentos,
  NaoCompareceuDialog,
} from '../../../components';
import MetodoPagamentoDialog from '../../../components/metodoPagamentoDialog';
import { getProcessoGestaoActual, aguardarTarefa, completarTarefa, aguardarFimGestao } from '../../../utils/camundaWizard';
import { mapAgendamentosToEvents, renderBloco } from '../../../utils/agendamentosCalendar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const TASK_RECEBER_PAGAMENTO = 'BP184';

const CARGO_LABELS = {
  TOSQUIADOR_SENIOR: 'Tosquiador Senior',
  TOSQUIADOR: 'Tosquiador',
  TOSQUIADOR_ESTAGIARIO: 'Tosquiador Estagiario',
  BANHISTA_SENIOR: 'Banhista Senior',
  BANHISTA: 'Banhista',
  BANHISTA_ESTAGIARIO: 'Banhista Estagiario',
  RECECIONISTA: 'Rececionista',
  ADMINISTRACAO: 'Administracao',
};

const DIA_LABELS = {
  SEGUNDA: 'Segunda',
  TERCA: 'Terca',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
  SABADO: 'Sabado',
};

const PORTE_LABELS = {
  EXTRA_PEQUENO: 'Extra pequeno',
  PEQUENO: 'Pequeno',
  MEDIO: 'Medio',
  GRANDE: 'Grande',
  EXTRA_GRANDE: 'Extra grande',
};

function enumLabel(labels, value) {
  return labels[value] || value;
}

export default function FuncionarioDetalhes() {
  const { id, nome } = useParams();
  const navigate = useNavigate();
  const { colors } = useThemeContext();

  const [funcionario, setFuncionario] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [intervaloVisivel, setIntervaloVisivel] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [aCancelar, setACancelar] = useState(null);
  const [aMarcarFalta, setAMarcarFalta] = useState(null);
  const [aFaturarServicos, setAFaturarServicos] = useState(null);
  const [aReceberPagamento, setAReceberPagamento] = useState(null);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);

  const events = useMemo(() => mapAgendamentosToEvents(agendamentos), [agendamentos]);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const actualizarIntervalo = useCallback(({ view }) => {
    const start = view.currentStart;
    const end = view.currentEnd;
    setIntervaloVisivel((prev) => {
      if (prev && prev.start.getTime() === start.getTime() && prev.end.getTime() === end.getTime()) {
        return prev;
      }
      return { start, end };
    });
  }, []);

  const nomeExibicao = funcionario?.nomeCompleto
    ?? (nome ? decodeURIComponent(nome).replace(/_/g, ' ') : 'Funcionario sem nome');

  const loadData = useCallback(async () => {
    setLoading(true);
    setErro('');

    try {
      const funcionarioRes = await fetch(`${API_BASE_URL}/funcionarios/${id}`);

      if (funcionarioRes.status === 404) {
        navigateRef.current('/funcionarios');
        return;
      }

      if (!funcionarioRes.ok) {
        const errorData = await funcionarioRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao carregar funcionario.');
      }

      const agendamentosRes = await fetch(`${API_BASE_URL}/agendamentos?funcionarioId=${id}`);
      if (!agendamentosRes.ok) {
        const errorData = await agendamentosRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao carregar agendamentos.');
      }

      const funcionarioData = await funcionarioRes.json();
      const agendamentosData = await agendamentosRes.json();

      setFuncionario(funcionarioData);
      setAgendamentos(Array.isArray(agendamentosData) ? agendamentosData : []);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const receberPagamento = async (metodoPagamento) => {
    if (!aReceberPagamento?.agendamentoId) return;
    setPagamentoLoading(true);
    try {
      const procId = await getProcessoGestaoActual(aReceberPagamento.agendamentoId);
      if (!procId) throw new Error('Nenhum processo de atendimento activo para este agendamento.');
      const tarefa = await aguardarTarefa(procId, TASK_RECEBER_PAGAMENTO);
      await completarTarefa(procId, tarefa.id, { metodoPagamento });
      await aguardarFimGestao(aReceberPagamento.agendamentoId);
      setAReceberPagamento(null);
      await loadData();
    } finally {
      setPagamentoLoading(false);
    }
  };

  const abrirDetalhe = ({ event }) => {
    if (event.display === 'background') return;
    setSelecionado({
      inicio: event.start,
      fim: event.end,
      ...event.extendedProps,
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const horario = funcionario?.horariosTrabalho?.[0];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <WorkIcon sx={{ fontSize: 32, color: funcionario?.ativo ? colors.primary : colors.textSecondary }} />
        <Typography variant="h1" sx={{ color: colors.text }}>
          {nomeExibicao}
        </Typography>
        <Chip
          label={funcionario?.ativo ? 'Ativo' : 'Inativo'}
          color={funcionario?.ativo ? 'success' : 'default'}
          sx={{ fontSize: '12px' }}
        />
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}

      {funcionario && !funcionario.ativo && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Este funcionario esta inativo.
        </Alert>
      )}

      <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Cargo:</strong> {enumLabel(CARGO_LABELS, funcionario?.cargo)}
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Email:</strong> {funcionario?.email}
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          <strong>Telefone:</strong> {funcionario?.telefone}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textSecondary }}>
          Horario de trabalho
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {(horario?.diasSemana || []).map((dia) => (
            <Chip key={dia} size="small" label={enumLabel(DIA_LABELS, dia)} />
          ))}
          {horario && (
            <Chip
              size="small"
              variant="outlined"
              label={`${horario.horaInicio} - ${horario.horaFim} | Pausa ${horario.pausaInicio} - ${horario.pausaFim}`}
            />
          )}
        </Box>

        <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textSecondary }}>
          Portes atendidos
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {(funcionario?.porteAnimais || []).map((porte) => (
            <Chip key={porte} size="small" label={enumLabel(PORTE_LABELS, porte)} />
          ))}
        </Box>

        <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textSecondary }}>
          Servicos que pode realizar
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {(funcionario?.servicos || []).map((servico) => (
            <Chip
              key={servico.tipoServicoId}
              size="small"
              color="primary"
              variant="outlined"
              label={servico.tipo || servico.tipoServicoId}
            />
          ))}
        </Box>
      </Paper>

      <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
        <Typography variant="h2" sx={{ mb: 3, color: colors.text }}>
          Agenda pessoal
        </Typography>

        <CalendarView
          events={events}
          onEventClick={abrirDetalhe}
          eventContent={renderBloco}
          onDatesSet={actualizarIntervalo}
        />
      </Paper>

      <ListaAgendamentos
        agendamentos={agendamentos}
        intervalo={intervaloVisivel}
        titulo="Agendamentos do funcionario no periodo visivel"
        onCancelar={setACancelar}
        onNaoCompareceu={setAMarcarFalta}
        onReagendar={(ag) => navigate(`/agendamentos/${ag.agendamentoId}/reagendar`)}
        onReceberPagamento={setAFaturarServicos}
        onVerFatura={(ag) => navigate(`/faturas/${ag.faturaId}`)}
      />

      <AgendamentoDialog
        agendamento={selecionado}
        onClose={() => setSelecionado(null)}
        onSuccess={loadData}
      />

      <CancelarAgendamentoDialog
        agendamento={aCancelar}
        open={aCancelar !== null}
        onClose={() => setACancelar(null)}
        onSuccess={loadData}
      />

      <NaoCompareceuDialog
        agendamento={aMarcarFalta}
        open={aMarcarFalta !== null}
        onClose={() => setAMarcarFalta(null)}
        onSuccess={loadData}
      />

      <FaturarServicosDialog
        open={aFaturarServicos !== null}
        agendamento={aFaturarServicos}
        onClose={() => setAFaturarServicos(null)}
        onConfirmado={(ag) => {
          setAFaturarServicos(null);
          setAReceberPagamento(ag);
        }}
      />

      <MetodoPagamentoDialog
        open={aReceberPagamento !== null}
        onClose={() => !pagamentoLoading && setAReceberPagamento(null)}
        onConfirmar={receberPagamento}
        loading={pagamentoLoading}
      />
    </Box>
  );
}
