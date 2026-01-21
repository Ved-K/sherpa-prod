import { createTheme } from '@mui/material/styles';

export const brand = {
  heartRed: '#E4002B',
  corporateBlack: '#212721',
  warmWhite: '#FDF9F6',
  vanilla: '#F2E9DB',

  wafer: '#E1B87F',
  ice: '#DDE5ED',
  cocoa: '#8D3F2B',
  berry: '#F7CED7',
  mint: '#71B790',
  peach: '#E2665C',
  caramel: '#EA7600',
  pistachio: '#D6CF8D',
  lemon: '#FBD872',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.heartRed },
    secondary: { main: brand.lemon },
    background: {
      default: brand.warmWhite,
      paper: '#FFFFFF',
    },
    text: {
      primary: brand.corporateBlack,
    },
    success: { main: brand.mint },
    warning: { main: brand.caramel },
    error: { main: brand.heartRed },
    info: { main: brand.ice },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'system-ui', 'Arial'].join(','),
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid rgba(33,39,33,0.08)`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid rgba(33,39,33,0.08)`,
          background: '#FFFFFF',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#FFFFFF',
          color: brand.corporateBlack,
          borderBottom: `1px solid rgba(33,39,33,0.08)`,
          boxShadow: 'none',
        },
      },
    },
  },
});

export default theme;
