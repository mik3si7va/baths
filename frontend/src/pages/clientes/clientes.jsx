import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  MenuItem,
  Divider,
  IconButton,
  Collapse,
  InputAdornment,
  InputBase,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PetsIcon from "@mui/icons-material/Pets";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useThemeContext } from "../../contexts/ThemeContext";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const PORTE_OPTIONS = [
  { value: "EXTRA_PEQUENO", label: "Extra Pequeno (0.5 – 4.5 kg)" },
  { value: "PEQUENO", label: "Pequeno (5 – 9 kg)" },
  { value: "MEDIO", label: "Médio (9.5 – 13.5 kg)" },
  { value: "GRANDE", label: "Grande (14 – 18 kg)" },
  { value: "EXTRA_GRANDE", label: "Extra Grande (18.5+ kg)" },
];

const porteLabel = (value) => {
  const opt = PORTE_OPTIONS.find((p) => p.value === value);
  return opt ? opt.label.split("(")[0].trim() : value;
};

const initialClienteForm = {
  nome: "",
  email: "",
  telefone: "",
  password: "",
  confirmarPassword: "",
  nif: "",
  morada: "",
};

const initialAnimalForm = {
  nome: "",
  especie: "",
  raca: "",
  porte: "",
  dataNascimento: "",
  alergias: "",
  observacoes: "",
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_ORDER = ["cliente", "animal", "concluido", "animal_extra"];

function StepIndicator({ passo }) {
  const steps = [
    { label: "1. Cliente", key: "cliente" },
    { label: "2. Animal", key: "animal" },
    { label: "3. Concluído", key: "concluido" },
  ];

  const idx = STEP_ORDER.indexOf(passo);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
      {steps.map((step, i) => {
        const stepIdx = STEP_ORDER.indexOf(step.key);
        const isAtivo =
          step.key === passo ||
          (passo === "animal_extra" && step.key === "concluido");
        const isConcluido =
          stepIdx < idx &&
          !(passo === "animal_extra" && step.key === "concluido");

        return (
          <React.Fragment key={step.key}>
            <Chip
              label={step.label}
              size="small"
              color={isAtivo ? "primary" : isConcluido ? "success" : "default"}
              variant={isAtivo ? "filled" : "outlined"}
              sx={{ fontWeight: isAtivo ? 700 : 400 }}
            />
            {i < steps.length - 1 && (
              <Box
                sx={{
                  width: 24,
                  height: 1,
                  backgroundColor: "#aaa",
                  opacity: 0.4,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

// ─── Componente de Pesquisa/Seleção de Cliente (BET-127) ──────────────────────

function ClienteSearch({ clientes, onClienteSelected, loading }) {
  const { colors } = useThemeContext();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefone?.includes(q) ||
        (c.nif && c.nif.includes(q)),
    );
  }, [clientes, query]);

  const showDropdown = focused && query.trim().length > 0;

  return (
    <Box sx={{ position: "relative" }}>
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 0.5,
          borderRadius: 2,
          borderColor: focused ? colors.primary : undefined,
          boxShadow: focused ? `0 0 0 2px ${colors.primary}22` : undefined,
          transition: "all 0.2s",
        }}
      >
        <SearchIcon sx={{ color: colors.textSecondary, mr: 1 }} />
        <InputBase
          fullWidth
          placeholder="Pesquisar por nome, email, telefone ou NIF..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          inputProps={{ "data-testid": "cliente-search-input" }}
          sx={{ fontSize: "14px" }}
        />
        {loading && <CircularProgress size={16} sx={{ mr: 1 }} />}
        {query && (
          <IconButton size="small" onClick={() => setQuery("")} edge="end">
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Paper>

      {showDropdown && (
        <Paper
          elevation={4}
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1300,
            mt: 0.5,
            borderRadius: 2,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Nenhum cliente encontrado para "{query}".
              </Typography>
            </Box>
          ) : (
            filtered.map((c) => (
              <Box
                key={c.id}
                onMouseDown={() => {
                  onClienteSelected(c);
                  setQuery("");
                }}
                sx={{
                  px: 2,
                  py: 1.5,
                  cursor: "pointer",
                  borderBottom: "1px solid #f0f0f0",
                  "&:hover": { backgroundColor: "#f5f0e8" },
                  "&:last-child": { borderBottom: "none" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PersonIcon sx={{ fontSize: 16, color: colors.primary }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {c.nome}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${c.animais?.length ?? 0} ${(c.animais?.length ?? 0) === 1 ? "animal" : "animais"}`}
                    variant="outlined"
                    color="primary"
                    sx={{ fontSize: "10px", height: 18 }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: colors.textSecondary, pl: 3 }}
                >
                  {c.email} | {c.telefone}
                  {c.nif ? ` | NIF: ${c.nif}` : ""}
                </Typography>
              </Box>
            ))
          )}
        </Paper>
      )}
    </Box>
  );
}

// ─── Formulário do Cliente (Passo 1) ─────────────────────────────────────────

function ClienteForm({ onClienteCriado }) {
  const { colors } = useThemeContext();
  const [form, setForm] = useState(initialClienteForm);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const validate = () => {
    if (!form.nome.trim()) return "Nome é obrigatório.";
    if (!form.email.trim()) return "Email é obrigatório.";
    if (!form.telefone.trim()) return "Telefone é obrigatório.";
    if (!form.password.trim()) return "Password é obrigatória.";
    if (form.password.trim().length < 8)
      return "A password deve ter pelo menos 8 caracteres.";
    if (form.password !== form.confirmarPassword)
      return "As passwords não coincidem.";
    if (form.nif.trim() && !/^\d{9}$/.test(form.nif.trim()))
      return "O NIF deve ter 9 dígitos numéricos.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    const err = validate();
    if (err) {
      setErro(err);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone.trim(),
          password: form.password.trim(),
          nif: form.nif.trim() || undefined,
          morada: form.morada.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Erro (${res.status})`);
      onClienteCriado(body);
    } catch (err) {
      setErro(err.message || "Erro ao registar cliente.");
    } finally {
      setLoading(false);
    }
  };

  const eyeBtn = (show, toggle) => (
    <InputAdornment position="end">
      <IconButton onClick={toggle} edge="end" size="small">
        {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {erro && (
        <Alert severity="error" onClose={() => setErro("")}>
          {erro}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          gap: 2,
        }}
      >
        <TextField
          label="Nome completo"
          name="nome"
          value={form.nome}
          onChange={(e) => set("nome", e.target.value)}
          required
          fullWidth
          placeholder="Ex: João Silva"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          required
          fullWidth
          placeholder="Ex: joao.silva@email.com"
          helperText="Será usado para acesso ao sistema."
        />
        <TextField
          label="Telefone"
          name="telefone"
          value={form.telefone}
          onChange={(e) =>
            set("telefone", e.target.value.replace(/\D/g, "").slice(0, 15))
          }
          required
          fullWidth
          placeholder="Ex: 910000000"
        />
        <TextField
          label="NIF (opcional)"
          name="nif"
          value={form.nif}
          onChange={(e) =>
            set("nif", e.target.value.replace(/\D/g, "").slice(0, 9))
          }
          fullWidth
          inputProps={{ maxLength: 9 }}
          placeholder="Ex: 123456789"
          helperText="9 dígitos numéricos."
        />
        <TextField
          label="Morada (opcional)"
          name="morada"
          value={form.morada}
          onChange={(e) => set("morada", e.target.value)}
          fullWidth
          placeholder="Ex: Rua das Flores, 10, Lisboa"
          sx={{ gridColumn: { md: "1 / -1" } }}
        />

        <Divider sx={{ gridColumn: "1 / -1", my: 0.5 }} />

        <TextField
          label="Password"
          name="password"
          type={showPwd ? "text" : "password"}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          required
          fullWidth
          helperText="Mínimo 8 caracteres."
          InputProps={{
            endAdornment: eyeBtn(showPwd, () => setShowPwd((v) => !v)),
          }}
        />
        <TextField
          label="Confirmar password"
          name="confirmarPassword"
          type={showConf ? "text" : "password"}
          value={form.confirmarPassword}
          onChange={(e) => set("confirmarPassword", e.target.value)}
          required
          fullWidth
          InputProps={{
            endAdornment: eyeBtn(showConf, () => setShowConf((v) => !v)),
          }}
        />
      </Box>

      <Button
        type="submit"
        variant="contained"
        disabled={loading}
        sx={{
          mt: 1,
          py: 1.5,
          alignSelf: "flex-start",
          backgroundColor: colors.primary,
          "&:hover": { backgroundColor: `${colors.primary}dd` },
        }}
      >
        {loading ? (
          <CircularProgress size={22} sx={{ color: "#fff" }} />
        ) : (
          "Continuar para o Animal →"
        )}
      </Button>
    </Box>
  );
}

// ─── Formulário do Animal (BET-126) ──────────────────────────────────────────
// Campos obrigatórios: nome, espécie, data de nascimento e porte (BET-126)

function AnimalForm({
  clienteId,
  clienteNome,
  endpoint,
  onAnimalCriado,
  onCancelar,
  isFirst = false,
  submitLabel,
}) {
  const { colors } = useThemeContext();
  const [form, setForm] = useState(initialAnimalForm);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const today = new Date().toISOString().split("T")[0];

  // BET-126: nome, espécie, data de nascimento e porte são obrigatórios
  const validate = () => {
    if (!form.nome.trim()) return "Nome do animal é obrigatório.";
    if (!form.especie.trim()) return "Espécie é obrigatória.";
    if (!form.dataNascimento) return "Data de nascimento é obrigatória.";
    if (form.dataNascimento > today)
      return "A data de nascimento não pode ser futura.";
    if (!form.porte) return "Porte é obrigatório.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    const err = validate();
    if (err) {
      setErro(err);
      return;
    }
    setLoading(true);
    try {
      const url = endpoint || `${API_BASE_URL}/clientes/${clienteId}/animais`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setErro(err.message || "Erro ao registar animal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {erro && (
        <Alert severity="error" onClose={() => setErro("")}>
          {erro}
        </Alert>
      )}
      {isFirst && (
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          É obrigatório registar pelo menos um animal para{" "}
          <strong>{clienteNome}</strong>. O cliente só fica ativo após este
          passo.
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          gap: 2,
        }}
      >
        {/* Nome — obrigatório (BET-126) */}
        <TextField
          label="Nome do animal"
          name="nomeAnimal"
          value={form.nome}
          onChange={(e) => set("nome", e.target.value)}
          required
          fullWidth
          placeholder="Ex: Rex"
        />

        {/* Espécie — obrigatório (BET-126) */}
        <TextField
          label="Espécie"
          name="especie"
          value={form.especie}
          onChange={(e) => set("especie", e.target.value)}
          required
          fullWidth
          placeholder="Ex: Cão, Gato..."
        />

        {/* Raça — opcional */}
        <TextField
          label="Raça (opcional)"
          name="raca"
          value={form.raca}
          onChange={(e) => set("raca", e.target.value)}
          fullWidth
          placeholder="Ex: Labrador"
        />

        {/* Porte — obrigatório para cálculo de preço */}
        <TextField
          select
          label="Porte"
          name="porte"
          value={form.porte}
          onChange={(e) => set("porte", e.target.value)}
          required
          fullWidth
        >
          {PORTE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Data de nascimento — obrigatório (BET-126: critério 2) */}
        <TextField
          label="Data de nascimento"
          name="dataNascimento"
          type="date"
          value={form.dataNascimento}
          onChange={(e) => set("dataNascimento", e.target.value)}
          required
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText="Obrigatório."
          inputProps={{
            max: today,
          }}
        />

        {/* Alergias — opcional (BET-126: critério 3 — observações) */}
        <TextField
          label="Alergias (opcional)"
          name="alergias"
          value={form.alergias}
          onChange={(e) => set("alergias", e.target.value)}
          fullWidth
          placeholder="Ex: Pólen, determinados champôs..."
        />

        {/* Observações — opcional (BET-126: critério 3) */}
        <TextField
          label="Observações / Cuidados especiais (opcional)"
          name="observacoes"
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          fullWidth
          multiline
          minRows={2}
          placeholder="Informações adicionais relevantes, cuidados especiais..."
          sx={{ gridColumn: { md: "1 / -1" } }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap" }}>
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
            "&:hover": { backgroundColor: `${colors.primary}dd` },
          }}
        >
          {loading ? (
            <CircularProgress size={22} sx={{ color: "#fff" }} />
          ) : (
            submitLabel || (isFirst ? "Confirmar Registo" : "Adicionar Animal")
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

// ─── Card de cliente na lista ─────────────────────────────────────────────────

function ClienteCard({ cliente, onAddAnimal }) {
  const { colors } = useThemeContext();
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 0.5,
              flexWrap: "wrap",
            }}
          >
            <PersonIcon sx={{ fontSize: 20, color: colors.primary }} />
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: colors.text }}
            >
              {cliente.nome}
            </Typography>
            <Chip
              size="small"
              label={cliente.ativo ? "Ativo" : "Inativo"}
              color={cliente.ativo ? "success" : "default"}
              sx={{ fontSize: "11px", height: 22 }}
            />
            {(cliente.animais?.length ?? 0) > 0 && (
              <Chip
                size="small"
                icon={<PetsIcon sx={{ fontSize: "14px !important" }} />}
                label={`${cliente.animais.length ?? 0} ${(cliente.animais.length ?? 0) === 1 ? "animal" : "animais"}`}
                variant="outlined"
                color="primary"
                sx={{ fontSize: "11px", height: 22 }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            {cliente.email} | {cliente.telefone}
            {cliente.nif ? ` | NIF: ${cliente.nif}` : ""}
            {cliente.morada ? ` | ${cliente.morada}` : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => onAddAnimal(cliente)}
            sx={{ fontSize: "12px", whiteSpace: "nowrap" }}
          >
            Animal
          </Button>
          {(cliente.animais?.length ?? 0) > 0 && (
            <IconButton
              size="small"
              onClick={() => setExpanded((v) => !v)}
              sx={{ color: colors.textSecondary }}
              title={expanded ? "Ocultar animais" : "Ver animais"}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {(cliente.animais || []).map((a) => (
            <Box
              key={a.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
                pl: 0.5,
              }}
            >
              <PetsIcon sx={{ fontSize: 16, color: colors.primary }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: colors.text }}
              >
                {a.nome}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {a.especie}
                {a.raca ? ` · ${a.raca}` : ""}
              </Typography>
              <Chip
                size="small"
                label={porteLabel(a.porte)}
                variant="outlined"
                sx={{ fontSize: "10px", height: 20 }}
              />
              {a.dataNascimento && (
                <Typography
                  variant="body2"
                  sx={{ color: colors.textSecondary, fontSize: "11px" }}
                >
                  n.{" "}
                  {new Date(a.dataNascimento + "T00:00:00").toLocaleDateString(
                    "pt-PT",
                  )}
                </Typography>
              )}
              {a.alergias && (
                <Chip
                  size="small"
                  label={`Alergias: ${a.alergias}`}
                  color="warning"
                  variant="outlined"
                  sx={{ fontSize: "10px", height: 20 }}
                />
              )}
              {a.observacoes && (
                <Typography
                  variant="body2"
                  sx={{
                    color: colors.textSecondary,
                    fontSize: "11px",
                    fontStyle: "italic",
                  }}
                >
                  {a.observacoes}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Client() {
  const { colors } = useThemeContext();

  const [passo, setPasso] = useState("cliente");
  const [clienteAtual, setClienteAtual] = useState(null);
  const [animaisRegistados, setAnimaisRegistados] = useState([]);
  const [clienteParaAnimal, setClienteParaAnimal] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const carregarClientes = useCallback(async () => {
    setLoadingClientes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clientes`);
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch {
      setClientes([]);
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  const clienteId = clienteAtual?.id ?? clienteAtual?.cliente?.id;
  const clienteNome = clienteAtual?.nome ?? clienteAtual?.cliente?.nome;
  const clienteEmail = clienteAtual?.email ?? clienteAtual?.cliente?.email;

  const handleClienteCriado = (c) => {
    setClienteAtual(c);
    setAnimaisRegistados([]);
    setMensagemSucesso("");
    setPasso("animal");
  };

  const handleConfirmarComAnimal = (result) => {
    const animal = result.animal ?? result;
    const clienteConfirmado = result.cliente ?? clienteAtual;
    setClienteAtual(clienteConfirmado);
    setAnimaisRegistados([animal]);
    setMensagemSucesso(
      `Registo concluído! Cliente "${clienteConfirmado.nome ?? clienteConfirmado.cliente?.nome}" e animal "${animal.nome}" registados com sucesso.`,
    );
    setPasso("concluido");
    carregarClientes();
  };

  const handleCancelarNoAnimal = async () => {
    if (clienteId) {
      try {
        await fetch(`${API_BASE_URL}/clientes/${clienteId}`, {
          method: "DELETE",
        });
      } catch {
        /* job de limpeza trata depois */
      }
    }
    setClienteAtual(null);
    setAnimaisRegistados([]);
    setPasso("cliente");
  };

  const handleAnimalExtraCriado = (a) => {
    setAnimaisRegistados((prev) => [...prev, a]);
    setMensagemSucesso(`Animal "${a.nome}" adicionado com sucesso!`);
    setPasso("concluido");
    carregarClientes();
  };

  const handleAddAnimalAClienteExistente = (c) => {
    setClienteParaAnimal(c);
    setMensagemSucesso("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClienteSearchSelected = (c) => {
    handleAddAnimalAClienteExistente(c);
  };

  const handleAnimalAdicionadoAClienteExistente = (a) => {
    setMensagemSucesso(
      `Animal "${a.nome}" adicionado a "${clienteParaAnimal.nome}" com sucesso!`,
    );
    setClienteParaAnimal(null);
    carregarClientes();
  };

  const handleNovoRegisto = () => {
    setClienteAtual(null);
    setAnimaisRegistados([]);
    setMensagemSucesso("");
    setPasso("cliente");
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Registo de Clientes e Animais
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Registo interno de novos clientes com os seus animais, ou adição de
        animais a clientes existentes. O cliente só fica ativo após registar
        pelo menos um animal.
      </Typography>

      {/* ── Painel: adicionar animal a cliente existente (BET-126 + BET-127) ── */}
      {clienteParaAnimal && (
        <Paper
          elevation={2}
          sx={{
            borderRadius: 3,
            p: 3,
            mb: 4,
            border: `2px solid ${colors.primary}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <PetsIcon sx={{ color: colors.primary }} />
            <Typography variant="h2" sx={{ color: colors.text }}>
              Adicionar Animal — {clienteParaAnimal.nome}
            </Typography>
          </Box>
          <AnimalForm
            clienteId={clienteParaAnimal.id}
            clienteNome={clienteParaAnimal.nome}
            endpoint={`${API_BASE_URL}/clientes/${clienteParaAnimal.id}/animais`}
            onAnimalCriado={handleAnimalAdicionadoAClienteExistente}
            onCancelar={() => setClienteParaAnimal(null)}
          />
        </Paper>
      )}

      {/* Sucesso após animal a cliente existente */}
      {mensagemSucesso && passo === "cliente" && !clienteParaAnimal && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => setMensagemSucesso("")}
        >
          {mensagemSucesso}
        </Alert>
      )}

      {/* ── BET-127: Pesquisa rápida de cliente para adicionar animal ── */}
      {!clienteParaAnimal && passo === "cliente" && (
        <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <SearchIcon sx={{ color: colors.primary }} />
            <Typography variant="h2" sx={{ color: colors.text }}>
              Adicionar Animal a Cliente Existente
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ color: colors.textSecondary, mb: 2 }}
          >
            Pesquise um cliente registado para adicionar um novo animal à sua
            ficha.
          </Typography>
          <ClienteSearch
            clientes={clientes}
            onClienteSelected={handleClienteSearchSelected}
            loading={loadingClientes}
          />
        </Paper>
      )}

      {/* ── Formulário multi-step ── */}
      {!clienteParaAnimal && (
        <Paper elevation={2} sx={{ borderRadius: 3, p: 3, mb: 4 }}>
          <StepIndicator passo={passo} />

          {/* PASSO 1 */}
          {passo === "cliente" && (
            <>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
              >
                <PersonIcon sx={{ color: colors.primary }} />
                <Typography variant="h2" sx={{ color: colors.text }}>
                  Dados do Cliente
                </Typography>
              </Box>
              <ClienteForm onClienteCriado={handleClienteCriado} />
            </>
          )}

          {/* PASSO 2 */}
          {passo === "animal" && clienteAtual && (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Dados de <strong>"{clienteNome}"</strong> guardados
                temporariamente. Registe agora o primeiro animal para confirmar
                o registo.
              </Alert>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
              >
                <PetsIcon sx={{ color: colors.primary }} />
                <Typography variant="h2" sx={{ color: colors.text }}>
                  Primeiro Animal
                </Typography>
              </Box>
              <AnimalForm
                clienteId={clienteId}
                clienteNome={clienteNome}
                endpoint={`${API_BASE_URL}/clientes/${clienteId}/animais/confirmar`}
                onAnimalCriado={handleConfirmarComAnimal}
                onCancelar={handleCancelarNoAnimal}
                isFirst
              />
            </>
          )}

          {/* PASSO 3: Concluído */}
          {passo === "concluido" && clienteAtual && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="success">{mensagemSucesso}</Alert>

              <Box sx={{ p: 2, backgroundColor: "#f6fbf6", borderRadius: 2 }}>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <PersonIcon sx={{ fontSize: 18, color: colors.primary }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {clienteNome}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: colors.textSecondary }}
                  >
                    {clienteEmail}
                  </Typography>
                </Box>
                {animaisRegistados.map((a) => (
                  <Box
                    key={a.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      pl: 2,
                    }}
                  >
                    <PetsIcon sx={{ fontSize: 14, color: colors.primary }} />
                    <Typography variant="body2">
                      {a.nome} — {a.especie}
                      {a.raca ? ` · ${a.raca}` : ""}
                    </Typography>
                    {a.dataNascimento && (
                      <Typography
                        variant="body2"
                        sx={{ color: colors.textSecondary, fontSize: "11px" }}
                      >
                        n.{" "}
                        {new Date(
                          a.dataNascimento + "T00:00:00",
                        ).toLocaleDateString("pt-PT")}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>

              <Divider />

              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Deseja adicionar mais animais a <strong>{clienteNome}</strong>?
              </Typography>

              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setMensagemSucesso("");
                    setPasso("animal_extra");
                  }}
                >
                  Adicionar Outro Animal
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNovoRegisto}
                  sx={{
                    backgroundColor: colors.primary,
                    "&:hover": { backgroundColor: `${colors.primary}dd` },
                  }}
                >
                  Novo Registo de Cliente
                </Button>
              </Box>
            </Box>
          )}

          {/* PASSO EXTRA: mais animais ao mesmo cliente */}
          {passo === "animal_extra" && clienteAtual && (
            <>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
              >
                <PetsIcon sx={{ color: colors.primary }} />
                <Typography variant="h2" sx={{ color: colors.text }}>
                  Adicionar Animal — {clienteNome}
                </Typography>
              </Box>
              {mensagemSucesso && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {mensagemSucesso}
                </Alert>
              )}
              <AnimalForm
                clienteId={clienteId}
                clienteNome={clienteNome}
                endpoint={`${API_BASE_URL}/clientes/${clienteId}/animais`}
                onAnimalCriado={handleAnimalExtraCriado}
                onCancelar={() => setPasso("concluido")}
              />
            </>
          )}
        </Paper>
      )}

      {/* ── Lista de clientes ── */}
      <Paper elevation={2} sx={{ borderRadius: 3, p: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h2" sx={{ color: colors.text }}>
            Clientes Registados
          </Typography>
          {loadingClientes && <CircularProgress size={20} />}
        </Box>

        {!loadingClientes && clientes.length === 0 && (
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Ainda não existem clientes registados.
          </Typography>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {clientes.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              onAddAnimal={handleAddAnimalAClienteExistente}
            />
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
