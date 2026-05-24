import React, { useState, useEffect } from "react";
import { Box, Typography, Grid } from "@mui/material";
import { useThemeContext } from "../../contexts/ThemeContext";
import { SummaryCard, QuickAcessCard } from "../../components";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PeopleIcon from "@mui/icons-material/People";
import PetsIcon from "@mui/icons-material/Pets";
import BadgeIcon from "@mui/icons-material/Badge";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import PaymentIcon from "@mui/icons-material/Payment";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("btUser") || "null");
  } catch (_error) {
    return null;
  }
}

export default function Home() {
  const { colors } = useThemeContext();
  const [user] = useState(() => getStoredUser());
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalAnimais: 0,
    totalFuncionarios: 0,
    totalSalas: 0,
    agendConfirmados: 0,
    agendEmAtendimento: 0,
    agendConcluidos: 0,
    agendNaoCompareceuOuCancelados: 0,
  });
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.tipoConta === "ADMIN";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Janela do dia de hoje em ISO local (00:00 -> 23:59:59.999)
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        const fimDia = new Date();
        fimDia.setHours(23, 59, 59, 999);

        const [clientesRes, funcionariosRes, salasRes, agendamentosRes] = await Promise.all([
          fetch(`${API_BASE_URL}/clientes`),
          fetch(`${API_BASE_URL}/funcionarios`),
          fetch(`${API_BASE_URL}/salas`),
          fetch(
            `${API_BASE_URL}/agendamentos?dataFrom=${inicioDia.toISOString()}&dataTo=${fimDia.toISOString()}`,
          ),
        ]);

        const [clientes, funcionarios, salas, agendamentosHoje] = await Promise.all([
          clientesRes.json(),
          funcionariosRes.json(),
          salasRes.json(),
          agendamentosRes.json(),
        ]);

        const totalClientes = Array.isArray(clientes) ? clientes.length : 0;
        const totalAnimais = Array.isArray(clientes)
          ? clientes.reduce((acc, cliente) => acc + (cliente.animais?.length || 0), 0)
          : 0;

        // getAllFuncionarios não filtra por estado da conta — descartamos inactivos no cliente para ficar consistente com a contagem de Clientes/Salas (que já filtram no backend).
        const totalFuncionarios = Array.isArray(funcionarios)
          ? funcionarios.filter((f) => f.ativo).length
          : 0;
        const totalSalas = Array.isArray(salas) ? salas.length : 0;

        const lista = Array.isArray(agendamentosHoje) ? agendamentosHoje : [];
        const porEstado = lista.reduce((acc, a) => {
          acc[a.estado] = (acc[a.estado] || 0) + 1;
          return acc;
        }, {});

        setStats({
          totalClientes,
          totalAnimais,
          totalFuncionarios,
          totalSalas,
          agendConfirmados: porEstado.CONFIRMADO || 0,
          agendEmAtendimento: porEstado.EM_ATENDIMENTO || 0,
          agendConcluidos: porEstado.CONCLUIDO || 0,
          agendNaoCompareceuOuCancelados:
            (porEstado.NAO_COMPARECEU || 0) + (porEstado.CANCELADO || 0),
        });
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Cards da secção "Hoje" — agendamentos do dia agrupados por estado
  const agendamentosHojeCards = [
    { icon: EventAvailableIcon, label: "Confirmados", value: stats.agendConfirmados },
    { icon: HourglassBottomIcon, label: "Em Atendimento", value: stats.agendEmAtendimento },
    { icon: TaskAltIcon, label: "Concluídos", value: stats.agendConcluidos },
    // Camcelados + Não comapreceu
    { icon: EventBusyIcon, label: "Cancelados", value: stats.agendNaoCompareceuOuCancelados },
  ];

  // Cards da secção "Visão geral" — totais da clínica
  const cardData = [
    { icon: PeopleIcon, label: "Clientes", value: stats.totalClientes },
    { icon: PetsIcon, label: "Animais", value: stats.totalAnimais },
    { icon: BadgeIcon, label: "Funcionários", value: stats.totalFuncionarios },
    { icon: MeetingRoomIcon, label: "Salas", value: stats.totalSalas },
  ];

  // Dados dos cards de acesso rápido (Quick Acess Cards)
  const quickAcessCardsData = [
    {
      title: "Novo Agendamento",
      description: "Registar um agendamento para um cliente novo.",
      icon: AddIcon,
      buttonText: "Agendar",
      buttonIcon: CalendarMonthIcon,
      href: "/agendamentos/novo",
      height: 180,
      width: 328,
    },
    {
      title: "Pesquisar Clientes",
      description: "Encontre clientes e animais registados no sistema.",
      icon: SearchIcon,
      buttonText: "Pesquisar",
      buttonIcon: SearchIcon,
      href: "/pesquisa",
      height: 180,
      width: 328,
    },
    {
      title: "Clientes",
      description: "Criar fichas de clientes e dos seus animais.",
      icon: PeopleIcon,
      buttonText: "Gerir",
      buttonIcon: PeopleIcon,
      href: "/clientes",
      height: 180,
      width: 328,
    },
    {
      title: "Faturação",
      description: "Gerir faturas e pagamentos pendentes.",
      icon: PaymentIcon,
      buttonText: "Pagar",
      buttonIcon: PaymentIcon,
      href: "/billing",
      height: 180,
      width: 328,
    },
    {
      title: "Serviços",
      description: "Criar e gerir serviços, portes e regras de preço.",
      icon: ContentCutIcon,
      buttonText: "Gerir",
      buttonIcon: ShoppingCartIcon,
      href: "/servicos",
      height: 180,
      width: 328,
    },
    {
      title: "Funcionários",
      description: isAdmin
        ? "Criar e gerir equipa, horários e especialidades."
        : "Consultar equipa, horários, especialidades e agendas.",
      icon: BadgeIcon,
      buttonText: isAdmin ? "Gerir" : "Ver",
      buttonIcon: PeopleIcon,
      href: "/funcionarios",
      height: 180,
      width: 328,
    },
    {
      title: "Contas",
      description: "Ativar, desativar e preparar acessos ao backoffice.",
      icon: ManageAccountsIcon,
      buttonText: "Gerir",
      buttonIcon: ManageAccountsIcon,
      href: "/contas",
      height: 180,
      width: 328,
    },
    {
      title: "Salas",
      description: isAdmin
        ? "Criar e gerir salas, equipamentos, serviços e preço."
        : "Consultar salas, serviços compatíveis e disponibilidade.",
      icon: MeetingRoomIcon,
      buttonText: isAdmin ? "Gerir" : "Ver",
      buttonIcon: AddBusinessIcon,
      href: "/salas",
      height: 180,
      width: 328,
    },
  ];
  const visibleQuickAcessCardsData = isAdmin
    ? quickAcessCardsData
    : quickAcessCardsData.filter(
        (card) => !["/servicos", "/contas"].includes(card.href),
      );

  return (
    <>
      {/* Título */}
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Bem-vindo à sua segunda casa!
      </Typography>

      {/* Subtítulo */}
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Vamos começar com um dia produtivo.
      </Typography>

      {/* SECÇÃO 1: AGENDAMENTOS DE HOJE */}
      <Typography variant="h2" sx={{ mb: 2, color: colors.text }}>
        Hoje
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {agendamentosHojeCards.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <SummaryCard
              icon={item.icon}
              label={item.label}
              value={loading ? "..." : item.value}
            />
          </Grid>
        ))}
      </Grid>

      {/* SECÇÃO 2: VISÃO GERAL DA CLÍNICA */}
      <Typography variant="h2" sx={{ mb: 2, color: colors.text }}>
        Visão geral
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {cardData.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <SummaryCard
              icon={item.icon}
              label={item.label}
              value={loading ? "..." : item.value}
            />
          </Grid>
        ))}
      </Grid>

      {/* SECÇÃO 3: ACESSO RÁPIDO */}
      <Typography variant="h2" sx={{ mb: 2, color: colors.text }}>
        Acesso Rápido
      </Typography>

      {/* Grid de Quick Acess Cards */}
      <Box
        sx={{
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          justifyContent: "flex-start",
        }}
      >
        {visibleQuickAcessCardsData.map((card, index) => (
          <QuickAcessCard
            key={index}
            title={card.title}
            description={card.description}
            icon={card.icon}
            buttonText={card.buttonText}
            buttonIcon={card.buttonIcon}
            href={card.href}
            height={card.height}
            width={card.width}
          />
        ))}
      </Box>
    </>
  );
}
