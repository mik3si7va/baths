import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert, Box, Chip, CircularProgress, IconButton, InputBase,
    Paper, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useThemeContext } from '../../contexts/ThemeContext';
import { fmtDataHoraUTC } from '../../utils/agendamentosCalendar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function filtrarFaturas(faturas, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return faturas;
    return faturas.filter((f) => {
        const c = f.conteudoJson || {};
        const dataStr = fmtDataHoraUTC(f.dataEmissao).toLowerCase();
        return (
            f.numero?.toLowerCase().includes(q) ||
            c.clienteNome?.toLowerCase().includes(q) ||
            c.animalNome?.toLowerCase().includes(q) ||
            (c.clienteNif && c.clienteNif.includes(q)) ||
            dataStr.includes(q)
        );
    });
}

export default function Faturas() {
    const { colors } = useThemeContext();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [faturas, setFaturas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    useEffect(() => {
        async function carregar() {
            try {
                setLoading(true);
                setErro('');
                const res = await fetch(`${API_BASE_URL}/faturas`);
                if (!res.ok) throw new Error(`Erro ${res.status}`);
                const data = await res.json();
                setFaturas(Array.isArray(data) ? data : []);
            } catch (e) {
                setErro(e.message || 'Erro ao carregar faturas.');
            } finally {
                setLoading(false);
            }
        }
        carregar();
    }, []);

    const faturasFiltradas = useMemo(() => filtrarFaturas(faturas, query), [faturas, query]);

    return (
        <Box>
            <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
                Faturação
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
                Lista de faturas emitidas. Pesquise por número, data, nome do cliente, NIF ou nome do animal.
            </Typography>

            {/* Barra de pesquisa */}
            <Paper
                elevation={1}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    borderRadius: 3,
                    mb: 4,
                }}
            >
                <SearchIcon sx={{ color: colors.textSecondary, mr: 1 }} />
                <InputBase
                    fullWidth
                    placeholder="Pesquisar por número, data, cliente, NIF ou animal..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    sx={{ fontSize: 14 }}
                    inputProps={{ 'data-testid': 'faturas-search-input' }}
                />
                {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
                {query && (
                    <IconButton size="small" onClick={() => setQuery('')} aria-label="Limpar pesquisa">
                        <ClearIcon fontSize="small" />
                    </IconButton>
                )}
            </Paper>

            {erro && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErro('')}>
                    {erro}
                </Alert>
            )}

            {/* Lista de faturas */}
            <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h2" sx={{ color: colors.text }}>
                        Faturas emitidas
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                        {faturasFiltradas.length} {faturasFiltradas.length === 1 ? 'fatura' : 'faturas'}
                    </Typography>
                </Box>

                {!loading && faturas.length === 0 && (
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                        Ainda não existem faturas emitidas.
                    </Typography>
                )}

                {!loading && faturas.length > 0 && faturasFiltradas.length === 0 && (
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                        Nenhuma fatura encontrada para "{query}".
                    </Typography>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {faturasFiltradas.map((fatura) => {
                        const c = fatura.conteudoJson || {};
                        return (
                            <Paper
                                key={fatura.id}
                                variant="outlined"
                                onClick={() => navigate(`/faturas/${fatura.id}`)}
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        borderColor: colors.primary,
                                    },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                    <ReceiptLongIcon sx={{ fontSize: 20, color: colors.primary }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.text }}>
                                        {fatura.numero}
                                    </Typography>
                                    <Chip
                                        size="small"
                                        label={fmtDataHoraUTC(fatura.dataEmissao)}
                                        variant="outlined"
                                        sx={{ fontSize: '11px', height: 22 }}
                                    />
                                </Box>

                                <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                                    {c.clienteNome ?? '-'}
                                    {c.clienteNif ? ` | NIF: ${c.clienteNif}` : ''}
                                    {c.animalNome ? ` | Animal: ${c.animalNome}` : ''}
                                </Typography>

                                <Typography variant="body2" sx={{ color: colors.text, mt: 0.5, fontWeight: 600 }}>
                                    Total: {Number(fatura.valorTotal).toFixed(2)} €
                                </Typography>
                            </Paper>
                        );
                    })}
                </Box>
            </Paper>
        </Box>
    );
}
