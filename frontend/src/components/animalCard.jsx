import React from 'react';
import { Box, Chip, Paper, Typography } from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import { porteLabel } from './animalForm';

// Card para apresentar um animal em listas de resultados.
// Usado em /pesquisa e /agendamentos/novo.
//
// Props:
//   animal   - objecto animal. Espera-se que tenha `cliente` anexado (via flatMap)  para mostrar o dono no chip do canto superior direito.
//   onClick  - handler de selecção
//   active   - destaque visual para card seleccionado
export default function AnimalCard({ animal, onClick, active = false }) {
    const subtitle = [
        animal.especie || '--',
        animal.raca,
        animal.porte ? porteLabel(animal.porte) : null,
    ].filter(Boolean).join(' · ');

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
                <PetsIcon sx={{ color: 'text.secondary', fontSize: 18, flexShrink: 0 }} />
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
                    {animal.nome}
                </Typography>
                {animal.cliente?.nome && (
                    <Chip
                        label={`Cliente: ${animal.cliente.nome}`}
                        size="small"
                        sx={{ ml: 'auto', fontSize: 11, fontWeight: 700 }}
                    />
                )}
            </Box>
            <Typography
                variant="body2"
                sx={{
                    color: 'text.secondary',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                }}
            >
                {subtitle}
            </Typography>
        </Paper>
    );
}
