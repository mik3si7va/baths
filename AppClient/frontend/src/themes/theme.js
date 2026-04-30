import { createTheme } from "@mui/material/styles";

export const colors = {
  primary: "#475C51",
  background: "#F5F0E8",
  surface: "#FFFFFF",
  text: "#102622",
  textSecondary: "#666666",
  error: "#E53935",
  success: "#4caf50",
};

export const theme = createTheme({
  palette: {
    primary: {
      main: colors.primary,
    },
    error: {
      main: colors.error,
    },
    success: {
      main: colors.success,
    },
    background: {
      default: colors.background,
      paper: colors.surface,
    },
    text: {
      primary: colors.text,
      secondary: colors.textSecondary,
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: "Inter, Arial, sans-serif",
    h1: { fontSize: "24px", fontWeight: 700 },
    h2: { fontSize: "18px", fontWeight: 600 },
    body1: { fontSize: "14px", fontWeight: 400 },
    button: { fontSize: "14px", fontWeight: 700, textTransform: "none" },
  },
});
