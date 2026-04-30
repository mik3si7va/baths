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
import LoginIcon from "@mui/icons-material/Login";
import PetsIcon from "@mui/icons-material/Pets";
import { useThemeContext } from "../../contexts/ThemeContext";
import { loginClient } from "../clientActions/clientAuthActions";

export default function ClientLogin() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await loginClient(form);
      navigate("../home", { replace: true });
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
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: "100%",
          maxWidth: 430,
          borderRadius: 2,
          overflow: "hidden",
          backgroundColor: colors.white,
        }}
      >
        <Box sx={{ backgroundColor: colors.primary, color: colors.white, p: 3 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <PetsIcon aria-hidden="true" />
            <Typography variant="h1">Area do cliente</Typography>
          </Stack>
          <Typography sx={{ mt: 1, fontSize: 14, opacity: 0.92 }}>
            Acede aos teus animais, marcacoes e dados da tua conta.
          </Typography>
        </Box>

        <Stack component="form" onSubmit={handleSubmit} spacing={2.2} sx={{ p: 3 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            fullWidth
          />

          <TextField
            label="Palavra-passe"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            fullWidth
          />

          <Button
            type="submit"
            variant="contained"
            startIcon={<LoginIcon />}
            sx={{ py: 1.2, textTransform: "none", fontWeight: 700 }}
          >
            Entrar
          </Button>

          <Typography sx={{ fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>
            Ainda nao tens conta?{" "}
            <Link component={RouterLink} to="../registo" underline="hover">
              Criar conta
            </Link>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
