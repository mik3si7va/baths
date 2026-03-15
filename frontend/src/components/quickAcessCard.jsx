import React from 'react';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import { useThemeContext } from '../contexts/ThemeContext';

export default function QuickAcessCard({
    title,
    description,
    icon: Icon,
    buttonText,
    buttonIcon: ButtonIcon,
    href,
    height,
    width,
    minWidth,
}) {
    const { colors } = useThemeContext();


    const cardStyles = {
        borderRadius: 3,
        p: 1,
        height: height,
        ...(width && { width }),
        ...(!width && { flex: 1 }),
        minWidth: minWidth,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.white,
        transition: 'transform 0.2s',
        '&:hover': {
            transform: 'scale(1.02)',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }
    };

    return (
        <Card elevation={2} sx={cardStyles}>
            <CardContent sx={{ 
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}>
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5,
                    mb: 1
                }}>
                    {Icon && (
                        <Icon sx={{ 
                            fontSize: 32, 
                            color: colors.primary
                        }} />
                    )}
                    <Typography variant="h2" sx={{ color: colors.text }}>
                        {title}
                    </Typography>
                </Box>
                
                {/* Descrição */}
                <Typography variant="body1" sx={{ 
                    mb: 2, 
                    color: colors.textSecondary,
                    flex: 1
                }}>
                    {description}
                </Typography>
                
                {/* Botão */}
                <Button
                    variant="contained"
                    startIcon={ButtonIcon && <ButtonIcon />}
                    href={href}
                    sx={{ 
                        mt: 'auto',
                        alignSelf: 'flex-start'
                    }}
                >
                    {buttonText}
                </Button>
            </CardContent>
        </Card>
    );
}