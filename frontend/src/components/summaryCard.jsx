import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useThemeContext } from '../contexts/ThemeContext';

export default function SummaryCard({ icon: Icon, label, value = '—', height, width }) {
    const { colors, cardStyles } = useThemeContext();

    return (
        <Card elevation={2} sx={{...cardStyles, height, ...(width && { width }) }}>
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