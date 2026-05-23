import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import PetsIcon from "@mui/icons-material/Pets";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to="/home" replace />;
  }

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("Preenche o email e a palavra-passe.");
      return;
    }

    try {
      login({ email: form.email, password: form.password });
    } catch (err) {
      setError(err.message);
      return;
    }

    navigate(location.state?.from?.pathname || "/home", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={2}
        sx={{ width: "100%", maxWidth: 420, p: 3, borderRadius: 2 }}
      >
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <PetsIcon color="primary" />
            <Box>
              <Typography variant="h1">Area do cliente</Typography>
              <Typography color="text.secondary">Login simples para comecar.</Typography>
            </Box>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Palavra-passe"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" startIcon={<LoginIcon />}>
            Entrar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
