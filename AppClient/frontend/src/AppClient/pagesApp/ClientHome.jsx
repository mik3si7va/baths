import React from "react";
import { Box, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PetsIcon from "@mui/icons-material/Pets";
import PersonIcon from "@mui/icons-material/Person";
import { useThemeContext } from "../../contexts/ThemeContext";
import { getClientSession } from "../clientActions/clientAuthActions";

const actions = [
  {
    title: "Animais",
    description: "Gerir os animais associados a tua conta.",
    icon: <PetsIcon />,
  },
  {
    title: "Marcacoes",
    description: "Consultar e preparar pedidos de servico.",
    icon: <CalendarMonthIcon />,
  },
  {
    title: "Perfil",
    description: "Ver dados pessoais e estado da conta.",
    icon: <PersonIcon />,
  },
];

export default function ClientHome() {
  const { colors } = useThemeContext();
  const session = getClientSession();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" sx={{ color: colors.text, mb: 0.5 }}>
          Ola, {session?.nome || "cliente"}
        </Typography>
        <Typography sx={{ color: colors.textSecondary }}>
          Esta e a base da area cliente. Daqui podes evoluir para animais, marcacoes e perfil.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {actions.map((action) => (
          <Grid item xs={12} md={4} key={action.title}>
            <Paper
              elevation={0}
              sx={{
                height: "100%",
                p: 2.5,
                borderRadius: 2,
                border: `1px solid ${colors.background}`,
                backgroundColor: colors.white,
              }}
            >
              <Stack spacing={1.5}>
                <Box sx={{ color: colors.primary, display: "flex" }}>{action.icon}</Box>
                <Typography variant="h2">{action.title}</Typography>
                <Typography sx={{ minHeight: 44, color: colors.textSecondary, fontSize: 14 }}>
                  {action.description}
                </Typography>
                <Button variant="outlined" disabled sx={{ textTransform: "none", alignSelf: "flex-start" }}>
                  Em breve
                </Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
