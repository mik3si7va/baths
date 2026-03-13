import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#475C51',
    },
    error: {
      main: '#E53935',
    },
    success: {
      main: '#4CAF82',
    },
    background: {
      default: '#FFFFFF',
    },
    text: {
      primary: '#102622',
    },
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    h1: { fontSize: '24px', fontWeight: 700 },
    h2: { fontSize: '18px', fontWeight: 600 },
    body1: { fontSize: '14px', fontWeight: 400 },
    caption: { fontSize: '12px', fontWeight: 500 },
  },
});