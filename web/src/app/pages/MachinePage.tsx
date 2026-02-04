// src/app/pages/MachinePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import { brand } from '../theme';
import { getTasksDashboard, type TaskDashboardItem } from '../api/dashboard';
import { apiJson } from '../api/http';
import { deleteMachine, updateMachine } from '../api/machines';

const RADIUS = 10;

type MachineEditState = { name: string } | null;
type MachineDeleteState = { id: string; name: string } | null;

function scoreTask(c: TaskDashboardItem['counts']) {
  return c.veryHigh * 8 + c.high * 5 + c.mediumPlus * 3 + c.medium * 2;
}

function bandMeta(c: TaskDashboardItem['counts']) {
  if (c.veryHigh > 0)
    return { label: 'VERY HIGH', accent: brand.heartRed, fg: '#fff' };
  if (c.high > 0) return { label: 'HIGH', accent: brand.caramel, fg: '#111' };
  if (c.mediumPlus > 0 || c.medium > 0)
    return { label: 'MEDIUM', accent: brand.lemon, fg: '#111' };
  if (c.total > 0 && c.unassessed >= c.total)
    return { label: 'UNASSESSED', accent: alpha('#000', 0.22), fg: '#111' };
  return { label: 'LOW', accent: brand.mint, fg: '#111' };
}

function RiskChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  if (!value) return null;
  return (
    <Chip
      size="small"
      label={`${label}: ${value}`}
      variant="outlined"
      sx={{
        height: 26,
        borderRadius: `${RADIUS}px`,
        bgcolor: alpha(accent, 0.14),
        borderColor: alpha(accent, 0.3),
        color: brand.corporateBlack,
        fontWeight: 850,
        '& .MuiChip-label': { px: 1.0 },
      }}
    />
  );
}

