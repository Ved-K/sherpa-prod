// src/app/pages/CreateTaskPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';

import { api } from '../api/client';
import { brand } from '../theme';

const RADIUS = 10;

type Machine = {
  id: string;
  name: string;
};

type TaskCreateBody = {
  name: string;
  description?: string | null;
  trainingLink?: string | null;
};

type Task = {
  id: string;
  machineId: string;
  name: string;
};

async function getMachine(machineId: string) {
  return api<Machine>(`/machines/${machineId}`);
}

async function createTask(machineId: string, body: TaskCreateBody) {
  return api<Task>(`/machines/${machineId}/tasks`, { method: 'POST', body });
}

export default function CreateTaskPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const nav = useNavigate();

  const machineIdStr = machineId ?? '';

  const [machine, setMachine] = useState<Machine | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trainingLink, setTrainingLink] = useState('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const glassCard = {
    borderRadius: `${RADIUS}px`,
    border: `1px solid ${alpha('#000', 0.08)}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    bgcolor: alpha('#fff', 0.74),
    backdropFilter: 'blur(10px)',
  } as const;

  useEffect(() => {
    if (!machineIdStr) return;
    let alive = true;

    (async () => {
      try {
        setMachine(null);
        const m = await getMachine(machineIdStr);
        if (!alive) return;
        setMachine(m);
      } catch {
        if (!alive) return;
        setMachine(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [machineIdStr]);

  useEffect(() => {
    setErr(null);
  }, [name, description, trainingLink]);

  if (!machineIdStr) {
    return (
      <Alert severity="error" sx={{ borderRadius: `${RADIUS}px` }}>
        Missing machineId in URL. Route should be{' '}
        <b>/machines/:machineId/tasks/new</b>
      </Alert>
    );
  }

  async function onSave() {
    const n = name.trim();
    if (!n) {
      setErr('Task name is required.');
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const created = await createTask(machineIdStr, {
        name: n,
        description: description.trim() || null,
        trainingLink: trainingLink.trim() || null,
      });

      nav(`/tasks/${String(created.id)}/steps/new`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        bgcolor: alpha('#0b1220', 0.03),
        backgroundImage: `
          radial-gradient(900px 420px at 12% 6%, ${alpha(brand.mint, 0.14)} 0%, transparent 60%),
          radial-gradient(780px 360px at 92% 10%, ${alpha(brand.lemon, 0.14)} 0%, transparent 62%),
          radial-gradient(860px 420px at 86% 88%, ${alpha(brand.caramel, 0.14)} 0%, transparent 62%)
        `,
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 3.5 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 3, md: 4 },
          width: '100%',
        }}
      >
        {/* Page frame: keep left-aligned header region (like other pages) */}
        <Box sx={{ width: '100%', maxWidth: 'none', mr: 'auto', ml: 0 }}>
          {/* Header */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            gap={1.25}
            sx={{ mb: 2 }}
          >
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => nav(-1)}
                disabled={saving}
                sx={{
                  borderRadius: `${RADIUS}px`,
                  fontWeight: 900,
                  height: 40,
                  px: 1.25,
                  border: `1px solid ${alpha('#000', 0.1)}`,
                  bgcolor: alpha('#fff', 0.52),
                  backdropFilter: 'blur(10px)',
                  '&:hover': { bgcolor: alpha('#fff', 0.66) },
                  whiteSpace: 'nowrap',
                }}
              >
                Back
              </Button>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 950,
                    fontSize: { xs: 26, md: 34 },
                    lineHeight: 1.05,
                    letterSpacing: -0.4,
                  }}
                  noWrap
                >
                  Create task
                </Typography>

                <Typography
                  sx={{ mt: 0.35, color: 'text.secondary', fontWeight: 650 }}
                >
                  {machine?.name
                    ? `Machine: ${machine.name}`
                    : 'Add a task to this machine. You’ll add steps next.'}
                </Typography>
              </Box>
            </Stack>

            <Button
              variant="contained"
              startIcon={
                saving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              onClick={onSave}
              disabled={saving}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                boxShadow: 'none',
                height: 40,
                whiteSpace: 'nowrap',
              }}
            >
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </Stack>

          {/* ✅ Form container: centered + wide so fields look normal */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 'min(920px, 100%)',
              }}
            >
              {!!err && (
                <Alert
                  severity="error"
                  sx={{ mb: 2, borderRadius: `${RADIUS}px` }}
                >
                  {err}
                </Alert>
              )}

              <Card sx={glassCard}>
                <CardContent sx={{ p: { xs: 2, md: 2.4 } }}>
                  <Typography sx={{ fontWeight: 950, mb: 1 }}>
                    Task details
                  </Typography>
                  <Divider sx={{ mb: 2, borderColor: alpha('#000', 0.08) }} />

                  <Stack spacing={1.4}>
                    <TextField
                      fullWidth
                      label="Task name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Changeover – reset guides"
                      autoFocus
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onSave();
                        }
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: `${RADIUS}px`,
                        },
                        bgcolor: alpha('#fff', 0.55),
                        backdropFilter: 'blur(10px)',
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Description (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      multiline
                      minRows={4}
                      placeholder="Short description / scope of the task"
                      disabled={saving}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: `${RADIUS}px`,
                        },
                        bgcolor: alpha('#fff', 0.55),
                        backdropFilter: 'blur(10px)',
                      }}
                    />

                    <TextField
                      fullWidth
                      label="Training link (optional)"
                      value={trainingLink}
                      onChange={(e) => setTrainingLink(e.target.value)}
                      placeholder="https://…"
                      disabled={saving}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: `${RADIUS}px`,
                        },
                        bgcolor: alpha('#fff', 0.55),
                        backdropFilter: 'blur(10px)',
                      }}
                    />

                    <Alert
                      severity="info"
                      sx={{
                        borderRadius: `${RADIUS}px`,
                        border: `1px solid ${alpha('#000', 0.1)}`,
                        bgcolor: alpha('#fff', 0.7),
                        backdropFilter: 'blur(10px)',
                        fontWeight: 700,
                      }}
                    >
                      After creating the task, you’ll be taken to{' '}
                      <b>Add steps</b>.
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
