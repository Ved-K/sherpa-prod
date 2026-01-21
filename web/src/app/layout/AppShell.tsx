// AppShell.tsx
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, IconButton, useMediaQuery } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useTheme, alpha } from '@mui/material/styles';
import SideNav from './SideNav';
import { brand } from '../theme';

const DRAWER_W = 320;
const RADIUS = 10;

export default function AppShell() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile, location.pathname]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SideNav
        drawerWidth={DRAWER_W}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {isMobile && (
        <IconButton
          onClick={() => setMobileOpen(true)}
          sx={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 1400,
            borderRadius: `${RADIUS}px`,
            bgcolor: alpha('#fff', 0.72),
            border: `1px solid ${alpha('#000', 0.1)}`,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.10)',
            '&:hover': { bgcolor: alpha('#fff', 0.78) },
          }}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </IconButton>
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          ml: { md: `${DRAWER_W}px` },
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
          minWidth: 0,
          bgcolor: alpha('#0b1220', 0.03),
          backgroundImage: `
            radial-gradient(900px 420px at 12% 6%, ${alpha(brand.mint, 0.14)} 0%, transparent 60%),
            radial-gradient(780px 360px at 92% 10%, ${alpha(brand.lemon, 0.14)} 0%, transparent 62%),
            radial-gradient(860px 420px at 86% 88%, ${alpha(brand.caramel, 0.14)} 0%, transparent 62%)
          `,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
