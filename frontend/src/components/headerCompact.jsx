import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useThemeContext } from '../contexts/ThemeContext';


export default function HeaderCompact({ showBack = false }) {
    const { colors } = useThemeContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('usernameB&T');
        navigate('/login');
    };

    return (
        <Box sx={{
            width: '100%',
            height: 60,
            backgroundColor: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>

            {/* Esquerda — botão voltar (opcional) + logo */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    position: 'relative',
                    zIndex: 1
                }}>
                {showBack && (
                    <IconButton
                        sx={{
                            color: colors.white,
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' },
                        }}
                        title="Voltar"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                )}

                <Typography
                    sx={{
                        color: colors.white,
                        fontSize: '24px',
                        fontWeight: 700,
                        fontFamily: '"Bubblegum Sans", cursive',
                        lineHeight: 1.2,
                        cursor: 'pointer'
                    }}
                    onClick={() => navigate('/home')}
                >
                    B&T
                </Typography>
            </Box>

            {/* Direita — navegação */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,  // ← Espaço entre os botões
                zIndex: 1,
                position: 'relative',
            }}>
                <Button
                    sx={{
                        color: colors.white,
                        fontSize: { xs: '13px', sm: '16px' },
                        minWidth: 'auto',
                        px: { xs: 1, sm: 2 }
                    }}
                    onClick={() => navigate('/home')}
                >
                    Home
                </Button>
                <Button
                    sx={{
                        color: colors.white,
                        fontSize: { xs: '13px', sm: '16px' },
                        minWidth: 'auto',
                        px: { xs: 1, sm: 2 }
                    }}
                    onClick={() => navigate('/calendar')}
                >
                    Agenda
                </Button>
                <Button
                    variant="contained"
                    sx={{
                        backgroundColor: '#ffffff6d',
                        color: colors.white,
                        fontSize: { xs: '13px', sm: '16px' },
                        px: { xs: 1, sm: 2 },
                        minWidth: 'auto',
                        '&:hover': { backgroundColor: '#f0f0f0' }
                    }}
                    onClick={handleLogout}
                >
                    Logout
                </Button>
            </Box>
        </Box>
    );
}