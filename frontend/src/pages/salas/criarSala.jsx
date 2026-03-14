import React, { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Checkbox,
    FormControlLabel, FormGroup, Paper, Alert
} from '@mui/material';
import { useThemeContext } from '../../contexts/ThemeContext';

export default function CriarSala() {
    const { colors } = useThemeContext();

    const [nome, setNome] = useState('');
    const [capacidade, setCapacidade] = useState('');
    const [equipamento, setEquipamento] = useState('');
    const [precoHora, setPrecoHora] = useState('');
    const [servicos, setServicos] = useState([]);
    const [servicosSelecionados, setServicosSelecionados] = useState([]);
    const [sucesso, setSucesso] = useState(false);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('http://localhost:5000/servicos')
            .then(res => res.json())
            .then(data => setServicos(data))
            .catch(() => setErro('Erro ao carregar serviços.'));
    }, []);

    const toggleServico = (id) => {
        setServicosSelecionados(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro('');
        setSucesso(false);
        setLoading(true);

        try {
            // 1. Criar sala
            const resSala = await fetch('http://localhost:5000/salas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome,
                    capacidade: Number(capacidade),
                    equipamento: equipamento.trim(),
                    precoHora: parseFloat(parseFloat(precoHora).toFixed(2)),
                }),
            });

            if (!resSala.ok) {
                const err = await resSala.json();
                throw new Error(err.error || 'Erro ao criar sala.');
            }

            const sala = await resSala.json();

            // 2. Associar serviços
            if (servicosSelecionados.length > 0) {
                const promises = servicosSelecionados.map(tipoServicoId =>
                    fetch(`http://localhost:5000/salas/${sala.id}/servicos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tipoServicoId }),
                    })
                );
                await Promise.all(promises);
            }

            setSucesso(true);
            setNome('');
            setCapacidade('');
            setEquipamento('');
            setPrecoHora('');
            setServicosSelecionados([]);

        } catch (err) {
            setErro(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
                Criar Sala
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
                Preenche os dados para registar uma nova sala.
            </Typography>

            <Paper elevation={2} sx={{ borderRadius: 3, p: 3, maxWidth: 600 }}>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {sucesso && <Alert severity="success">Sala criada com sucesso!</Alert>}
                    {erro && <Alert severity="error">{erro}</Alert>}

                    <TextField
                        label="Nome da sala"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        required
                        fullWidth
                        placeholder="Ex: Sala de Banho 1, Sala de Tosquia 1, Sala de Tratamentos..."
                    />

                    <TextField
                        label="Capacidade (nº de animais)"
                        type="number"
                        value={capacidade}
                        onChange={e => setCapacidade(e.target.value)}
                        required
                        fullWidth
                        inputProps={{ min: 1 }}
                    />

                    <TextField
                        label="Equipamento"
                        value={equipamento}
                        onChange={e => setEquipamento(e.target.value)}
                        required
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Ex: Banheira, mesa de tosquia, secador..."
                    />

                    <TextField
                        label="Preço por hora (€)"
                        type="number"
                        value={precoHora}
                        onChange={e => setPrecoHora(e.target.value)}
                        required
                        fullWidth
                        inputProps={{ min: 0, step: 0.50 }}
                    />

                    <Typography variant="h2" sx={{ mt: 1, color: colors.text }}>
                        Serviços compatíveis
                    </Typography>

                    <FormGroup sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: 1
                    }}>
                        {servicos.map(servico => (
                            <FormControlLabel
                                key={servico.id}
                                control={
                                    <Checkbox
                                        checked={servicosSelecionados.includes(servico.id)}
                                        onChange={() => toggleServico(servico.id)}
                                        sx={{ 
                                            color: colors.primary, 
                                            '&.Mui-checked': { color: colors.primary } 
                                        }}
                                    />
                                }
                                label={servico.tipo}
                            />
                        ))}
                    </FormGroup>

                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={loading}
                        sx={{ 
                            mt: 2, 
                            py: 1.5,
                            backgroundColor: colors.primary,
                            '&:hover': {
                                backgroundColor: colors.primary + 'dd'
                            }
                        }}
                    >
                        {loading ? 'A criar...' : 'Criar Sala'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}