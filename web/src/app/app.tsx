// src/app/App.tsx
import { Route, Routes } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMsal } from '@azure/msal-react';

import AppShell from './layout/AppShell';

import DashboardPage from './pages/DashboardPage';
import StartAssessmentPage from './pages/StartAssessmentPage';
import LinePage from './pages/LinePage';
import MachinePage from './pages/MachinePage';
import CreateTaskPage from './pages/CreateTaskPage';
import CreateStepsPage from './pages/CreateStepsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import AssessTaskPage from './pages/AssessTaskPage';

import { graphScopes } from '../auth/msal'; // adjust path if your auth folder differs

function SignInScreen(props: { onSignIn: () => void; loading: boolean }) {
  const { onSignIn, loading } = props;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="h4" fontWeight={800}>
              Sherpa
            </Typography>

            <Typography variant="body1" color="text.secondary" align="center">
              Sign in with your Unilever Microsoft account to access risk
              assessments, hazards, controls, and dashboards.
            </Typography>

            <Box sx={{ pt: 1, width: '100%' }}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                onClick={onSignIn}
                disabled={loading}
                sx={{ py: 1.2, borderRadius: 2 }}
              >
                {loading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} color="inherit" />
                    <span>Signing in…</span>
                  </Stack>
                ) : (
                  'Sign in with Microsoft'
                )}
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" align="center">
              If you don’t have access, ask your admin to grant Microsoft Graph
              permissions (Sites.ReadWrite.All).
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

export function App() {
  const { instance, accounts, inProgress } = useMsal();
  const signedIn = accounts.length > 0;
  const loading = inProgress !== 'none';

  if (!signedIn) {
    return (
      <SignInScreen
        loading={loading}
        onSignIn={() => instance.loginPopup(graphScopes)}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<DashboardPage />} />

        <Route path="start" element={<StartAssessmentPage />} />
        <Route
          path="risk"
          element={<PlaceholderPage title="Risk management" />}
        />
        <Route path="exports" element={<PlaceholderPage title="Exports" />} />

        <Route path="lines/:lineId" element={<LinePage />} />
        <Route path="machines/:machineId" element={<MachinePage />} />

        {/* ✅ Machine-scoped creation */}
        <Route
          path="machines/:machineId/tasks/new"
          element={<CreateTaskPage />}
        />

        {/* Steps + assess */}
        <Route path="tasks/:taskId/steps/new" element={<CreateStepsPage />} />
        <Route path="tasks/:taskId/assess" element={<AssessTaskPage />} />

        <Route path="*" element={<PlaceholderPage title="404 — Not found" />} />
      </Route>
    </Routes>
  );
}

export default App;
