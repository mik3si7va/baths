import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Link, Paper, TextField, Typography } from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';
import dogs from '../../assets/login_dogs.jpg';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function LoginPage() {
    const { colors } = useThemeContext();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setErro('');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                }),
            });

            const body = await response.json();
            if (!response.ok) {
                throw new Error(body.error || 'Credenciais invalidas');
            }

            localStorage.setItem('btUser', JSON.stringify(body.user));
            localStorage.setItem('usernameB&T', body.user.email);
            navigate('/home', { replace: true });
        } catch (error) {
            setErro(error.message || 'Credenciais invalidas');
        } finally {
            setLoading(false);
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
                <Box sx={{ position: 'relative', height: 180, overflow: 'hidden' }}>
                    <img
                        src={dogs}
                        alt="Caes"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                        }}
                    />
                </Box>

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
                        O sucesso da B&T e escrito com o talento e dedicacao de cada um de voces.
                    </Typography>

                    {erro && <Alert severity="error">{erro}</Alert>}

                    <TextField
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                        disabled={loading}
                        sx={{ py: 1.5, fontSize: '15px', fontWeight: 600 }}
                    >
                        {loading ? <CircularProgress size={24} sx={{ color: colors.white }} /> : 'Login'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}
