import React from "react";
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

export default function Home() {
  const { colors } = useThemeContext();

  // Dados dos cards
  const cardData = [
    { icon: PeopleIcon, label: "Clientes", height: 80, width: 238 },
    { icon: PetsIcon, label: "Animais", height: 80, width: 238 },
    { icon: BadgeIcon, label: "Funcionários", height: 80, width: 238 },
    { icon: MeetingRoomIcon, label: "Salas", height: 80, width: 238 },
  ];

  // Dados dos cards de acesso rápido (Quick Acess Cards)
  const quickAcessCardsData = [
    {
      title: "Nova Consulta",
      description: "Agendar uma nova consulta para um cliente.",
      icon: AddIcon,
      buttonText: "Agendar",
      buttonIcon: CalendarMonthIcon,
      href: "/calendar/new",
      height: 180,
      width: 328,
    },
    {
      title: "Pesquisar Clientes e Animais",
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
      description: "Gerir clientes e seus animais de forma rápida.",
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
      description: "Criar e gerir equipa, horários e especialidades.",
      icon: BadgeIcon,
      buttonText: "Gerir",
      buttonIcon: PeopleIcon,
      href: "/funcionarios",
      height: 180,
      width: 328,
    },
    {
      title: "Salas",
      description: "Criar e gerir salas, equipamentos, serviços e preço.",
      icon: MeetingRoomIcon,
      buttonText: "Gerir",
      buttonIcon: AddBusinessIcon,
      href: "/salas",
      height: 180,
      width: 328,
    },
  ];

  return (
    <>
      {/* Título */}
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Bem-vindo
      </Typography>

      {/* Subtítulo */}
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Aqui tens um resumo do estado actual da clínica.
      </Typography>

      {/* SECÇÃO 1: CARDS DE RESUMO */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {cardData.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <SummaryCard
              icon={item.icon}
              label={item.label}
              height={item.height}
              width={item.width}
            />
          </Grid>
        ))}
      </Grid>

      {/* SECÇÃO 2: ACESSO RÁPIDO */}
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
        {quickAcessCardsData.map((card, index) => (
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
