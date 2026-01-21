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
  Divider,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { brand } from '../theme';
import { getTasksDashboard, type TaskDashboardItem } from '../api/dashboard';

const RADIUS = 10;

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

  // Optional: fetch machine name for a more “real” header
  const [machineName, setMachineName] = useState<string | null>(null);
  useEffect(() => {
    if (!machineId) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/machines/${machineId}`);
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (alive) setMachineName(j?.name ?? null);
      } catch {
        if (alive) setMachineName(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [machineId]);

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

  const pageBg = alpha('#0b1220', 0.03);

  const cardSx = {
    borderRadius: `${RADIUS}px`,
    border: `1px solid ${alpha('#000', 0.08)}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    bgcolor: 'background.paper',
    overflow: 'hidden',
  } as const;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: pageBg,
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
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
            gap={1.2}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => nav(-1)}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 900,
                borderColor: alpha('#000', 0.18),
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
                {machineName ? `${machineName}` : 'Machine'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontWeight: 650 }}
              >
                Tasks
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <TextField
              size="small"
              placeholder="Search tasks"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{
                width: { xs: '100%', sm: 320 },
                '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS}px` },
              }}
            />
            <Button
              variant="contained"
              onClick={() => nav(`/machines/${String(machineId)}/tasks/new`)}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                boxShadow: 'none',
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

        {/* Summary bar (subtle, not “hinty”) */}
        {tasks && summary && (
          <Card
            sx={{
              ...cardSx,
              mb: 2,
              bgcolor: alpha('#fff', 0.7),
              backdropFilter: 'blur(6px)',
            }}
          >
            <CardContent sx={{ py: 1.4 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                gap={1.2}
              >
                <Typography sx={{ fontWeight: 900, color: 'text.primary' }}>
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

        {/* Loading grid */}
        {!tasks ? (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} sx={cardSx}>
                <CardContent sx={{ p: 2 }}>
                  <Skeleton width="70%" />
                  <Skeleton width="55%" />
                  <Divider sx={{ my: 1.2 }} />
                  <Skeleton width="85%" />
                  <Skeleton width="75%" />
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : sorted.length === 0 ? (
          <Card sx={cardSx}>
            <CardContent sx={{ p: 2.2 }}>
              <Typography sx={{ fontWeight: 950 }}>No tasks</Typography>
              <Typography
                sx={{ color: 'text.secondary', fontWeight: 650, mt: 0.6 }}
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
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              alignItems: 'start',
            }}
          >
            {sorted.map((t) => {
              const c = t.counts;
              const score = scoreTask(c);
              const band = bandMeta(c);

              return (
                <Card
                  key={t.id}
                  sx={{
                    ...cardSx,
                    position: 'relative',
                    transition:
                      'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 22px rgba(0,0,0,0.07)',
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
                      opacity: 0.9,
                    }}
                  />

                  <CardActionArea
                    onClick={() => nav(`/tasks/${t.id}/assess`)}
                    sx={{
                      '& .MuiCardActionArea-focusHighlight': { opacity: 0 },
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
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
                              border: `1px solid ${alpha(band.accent, band.label === 'VERY HIGH' ? 0.35 : 0.35)}`,
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
                              backdropFilter: 'blur(6px)',
                            }}
                            aria-label="Open"
                          >
                            <ArrowForwardIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>

                      <Divider
                        sx={{ my: 1.4, borderColor: alpha('#000', 0.08) }}
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
                        sx={{ my: 1.4, borderColor: alpha('#000', 0.08) }}
                      />

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
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
  );
}
