import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useThemeContext } from '../contexts/ThemeContext';

// Tamanho fixo (80 × 238) para evitar reflow desconfortável ao redimensionar a janela.
// Se um caller precisar de outro tamanho pontual, pode sobrepor via props.
export default function SummaryCard({ icon: Icon, label, value = '-', height = 80, width = 238 }) {
    const { colors, cardStyles } = useThemeContext();

    return (
        <Card elevation={2} sx={{ ...cardStyles, height, ...(width && { width }) }}>
            <CardContent sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                height: '100%'
            }}>
                <Icon sx={{ fontSize: 40, color: colors.primary }} />
                <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        {label}
                    </Typography>
                    <Typography variant="h1" sx={{ color: colors.text }}>
                        {value}
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}