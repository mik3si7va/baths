import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import PetsIcon from "@mui/icons-material/Pets";
import { useThemeContext } from "../../contexts/ThemeContext";
import { getClientSession, logoutClient } from "../clientActions/clientAuthActions";

export default function ClientLayout() {
  const { colors } = useThemeContext();
  const navigate = useNavigate();
  const session = getClientSession();

  const handleLogout = () => {
    logoutClient();
    navigate("../login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: colors.background }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{ backgroundColor: colors.primary, color: colors.white }}
      >
        <Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <PetsIcon aria-hidden="true" />
            <Typography sx={{ fontWeight: 700 }}>B&T Cliente</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            {session?.nome && (
              <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: 14 }}>
                {session.nome}
              </Typography>
            )}
            <Button
              color="inherit"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Sair
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
