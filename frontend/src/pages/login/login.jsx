import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Link, Paper } from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';
import dogs from '../../assets/login_dogs.jpg';


export default function LoginPage() {
    const { colors } = useThemeContext();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        if (username === 'admin' && password === 'password') {
            localStorage.setItem('usernameB&T', username);
            navigate('/home', { replace: true });
        } else {
            alert('Credenciais inválidas');
        }
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.white,
        }}>
            <Paper elevation={4} sx={{
                width: 380,
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: colors.background,
            }}>
                {/* Cabeçalho com imagem */}
                <Box sx={{ position: 'relative', height: 180, overflow: 'hidden' }}>
                    <img
                        src={dogs}
                        alt="Cães"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                        }}
                    />
                </Box>

                {/* Formulário */}
                <Box
                    component="form"
                    onSubmit={handleLogin}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        p: 3,
                    }}
                >
                    <Typography sx={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color: colors.text,
                        fontFamily: '"Bubblegum Sans", cursive',
                    }}>
                        O sucesso da B&T é escrito com o talento e dedicação de cada um de vocês.
                    </Typography>

                    <TextField
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        fullWidth
                        sx={{ backgroundColor: colors.white, borderRadius: 1 }}
                    />

                    <TextField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        fullWidth
                        sx={{ backgroundColor: colors.white, borderRadius: 1 }}
                    />

                    <Link
                        href="/recuperar-password"
                        underline="hover"
                        sx={{ fontSize: '13px', color: colors.primary, alignSelf: 'flex-start', mt: -1 }}
                    >
                        Esqueceu a palavra-passe?
                    </Link>

                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        sx={{ py: 1.5, fontSize: '15px', fontWeight: 600 }}
                    >
                        Login
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}