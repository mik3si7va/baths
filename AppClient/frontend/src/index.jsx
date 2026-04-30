import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider as MuiThemeProvider } from "@mui/material";
import ClientApp from "./AppClient/ClientApp";
import { ThemeProvider } from "./contexts/ThemeContext";
import { theme } from "./themes/theme";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <ThemeProvider>
        <BrowserRouter>
          <ClientApp />
        </BrowserRouter>
      </ThemeProvider>
    </MuiThemeProvider>
  </React.StrictMode>,
);
