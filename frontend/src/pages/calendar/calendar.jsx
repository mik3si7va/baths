import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useThemeContext } from '../../contexts/ThemeContext';
import { CalendarView, AgendamentoDialog, CancelarAgendamentoDialog, NaoCompareceuDialog, ListaAgendamentos, FaturarServicosDialog } from '../../components';
import MetodoPagamentoDialog from '../../components/metodoPagamentoDialog';
import { getProcessoGestaoActual, aguardarTarefa, completarTarefa, aguardarFimGestao } from '../../utils/camundaWizard';
import { mapAgendamentosToEvents, renderBloco } from '../../utils/agendamentosCalendar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ID da user task do gestao_agendamento.bpmn. Coincide com o `taskDefinitionKey` no Camunda Modeler - alterar aqui requer renomear também no BPMN.
const TASK_RECEBER_PAGAMENTO = 'BP184';

// US - BET-37: Como funcionário, quero ver os agendamentos do dia/semana/mês para organizar o trabalho da clínica.

export default function Calendar() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [aCancelar, setACancelar] = useState(null);
  const [aMarcarFalta, setAMarcarFalta] = useState(null);
  // aFaturarServicos abre primeiro (gere BP56_sub3 do sub_faturar_servicos).
  // Após confirmar, encadeia para aReceberPagamento (gere BP184).
  const [aFaturarServicos, setAFaturarServicos] = useState(null);
  const [aReceberPagamento, setAReceberPagamento] = useState(null);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);
  const [intervaloVisivel, setIntervaloVisivel] = useState(null);

  const events = useMemo(() => mapAgendamentosToEvents(agendamentos), [agendamentos]);

  // Guarda contra loop infinito: FullCalendar dispara `datesSet` em qualquer re-render que mude a referência de `events`.
  // Sem comparação, cada setState de intervalo desencadearia outro datesSet -> outro setState, em cascata.
  // Usamos `view.currentStart`/`view.currentEnd` em vez de `start`/`end` do datesSet: na vista de mês,
  // `start`/`end` incluem os dias "enchimento" da semana inicial/final do mês anterior/seguinte (ex: vista de Maio mostra 28-30 Abril e 1-3 Junho na grelha).
  // `currentStart`/`currentEnd` devolvem o mês "real" (1-31 Maio) sem enchimento. Para semana/dia comportamento igual.
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

  const loadAgendamentos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/agendamentos`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Erro ao carregar agendamentos (${response.status})`);
      const data = await response.json();
      setAgendamentos(Array.isArray(data) ? data : []);
    } catch (_err) {
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgendamentos();
  }, [loadAgendamentos]);

  // Completa BP184 com o método escolhido. O BPMN avança sozinho: BP185 (regista pagamento na BD) -> BP183 (gera Fatura) -> fim.
  // Espera o processo terminar antes de fazer re-fetch - só aí a Fatura existe na BD e o agendamento mostra o estado final.
  const receberPagamento = async (metodoPagamento) => {
    if (!aReceberPagamento?.agendamentoId) return;
    setPagamentoLoading(true);
    try {
      const procId = await getProcessoGestaoActual(aReceberPagamento.agendamentoId);
      if (!procId) throw new Error('Nenhum processo de atendimento activo para este agendamento.');
      const tarefa = await aguardarTarefa(procId, TASK_RECEBER_PAGAMENTO);
      await completarTarefa(procId, tarefa.id, { metodoPagamento });
      // Espera o BPMN terminar (BP185 regista pagamento, BP183 gera fatura) antes do re-fetch - só então a Fatura existe e o agendamento mostra o estado final.
      await aguardarFimGestao(aReceberPagamento.agendamentoId);
      setAReceberPagamento(null);
      await loadAgendamentos();
    } finally {
      setPagamentoLoading(false);
    }
  };

  // Click num bloco - abre o dialog com detalhe completo.
  const abrirDetalhe = ({ event }) => {
    // Eventos de fundo (ex: hora de almoço) não devem abrir o dialog.
    if (event.display === 'background') return;
    setSelecionado({
      inicio: event.start,
      fim: event.end,
      ...event.extendedProps,
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h1" sx={{ color: colors.text }}>
          Agenda
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/agendamentos/novo')}
        >
          Novo Agendamento
        </Button>
      </Box>

      <CalendarView
        events={events}
        loading={loading}
        onEventClick={abrirDetalhe}
        eventContent={renderBloco}
        onDatesSet={actualizarIntervalo}
      />

      <ListaAgendamentos
        agendamentos={agendamentos}
        intervalo={intervaloVisivel}
        onCancelar={setACancelar}
        onNaoCompareceu={setAMarcarFalta}
        onReagendar={(ag) => navigate(`/agendamentos/${ag.agendamentoId}/reagendar`)}
        onReceberPagamento={setAFaturarServicos}
        onVerFatura={(ag) => navigate(`/faturas/${ag.faturaId}`)}
      />

      <AgendamentoDialog
        agendamento={selecionado}
        onClose={() => setSelecionado(null)}
        onSuccess={loadAgendamentos}
      />

      <CancelarAgendamentoDialog
        agendamento={aCancelar}
        open={aCancelar !== null}
        onClose={() => setACancelar(null)}
        onSuccess={loadAgendamentos}
      />

      <NaoCompareceuDialog
        agendamento={aMarcarFalta}
        open={aMarcarFalta !== null}
        onClose={() => setAMarcarFalta(null)}
        onSuccess={loadAgendamentos}
      />

      <FaturarServicosDialog
        open={aFaturarServicos !== null}
        agendamento={aFaturarServicos}
        onClose={() => setAFaturarServicos(null)}
        onConfirmado={(ag) => {
          // BP56_sub3 completo. Encadeia para o MetodoPagamentoDialog que trata BP184 (receber pagamento) -> BP185 (registar) -> BP183 (gerar fatura).
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
