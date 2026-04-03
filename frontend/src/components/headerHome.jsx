import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../contexts/ThemeContext';
import header from '../assets/home_header.jpg';

export default function Header() {
    const { colors, sizes } = useThemeContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('usernameB&T');
        navigate('/login');
    };

    return (
        <Box sx={{
            position: 'relative',
            width: '100%',
            height: sizes.headerHeight,
            overflow: 'hidden'
        }}>
            <img
                src={header}
                alt="Header"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                }}
            />
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: 2,
                py: 1,
                background: colors.headerOverlay,
            }}>
                <Typography
                    sx={{
                        color: colors.black,
                        fontSize: sizes.logoFont,
                        fontWeight: 700,
                        fontFamily: '"Bubblegum Sans", cursive',
                        lineHeight: 1.7,
                        flexShrink: 0,
                        //cursor: 'pointer'
                    }}
                //onClick={() => navigate('/home')}
                >
                    B&T
                </Typography>
                <Box sx={{ display: 'flex', gap: 0 }}>
                    {/*<Button
                        sx={{
                            color: colors.black,
                            fontSize: sizes.buttonFont,
                            minWidth: 'auto',
                            px: { xs: 1, sm: 2 }
                        }}
                        onClick={() => navigate('/home')}
                    >
                        Home
                    </Button>*/}
                    <Button
                        sx={{
                            color: colors.black,
                            fontSize: sizes.buttonFont,
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
                            color: colors.black,
                            fontSize: sizes.buttonFont,
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
        </Box>
    );
}