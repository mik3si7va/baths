import React, { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import { useThemeContext } from "../../contexts/ThemeContext";
import { registerClient } from "../clientActions/clientAuthActions";

export default function ClientRegister() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    nif: "",
    morada: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await registerClient(form);
      navigate("../home", {
        replace: true,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        backgroundColor: colors.background,
        px: 2,
        py: 3,
      }}
    >
      <Paper elevation={3} sx={{ width: "100%", maxWidth: 520, borderRadius: 2 }}>
        <Box sx={{ p: 3, borderBottom: `1px solid ${colors.background}` }}>
          <Typography variant="h1" sx={{ color: colors.text }}>
            Criar conta cliente
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 14, color: colors.textSecondary }}>
            Estes dados ficam preparados para ligar ao Utilizador e Cliente da base de dados.
          </Typography>
        </Box>

        <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ p: 3 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField label="Nome" name="nome" value={form.nome} onChange={handleChange} required fullWidth />
          <TextField label="Email" name="email" type="email" value={form.email} onChange={handleChange} required fullWidth />
          <TextField label="Telefone" name="telefone" value={form.telefone} onChange={handleChange} required fullWidth />
          <TextField label="NIF" name="nif" value={form.nif} onChange={handleChange} fullWidth />
          <TextField label="Morada" name="morada" value={form.morada} onChange={handleChange} fullWidth />
          <TextField label="Palavra-passe" name="password" type="password" value={form.password} onChange={handleChange} required fullWidth />
          <TextField label="Confirmar palavra-passe" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required fullWidth />

          <Button
            type="submit"
            variant="contained"
            startIcon={<PersonAddAltIcon />}
            sx={{ py: 1.2, textTransform: "none", fontWeight: 700 }}
          >
            Criar conta
          </Button>

          <Typography sx={{ fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>
            Ja tens conta?{" "}
            <Link component={RouterLink} to="../login" underline="hover">
              Entrar
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
