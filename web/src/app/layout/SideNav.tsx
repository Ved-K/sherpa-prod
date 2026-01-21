// SideNav.tsx
import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import DashboardIcon from '@mui/icons-material/Dashboard';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';

import { brand } from '../theme';

const LOGO_SRC = '/tmicclogo.svg';
const RADIUS = 10;

type Props = {
  drawerWidth: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function SideNav({
  drawerWidth,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const loc = useLocation();

  const items = useMemo(
    () => [
      { label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
      {
        label: 'Start risk assessment',
        to: '/start',
        icon: <PlayCircleOutlineIcon />,
      },
      { label: 'Risk management', to: '/risk', icon: <ShieldOutlinedIcon /> },
      { label: 'Exports', to: '/exports', icon: <DownloadOutlinedIcon /> },
    ],
    [],
  );

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Box
          sx={{
            borderRadius: `${RADIUS}px`,
            border: `1px solid ${alpha('#000', 0.1)}`,
            bgcolor: alpha('#fff', 0.7),
            backdropFilter: 'blur(12px)',
            px: 1.5,
            py: 1.25,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              component="img"
              src={LOGO_SRC}
              alt="TMICC"
              sx={{ height: 36, width: 'auto', display: 'block' }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 950, letterSpacing: 0.2 }}>
                SHERPA
              </Typography>
              <Typography
                sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 750 }}
              >
                Unilever TMICC
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      <Divider />

      {/* Nav */}
      <Box sx={{ px: 1.25, pt: 1.5 }}>
        <Typography
          sx={{
            px: 1.25,
            pb: 1,
            fontSize: 11.5,
            fontWeight: 950,
            letterSpacing: 0.8,
            color: 'text.secondary',
          }}
        >
          NAVIGATION
        </Typography>

        <List sx={{ py: 0 }}>
          {items.map((it) => {
            const selected =
              loc.pathname === it.to || loc.pathname.startsWith(it.to + '/');

            return (
              <ListItemButton
                key={it.to}
                component={NavLink}
                to={it.to}
                onClick={() => mobileOpen && onCloseMobile()}
                selected={selected}
                sx={{
                  borderRadius: `${RADIUS}px`,
                  mx: 1,
                  mb: 0.75,
                  py: 1.05,
                  border: `1px solid ${alpha('#000', selected ? 0.1 : 0.06)}`,
                  bgcolor: selected
                    ? alpha(brand.heartRed, 0.08)
                    : 'transparent',
                  '&:hover': {
                    bgcolor: selected
                      ? alpha(brand.heartRed, 0.12)
                      : alpha('#000', 0.03),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: selected ? brand.heartRed : 'inherit',
                  }}
                >
                  {it.icon}
                </ListItemIcon>
                <ListItemText
                  primary={it.label}
                  primaryTypographyProps={{ fontWeight: selected ? 950 : 750 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box sx={{ px: 2.25, pb: 2 }}>
        <Typography
          sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 750 }}
        >
          © Sherpa • Unilever TMICC
        </Typography>
      </Box>
    </Box>
  );

  const paperSx = {
    width: drawerWidth,
    boxSizing: 'border-box',
    borderRight: `1px solid ${alpha('#000', 0.08)}`,
    bgcolor: alpha('#fff', 0.7),
    backdropFilter: 'blur(14px)',
  };

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': paperSx,
        }}
      >
        {content}
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': paperSx,
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
