import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { fmtDataHoraUTC } from '../../utils/agendamentosCalendar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// US - BET-43: vista imprimível da fatura emitida.
// A página chama GET /faturas/:id e renderiza o documento.
// O botão "Imprimir" usa window.print() - o CSS @media print esconde tudo o que não seja o doc da fatura
// (cabeçalho da página, sidebar, botão de imprimir).
// Browser converte para PDF nativamente via Ctrl+P -> Save as PDF - não precisamos de biblioteca PDF dedicada.
//
// Estrutura do response (vinda do backend, registo cru):
//   { id, numero, tipo, valorTotal, metodoPagamento, pagoEm, dataEmissao,
//     conteudoJson: { clienteNome, animalNome, servicos: [{ nome, duracao,
//     valorSemIva, valorIva, valorComIva }], subTotalSemIva, valorIva, valorTotal, ... } }
//
// O `tipo` distingue SERVICO_INTERNO (BET-43) de ALUGUER_SALA (BET-44 futuro).
// Esta página renderiza SERVICO_INTERNO; quando ALUGUER_SALA existir, adicionar um switch por `tipo` antes do return para escolher o template.

const METODO_LABELS = {
    DINHEIRO: 'Dinheiro',
    MULTIBANCO: 'Multibanco',
    TRANSFERENCIA: 'Transferência',
};

export default function FaturaDetalhe() {
    const { faturaId } = useParams();
    const [fatura, setFatura] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    useEffect(() => {
        async function carregar() {
            try {
                setLoading(true);
                setErro('');
                const res = await fetch(`${API_BASE_URL}/faturas/${faturaId}`);
                if (!res.ok) throw new Error(res.status === 404 ? 'Fatura não encontrada.' : `Erro ${res.status}`);
                const data = await res.json();
                setFatura(data);
            } catch (e) {
                setErro(e.message || 'Erro ao carregar fatura.');
            } finally {
                setLoading(false);
            }
        }
        carregar();
    }, [faturaId]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (erro) {
        return <Alert severity="error" sx={{ m: 3 }}>{erro}</Alert>;
    }

    if (!fatura) return null;

    const conteudo = fatura.conteudoJson || {};
    const servicos = conteudo.servicos || [];

    return (
        <>
            {/*
              CSS de impressão: esconde tudo o que não esteja dentro de `.fatura-print`.
              Aplicado globalmente via <style>; quando o utilizador imprime, só o documento fica visível, sem sidebar/header da aplicação.
            */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .fatura-print, .fatura-print * { visibility: visible; }
                    .fatura-print { position: absolute; top: 0; left: 0; width: 100%; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <Box className="no-print" sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<PrintIcon />}
                    onClick={() => window.print()}
                >
                    Imprimir / Guardar PDF
                </Button>
            </Box>

            <Paper className="fatura-print" elevation={2} sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
                {/* Cabeçalho */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>B&T</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Gratos pela preferência! Volte sempre.
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>FATURA</Typography>
                        <Typography variant="body2">{fatura.numero}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Emitida em {fmtDataHoraUTC(fatura.dataEmissao)}
                        </Typography>
                    </Box>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                {/* Cliente + Animal */}
                <Stack direction="row" spacing={4} sx={{ mb: 3 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="overline" color="text.secondary">Cliente</Typography>
                        <Typography>{conteudo.clienteNome ?? '-'}</Typography>
                        {conteudo.clienteEmail && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                {conteudo.clienteEmail}
                            </Typography>
                        )}
                        {conteudo.clienteTelefone && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                Tel: {conteudo.clienteTelefone}
                            </Typography>
                        )}
                        {conteudo.clienteNif && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                NIF: {conteudo.clienteNif}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="overline" color="text.secondary">Animal</Typography>
                        <Typography>{conteudo.animalNome ?? '-'}</Typography>
                    </Box>
                </Stack>

                {/* Tabela de serviços - discriminação fiscal por linha */}
                <Typography variant="overline" color="text.secondary">Serviços prestados</Typography>
                <Table size="small" sx={{ mb: 3 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Serviço</TableCell>
                            <TableCell align="right">Duração</TableCell>
                            <TableCell align="right">Sem IVA</TableCell>
                            <TableCell align="right">IVA</TableCell>
                            <TableCell align="right">Total</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {servicos.map((s, i) => (
                            <TableRow key={i}>
                                <TableCell>{s.nome}</TableCell>
                                <TableCell align="right">{s.duracao} min</TableCell>
                                <TableCell align="right">{Number(s.valorSemIva ?? 0).toFixed(2)} €</TableCell>
                                <TableCell align="right">{Number(s.valorIva ?? 0).toFixed(2)} €</TableCell>
                                <TableCell align="right">{Number(s.valorComIva ?? 0).toFixed(2)} €</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Divider sx={{ mb: 2 }} />

                {/* Total + Pagamento */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                    <Box>
                        <Typography variant="overline" color="text.secondary">Método de pagamento</Typography>
                        <Typography>
                            {METODO_LABELS[fatura.metodoPagamento] ?? fatura.metodoPagamento ?? '-'}
                        </Typography>
                        {fatura.pagoEm && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                Pago em {fmtDataHoraUTC(fatura.pagoEm)}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Stack spacing={0.5} alignItems="flex-end">
                            <Stack direction="row" spacing={3}>
                                <Typography variant="body2" color="text.secondary">Subtotal (sem IVA):</Typography>
                                <Typography variant="body2">{Number(conteudo.subTotalSemIva ?? 0).toFixed(2)} €</Typography>
                            </Stack>
                            <Stack direction="row" spacing={3}>
                                <Typography variant="body2" color="text.secondary">IVA ({conteudo.taxaIva ?? 23}%):</Typography>
                                <Typography variant="body2">{Number(conteudo.valorIva ?? 0).toFixed(2)} €</Typography>
                            </Stack>
                            <Divider sx={{ width: '100%', my: 0.5 }} />
                            <Typography variant="overline" color="text.secondary">Total</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                {Number(fatura.valorTotal).toFixed(2)} €
                            </Typography>
                        </Stack>
                    </Box>
                </Stack>
            </Paper>
        </>
    );
}
