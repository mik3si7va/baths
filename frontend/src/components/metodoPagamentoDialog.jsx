import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, FormControl, RadioGroup, Radio, FormControlLabel, Alert,
} from '@mui/material';

// Pop-up para escolha do método de pagamento após check-out.
// Métodos alinhados com `MetodoPagamentoEnum` em schema.prisma - DINHEIRO, MULTIBANCO, TRANSFERENCIA.

const METODOS = [
    { value: 'MULTIBANCO', label: 'Multibanco' },
    { value: 'DINHEIRO', label: 'Dinheiro' },
    { value: 'TRANSFERENCIA', label: 'Transferência' },
];

export default function MetodoPagamentoDialog({ open, onClose, onConfirmar, loading }) {
    const [metodo, setMetodo] = useState('MULTIBANCO');
    const [erro, setErro] = useState('');

    const fechar = () => {
        if (loading) return;
        setErro('');
        onClose();
    };

    const confirmar = async () => {
        setErro('');
        try {
            await onConfirmar(metodo);
        } catch (e) {
            setErro(e.message || 'Falha ao registar pagamento.');
        }
    };

    return (
        <Dialog open={open} onClose={fechar} maxWidth="xs" fullWidth>
            <DialogTitle>Registar pagamento</DialogTitle>
            <DialogContent dividers>
                <FormControl>
                    <RadioGroup value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                        {METODOS.map((m) => (
                            <FormControlLabel
                                key={m.value}
                                value={m.value}
                                control={<Radio />}
                                label={m.label}
                                disabled={loading}
                            />
                        ))}
                    </RadioGroup>
                </FormControl>
                {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={fechar} disabled={loading}>
                    Voltar
                </Button>
                <Button onClick={confirmar} variant="contained" color="success" disabled={loading}>
                    {loading ? 'A processar...' : 'Confirmar pagamento'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