export default function MachinePage() {
  const { machineId } = useParams<{ machineId: string }>();
  const nav = useNavigate();

  const [tasks, setTasks] = useState<TaskDashboardItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const [machineName, setMachineName] = useState<string>('Machine');
  const [busy, setBusy] = useState(false);

  // machine edit/delete
  const [editMachine, setEditMachine] = useState<MachineEditState>(null);
  const [editMachineErr, setEditMachineErr] = useState<string | null>(null);
  const [confirmDeleteMachine, setConfirmDeleteMachine] =
    useState<MachineDeleteState>(null);

  const [toast, setToast] = useState<{
    open: boolean;
    msg: string;
    sev: 'success' | 'error';
  }>({ open: false, msg: '', sev: 'success' });

  // ✅ same “glassy” card as dashboard/line
  const glassCard = {
    borderRadius: `${RADIUS}px`,
    border: `1px solid ${alpha('#000', 0.08)}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    bgcolor: alpha('#fff', 0.74),
    backdropFilter: 'blur(10px)',
  } as const;

  // ✅ dynamic grid (no clipping when width shrinks)
  const tilesGridSx = {
    display: 'grid',
    gap: 2,
    width: '100%',
    gridTemplateColumns: {
      xs: '1fr',
      sm: 'repeat(auto-fit, minmax(300px, 1fr))',
    },
    gridAutoRows: '1fr', // ✅ equal heights
    alignItems: 'stretch',
  } as const;

  // Fetch machine name (use API; fall back silently)
  useEffect(() => {
    if (!machineId) return;
    let alive = true;

    (async () => {
      try {
        // assumes your apiJson prefixes /api
        const j = await apiJson<any>(`/machines/${machineId}`);
        const name = String(j?.name ?? '').trim();
        if (alive && name) setMachineName(name);
      } catch {
        // keep default
      }
    })();

    return () => {
      alive = false;
    };
  }, [machineId]);

  // Fetch tasks
  useEffect(() => {
    if (!machineId) return;

    let alive = true;
    (async () => {
      setErr(null);
      setTasks(null);
      try {
        const data = await getTasksDashboard(machineId);
        if (!alive) return;
        setTasks(data ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load tasks');
        setTasks([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [machineId]);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const s = q.trim().toLowerCase();
    if (!s) return tasks;
    return tasks.filter((t) => t.name.toLowerCase().includes(s));
  }, [tasks, q]);

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => scoreTask(b.counts) - scoreTask(a.counts),
    );
  }, [filtered]);

  const summary = useMemo(() => {
    if (!tasks) return null;
    return tasks.reduce(
      (acc, t) => {
        acc.tasks += 1;
        acc.total += t.counts.total;
        acc.unassessed += t.counts.unassessed;
        acc.veryHigh += t.counts.veryHigh;
        acc.high += t.counts.high;
        acc.mediumPlus += t.counts.mediumPlus;
        acc.medium += t.counts.medium;
        return acc;
      },
      {
        tasks: 0,
        total: 0,
        unassessed: 0,
        veryHigh: 0,
        high: 0,
        mediumPlus: 0,
        medium: 0,
      },
    );
  }, [tasks]);

  if (!machineId) return null;

  return (
    // ✅ “glassy second layer” background like dashboard/line
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
        {/* ✅ full width / left aligned (no centering) */}
        <Box sx={{ width: '100%', maxWidth: 'none', mr: 'auto', ml: 0 }}>
          {/* Header */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            gap={1.5}
            sx={{ mb: 2 }}
          >
            <Stack
              direction="row"
              gap={1.1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => nav(-1)}
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
                  title={machineName}
                >
                  {machineName}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', fontWeight: 650 }}
                >
                  Tasks
                </Typography>
              </Box>

              <IconButton
                size="small"
                title="Rename machine"
                onClick={() => {
                  setEditMachineErr(null);
                  setEditMachine({ name: machineName });
                }}
                sx={{ borderRadius: `${RADIUS}px` }}
              >
                <EditIcon fontSize="small" />
              </IconButton>

              <IconButton
                size="small"
                title="Delete machine"
                disabled={busy}
                onClick={() =>
                  setConfirmDeleteMachine({ id: machineId, name: machineName })
                }
                sx={{ borderRadius: `${RADIUS}px` }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="flex-end"
            >
              <Stack
                direction="row"
                gap={1}
                alignItems="center"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                <TextField
                  size="small"
                  placeholder="Search tasks…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  sx={{
                    width: { xs: '100%', sm: 360 },
                    '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS}px` },
                    bgcolor: alpha('#fff', 0.55),
                    backdropFilter: 'blur(10px)',
                  }}
                />

                <Chip
                  size="small"
                  label={
                    tasks
                      ? q.trim()
                        ? `${filtered.length} match${
                            filtered.length === 1 ? '' : 'es'
                          }`
                        : `${tasks.length} total`
                      : '…'
                  }
                  sx={{
                    height: 32,
                    borderRadius: `${RADIUS}px`,
                    fontWeight: 900,
                    bgcolor: alpha('#fff', 0.55),
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha('#000', 0.1)}`,
                    color: alpha('#000', 0.78),
                    '& .MuiChip-label': { px: 1.1 },
                    whiteSpace: 'nowrap',
                  }}
                />
              </Stack>

              <Button
                variant="contained"
                onClick={() => nav(`/machines/${String(machineId)}/tasks/new`)}
                sx={{
                  borderRadius: `${RADIUS}px`,
                  fontWeight: 950,
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                  height: 40,
                }}
              >
                New task
              </Button>
            </Stack>
          </Stack>

          {!!err && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS}px` }}>
              {err}
            </Alert>
          )}

          {/* Summary */}
          {tasks && summary && (
            <Card sx={{ ...glassCard, mb: 2 }}>
              <CardContent sx={{ py: 1.35 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  gap={1.2}
                >
                  <Typography sx={{ fontWeight: 950, color: 'text.primary' }}>
                    {summary.tasks} tasks • {summary.total} steps •{' '}
                    {summary.unassessed} unassessed
                  </Typography>

                  <Stack
                    direction="row"
                    gap={0.8}
                    flexWrap="wrap"
                    justifyContent="flex-end"
                  >
                    <RiskChip
                      label="Very high"
                      value={summary.veryHigh}
                      accent={brand.heartRed}
                    />
                    <RiskChip
                      label="High"
                      value={summary.high}
                      accent={brand.caramel}
                    />
                    <RiskChip
                      label="Medium+"
                      value={summary.mediumPlus}
                      accent={brand.lemon}
                    />
                    <RiskChip
                      label="Medium"
                      value={summary.medium}
                      accent={brand.wafer}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {!tasks ? (
            <Box sx={tilesGridSx}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} sx={glassCard}>
                  <CardContent sx={{ p: 2 }}>
                    <Skeleton width="70%" />
                    <Skeleton width="55%" />
                    <Divider
                      sx={{ my: 1.2, borderColor: alpha('#000', 0.08) }}
                    />
                    <Skeleton width="85%" />
                    <Skeleton width="75%" />
                    <Divider
                      sx={{ my: 1.2, borderColor: alpha('#000', 0.08) }}
                    />
                    <Skeleton width="60%" />
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : sorted.length === 0 ? (
            <Card sx={glassCard}>
              <CardContent sx={{ p: 2.2 }}>
                <Typography sx={{ fontWeight: 950 }}>No tasks</Typography>
                <Typography
                  sx={{ color: 'text.secondary', fontWeight: 700, mt: 0.6 }}
                >
                  {q.trim()
                    ? 'No matches for your search.'
                    : 'Create a task to get started.'}
                </Typography>

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => nav(`/machines/${machineId}/tasks/new`)}
                  sx={{
                    mt: 1.6,
                    borderRadius: `${RADIUS}px`,
                    fontWeight: 950,
                    boxShadow: 'none',
                  }}
                >
                  New task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Box sx={tilesGridSx}>
              {sorted.map((t) => {
                const c = t.counts;
                const score = scoreTask(c);
                const band = bandMeta(c);

                return (
                  <Card
                    key={t.id}
                    sx={{
                      ...glassCard,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      transition:
                        'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.10)',
                        borderColor: alpha(band.accent, 0.45),
                      },
                    }}
                  >
                    {/* Accent strip */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        bgcolor: band.accent,
                        opacity: 0.92,
                      }}
                    />

                    <CardActionArea
                      onClick={() => nav(`/tasks/${t.id}/assess`)}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'stretch',
                        '& .MuiCardActionArea-focusHighlight': { opacity: 0 },
                      }}
                    >
                      <CardContent
                        sx={{
                          p: 2,
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          gap={1.5}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{ fontWeight: 950 }}
                              noWrap
                              title={t.name}
                            >
                              {t.name}
                            </Typography>

                            <Typography
                              sx={{
                                mt: 0.5,
                                color: 'text.secondary',
                                fontWeight: 650,
                                fontSize: 13,
                              }}
                            >
                              Score <b>{score}</b> • Steps <b>{c.total}</b> •
                              Unassessed <b>{c.unassessed}</b>
                            </Typography>
                          </Box>

                          <Stack direction="row" gap={1} alignItems="center">
                            <Chip
                              size="small"
                              label={band.label}
                              sx={{
                                height: 26,
                                borderRadius: `${RADIUS}px`,
                                bgcolor: alpha(
                                  band.accent,
                                  band.label === 'VERY HIGH' ? 0.9 : 0.18,
                                ),
                                border: `1px solid ${alpha(band.accent, 0.35)}`,
                                color: band.fg,
                                fontWeight: 950,
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                nav(`/tasks/${t.id}/assess`);
                              }}
                              sx={{
                                borderRadius: `${RADIUS}px`,
                                border: `1px solid ${alpha('#000', 0.1)}`,
                                bgcolor: alpha('#fff', 0.6),
                                backdropFilter: 'blur(10px)',
                              }}
                              aria-label="Open"
                            >
                              <ArrowForwardIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>

                        <Divider
                          sx={{ my: 1.35, borderColor: alpha('#000', 0.08) }}
                        />

                        <Stack direction="row" gap={0.8} flexWrap="wrap">
                          <RiskChip
                            label="Very high"
                            value={c.veryHigh}
                            accent={brand.heartRed}
                          />
                          <RiskChip
                            label="High"
                            value={c.high}
                            accent={brand.caramel}
                          />
                          <RiskChip
                            label="Medium+"
                            value={c.mediumPlus}
                            accent={brand.lemon}
                          />
                          <RiskChip
                            label="Medium"
                            value={c.medium}
                            accent={brand.wafer}
                          />
                        </Stack>

                        <Divider
                          sx={{ my: 1.35, borderColor: alpha('#000', 0.08) }}
                        />

                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mt: 'auto' }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              nav(`/tasks/${t.id}/steps/new`);
                            }}
                            sx={{
                              borderRadius: `${RADIUS}px`,
                              fontWeight: 900,
                              borderColor: alpha('#000', 0.18),
                              bgcolor: alpha('#fff', 0.5),
                              backdropFilter: 'blur(10px)',
                            }}
                          >
                            Add steps
                          </Button>

                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              nav(`/tasks/${t.id}/assess`);
                            }}
                            sx={{
                              borderRadius: `${RADIUS}px`,
                              fontWeight: 950,
                              borderColor: alpha(band.accent, 0.35),
                              bgcolor: alpha(band.accent, 0.08),
                            }}
                          >
                            Assess
                          </Button>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Rename machine */}
      <Dialog
        open={!!editMachine}
        onClose={() => (!busy ? setEditMachine(null) : undefined)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: `${RADIUS}px`,
            border: `1px solid ${alpha('#000', 0.1)}`,
            boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
            bgcolor: alpha('#fff', 0.84),
            backdropFilter: 'blur(12px)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 950 }}>Rename machine</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            value={editMachine?.name ?? ''}
            onChange={(e) =>
              setEditMachine((v) => (v ? { ...v, name: e.target.value } : v))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // handled by save button
              }
            }}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS}px` },
            }}
            disabled={busy}
          />
          {editMachineErr && (
            <Alert
              severity="error"
              sx={{ mt: 1.2, borderRadius: `${RADIUS}px` }}
            >
              {editMachineErr}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.2 }}>
          <Button
            onClick={() => setEditMachine(null)}
            disabled={busy}
            variant="outlined"
            sx={{
              borderRadius: `${RADIUS}px`,
              fontWeight: 900,
              borderColor: alpha('#000', 0.18),
              bgcolor: alpha('#fff', 0.55),
              backdropFilter: 'blur(10px)',
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            disabled={busy || !(editMachine?.name ?? '').trim()}
            sx={{
              borderRadius: `${RADIUS}px`,
              fontWeight: 950,
              boxShadow: 'none',
            }}
            onClick={async () => {
              const name = (editMachine?.name ?? '').trim();
              if (!name) return;

              setBusy(true);
              setEditMachineErr(null);
              try {
                await updateMachine(String(machineId), { name });
                setMachineName(name);
                setEditMachine(null);
                setToast({
                  open: true,
                  msg: 'Machine renamed',
                  sev: 'success',
                });
              } catch (e: any) {
                setEditMachineErr(e?.message ?? 'Failed to rename machine');
                setToast({
                  open: true,
                  msg: e?.message ?? 'Failed to rename machine',
                  sev: 'error',
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete machine */}
      <Dialog
        open={!!confirmDeleteMachine}
        onClose={() => (!busy ? setConfirmDeleteMachine(null) : undefined)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: `${RADIUS}px`,
            border: `1px solid ${alpha('#000', 0.1)}`,
            boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
            bgcolor: alpha('#fff', 0.84),
            backdropFilter: 'blur(12px)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 950 }}>Delete machine</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontWeight: 750 }}>
            Delete <b>{confirmDeleteMachine?.name}</b>? This can’t be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.2 }}>
          <Button onClick={() => setConfirmDeleteMachine(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={busy}
            onClick={async () => {
              if (!confirmDeleteMachine) return;
              setBusy(true);
              try {
                await deleteMachine(confirmDeleteMachine.id);
                setConfirmDeleteMachine(null);
                setToast({
                  open: true,
                  msg: 'Machine deleted',
                  sev: 'success',
                });
                nav('/');
              } catch (e: any) {
                setToast({
                  open: true,
                  msg: e?.message ?? 'Failed to delete machine',
                  sev: 'error',
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2400}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.sev}
          sx={{
            borderRadius: `${RADIUS}px`,
            border: `1px solid ${alpha('#000', 0.12)}`,
            fontWeight: 800,
            bgcolor: alpha('#fff', 0.86),
            backdropFilter: 'blur(12px)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.10)',
          }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
