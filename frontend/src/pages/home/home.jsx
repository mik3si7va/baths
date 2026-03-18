import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';
import { SummaryCard, QuickAcessCard } from '../../components';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PeopleIcon from '@mui/icons-material/People';
import PetsIcon from '@mui/icons-material/Pets';
import BadgeIcon from '@mui/icons-material/Badge';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PaymentIcon from '@mui/icons-material/Payment';

export default function Home() {
    const { colors } = useThemeContext();

    // Dados dos cards
    const cardData = [
        { icon: PeopleIcon, label: 'Clientes', height: 80, width: 238 },
        { icon: PetsIcon, label: 'Animais', height: 80, width: 238 },
        { icon: BadgeIcon, label: 'Funcionários', height: 80, width: 238 },
        { icon: MeetingRoomIcon, label: 'Salas', height: 80, width: 238 },
    ];

    // Dados dos cards de acesso rápido (Quick Acess Cards)
    const quickAcessCardsData = [
        {
            title: 'Nova Consulta',
            description: 'Agendar uma nova consulta para um cliente.',
            icon: AddIcon,
            buttonText: 'Agendar',
            buttonIcon: CalendarMonthIcon,
            href: '/calendar/new',
            height: 180,
            width: 328
        },
        {
            title: 'Pesquisar Cliente',
            description: 'Encontrar clientes e histórico de consultas.',
            icon: SearchIcon,
            buttonText: 'Pesquisar',
            buttonIcon: SearchIcon,
            href: '/search',
            height: 180,
            width: 328
        },
        {
            title: 'Faturação',
            description: 'Gerir faturas e pagamentos pendentes.',
            icon: PaymentIcon,
            buttonText: 'Pagar',
            buttonIcon: PaymentIcon,
            href: '/billing',
            height: 180,
            width: 328
        }
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
            <Box sx={{ 
                display: 'flex', 
                gap: 3, 
                flexWrap: 'wrap',
                justifyContent: 'flex-start'
            }}>
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

