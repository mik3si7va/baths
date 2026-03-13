import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './themes';
import { ThemeProvider } from './contexts/ThemeContext';
import RoutesApp from './routes';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <ThemeProvider>
        <RoutesApp />
      </ThemeProvider>
    </MuiThemeProvider>
  </React.StrictMode>
);
