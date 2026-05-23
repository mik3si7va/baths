import React from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PetsIcon from '@mui/icons-material/Pets';

// Card uniforme para apresentar um cliente em listas de resultados.
// Usado em /pesquisa e /agendamentos/novo - formato e estilo num único sítio.
//
// Props:
//   cliente        - objecto cliente (com nome, email, telefone, animais)
//   onClick        - handler quando o card é clicado (selecionar cliente)
//   onAnimalClick  - handler quando um chip de animal é clicado. Quando definido, rende uma linha de chips de animais por baixo do subtítulo.
//   active         - destaque visual para card seleccionado
export default function ClienteCard({ cliente, onClick, onAnimalClick, active = false }) {
    const animais = cliente.animais ?? [];
    const qtd = animais.length;

    return (
        <Paper
            onMouseDown={onClick}
            sx={{
                p: 2,
                mb: 1,
                borderRadius: 3,
                cursor: onClick ? 'pointer' : 'default',
                border: '1px solid',
                borderColor: active ? 'primary.main' : 'divider',
                backgroundColor: active ? 'rgba(25, 118, 210, 0.06)' : 'background.paper',
                transition: 'background-color 0.2s ease',
                overflow: 'hidden',
            }}
            elevation={active ? 3 : 1}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, minWidth: 0 }}>
                <PersonIcon sx={{ color: 'primary.main', fontSize: 18, flexShrink: 0 }} />
                <Typography
                    variant="subtitle2"
                    sx={{
                        fontWeight: 700,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        flex: 1,
                        minWidth: 0,
                    }}
                >
                    {cliente.nome}
                </Typography>
                <Chip
                    label={`${qtd} ${qtd === 1 ? 'animal' : 'animais'}`}
                    size="small"
                    color="primary"
                    sx={{ ml: 'auto', fontSize: 11, fontWeight: 700 }}
                />
            </Box>
            <Typography
                variant="body2"
                sx={{
                    color: 'text.secondary',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                }}
            >
                {`${cliente.email || '--'} · ${cliente.telefone || '--'}`}
            </Typography>
            {onAnimalClick && qtd > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
                    {animais.map((a) => (
                        <Chip
                            key={a.id}
                            icon={<PetsIcon />}
                            label={a.nome}
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAnimalClick({ ...a, cliente });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            sx={{ cursor: 'pointer' }}
                        />
                    ))}
                </Stack>
            )}
        </Paper>
    );
}
