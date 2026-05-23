import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useThemeContext } from '../contexts/ThemeContext';

// US - BET-126: formulário de registo de animal (extraído de pages/clientes/clientes.jsx).
// Reutilizado em /agendamentos/novo (cliente novo) após criar o cliente.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ajustes: opções de porte do animal exibidas no select.
// Os `value` têm de corresponder ao `PorteEnum` no backend/prisma/schema.prisma - mudar só aqui não chega.
// Para adicionar um novo porte (ex: 'GIGANTE'):
//   1. Adicionar ao `enum PorteEnum` em schema.prisma
//   2. `npx prisma migrate dev` para criar a migration
//   3. Criar `RegraPreco` para cada `TipoServico` × novo porte (ou ficam sem preço)
//   4. Adicionar entrada aqui: { value: 'GIGANTE', label: 'Gigante (X kg+)' }
//   5. Repetir no swagger.js (`PorteEnum`)
// Os `label` são livres (só UI) - podes ajustar pesos/descrição sem tocar no schema.
export const PORTE_OPTIONS = [
  { value: 'EXTRA_PEQUENO', label: 'Extra Pequeno (0.5 – 4.5 kg)' },
  { value: 'PEQUENO', label: 'Pequeno (5 – 9 kg)' },
  { value: 'MEDIO', label: 'Médio (9.5 – 13.5 kg)' },
  { value: 'GRANDE', label: 'Grande (14 – 18 kg)' },
  { value: 'EXTRA_GRANDE', label: 'Extra Grande (18.5+ kg)' },
];

// Devolve o nome legível do porte (sem a parte "(0.5 – 4.5 kg)" do label).
// Ex.: porteLabel('EXTRA_GRANDE') → 'Extra Grande'.
export const porteLabel = (value) => {
  const opt = PORTE_OPTIONS.find((p) => p.value === value);
  return opt ? opt.label.split('(')[0].trim() : value;
};

const initialAnimalForm = {
  nome: '',
  especie: '',
  raca: '',
  porte: '',
  dataNascimento: '',
  alergias: '',
  observacoes: '',
};

export default function AnimalForm({
  clienteId,
  clienteNome,
  endpoint,
  onAnimalCriado,
  onCancelar,
  isFirst = false,
  submitLabel,
  initialPorte,
}) {
  const { colors } = useThemeContext();
  const [form, setForm] = useState(() => ({
    ...initialAnimalForm,
    porte: initialPorte || '',
  }));
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const today = new Date().toISOString().split('T')[0];

  // BET-126: nome, espécie, data de nascimento e porte são obrigatórios
  const validate = () => {
    if (!form.nome.trim()) return 'Nome do animal é obrigatório.';
    if (!form.especie.trim()) return 'Espécie é obrigatória.';
    if (!form.dataNascimento) return 'Data de nascimento é obrigatória.';
    if (form.dataNascimento > today)
      return 'A data de nascimento não pode ser futura.';
    if (!form.porte) return 'Porte é obrigatório.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    const err = validate();
    if (err) {
      setErro(err);
      return;
    }
    setLoading(true);
    try {
      const url = endpoint || `${API_BASE_URL}/clientes/${clienteId}/animais`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          nome: form.nome.trim(),
          especie: form.especie.trim(),
          raca: form.raca.trim() || undefined,
          porte: form.porte || undefined,
          dataNascimento: form.dataNascimento,
          alergias: form.alergias.trim() || undefined,
          observacoes: form.observacoes.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Erro (${res.status})`);
      setForm(initialAnimalForm);
      onAnimalCriado(body);
    } catch (err) {
      setErro(err.message || 'Erro ao registar animal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {erro && (
        <Alert severity="error" onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}
      {isFirst && (
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          É obrigatório registar pelo menos um animal para{' '}
          <strong>{clienteNome}</strong>. O cliente só fica ativo após este
          passo.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        {/* Nome - obrigatório (BET-126) */}
        <TextField
          label="Nome do animal"
          name="nomeAnimal"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
          required
          fullWidth
          placeholder="Ex: Rex"
        />

        {/* Espécie - obrigatório (BET-126) */}
        <TextField
          label="Espécie"
          name="especie"
          value={form.especie}
          onChange={(e) => set('especie', e.target.value)}
          required
          fullWidth
          placeholder="Ex: Cão, Gato..."
        />

        {/* Raça - opcional */}
        <TextField
          label="Raça (opcional)"
          name="raca"
          value={form.raca}
          onChange={(e) => set('raca', e.target.value)}
          fullWidth
          placeholder="Ex: Labrador"
        />

        {/* Porte - obrigatório para cálculo de preço */}
        <TextField
          select
          label="Porte"
          name="porte"
          value={form.porte}
          onChange={(e) => set('porte', e.target.value)}
          required
          fullWidth
        >
          {PORTE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Data de nascimento - obrigatório (BET-126: critério 2) */}
        <TextField
          label="Data de nascimento"
          name="dataNascimento"
          type="date"
          value={form.dataNascimento}
          onChange={(e) => set('dataNascimento', e.target.value)}
          required
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText="Obrigatório."
          inputProps={{
            max: today,
          }}
        />

        {/* Alergias - opcional (BET-126: critério 3 - observações) */}
        <TextField
          label="Alergias (opcional)"
          name="alergias"
          value={form.alergias}
          onChange={(e) => set('alergias', e.target.value)}
          fullWidth
          placeholder="Ex: Pólen, determinados champôs..."
        />

        {/* Observações - opcional (BET-126: critério 3) */}
        <TextField
          label="Observações / Cuidados especiais (opcional)"
          name="observacoes"
          value={form.observacoes}
          onChange={(e) => set('observacoes', e.target.value)}
          fullWidth
          multiline
          minRows={2}
          placeholder="Informações adicionais relevantes, cuidados especiais..."
          sx={{ gridColumn: { md: '1 / -1' } }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          startIcon={
            loading ? null : isFirst ? <CheckCircleOutlineIcon /> : <AddIcon />
          }
          sx={{
            py: 1.5,
            backgroundColor: colors.primary,
            '&:hover': { backgroundColor: `${colors.primary}dd` },
          }}
        >
          {loading ? (
            <CircularProgress size={22} sx={{ color: '#fff' }} />
          ) : (
            submitLabel || (isFirst ? 'Confirmar Registo' : 'Adicionar Animal')
          )}
        </Button>
        {onCancelar && (
          <Button variant="outlined" onClick={onCancelar} sx={{ py: 1.5 }}>
            Cancelar
          </Button>
        )}
      </Box>
    </Box>
  );
}
