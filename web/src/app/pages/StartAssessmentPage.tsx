// src/app/pages/StartAssessmentPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HomeIcon from '@mui/icons-material/Home';
import CloseIcon from '@mui/icons-material/Close';

import {
  getLinesDashboard,
  getMachinesDashboard,
  getTasksDashboard,
  type LineDashboardItem,
  type MachineDashboardItem,
  type TaskDashboardItem,
} from '../api/dashboard';
import { brand } from '../theme';

const RADIUS = 10;

function scoreCounts(c: {
  veryHigh: number;
  high: number;
  mediumPlus: number;
  medium: number;
  low?: number;
}) {
  return (
    c.veryHigh * 8 + c.high * 5 + c.mediumPlus * 3 + c.medium * 2 + (c.low ?? 0)
  );
}

type RiskCounts = {
  total: number;
  unassessed: number;
  veryHigh: number;
  high: number;
  mediumPlus: number;
  medium: number;
  low: number;
  veryLow: number;
};

type BandKey =
  | 'VERY_HIGH'
  | 'HIGH'
  | 'MEDIUM_PLUS'
  | 'MEDIUM'
  | 'LOW'
  | 'VERY_LOW';

function highestBandFromCounts(c?: RiskCounts | null): BandKey | null {
  if (!c) return null;
  if (c.veryHigh > 0) return 'VERY_HIGH';
  if (c.high > 0) return 'HIGH';
  if (c.mediumPlus > 0) return 'MEDIUM_PLUS';
  if (c.medium > 0) return 'MEDIUM';
  if (c.low > 0) return 'LOW';
  if (c.veryLow > 0) return 'VERY_LOW';
  return null;
}

function bandLabel(b: BandKey) {
  switch (b) {
    case 'VERY_HIGH':
      return 'Very High';
    case 'HIGH':
      return 'High';
    case 'MEDIUM_PLUS':
      return 'Medium+';
    case 'MEDIUM':
      return 'Medium';
    case 'LOW':
      return 'Low';
    case 'VERY_LOW':
      return 'Very Low';
  }
}

function bandChipColor(b: BandKey): 'error' | 'warning' | 'info' | 'success' {
  switch (b) {
    case 'VERY_HIGH':
      return 'error';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM_PLUS':
      return 'info';
    case 'MEDIUM':
      return 'info';
    case 'LOW':
      return 'success';
    case 'VERY_LOW':
      return 'success';
  }
}

function ListSkeleton() {
  return (
    <Stack spacing={1}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Box
          key={i}
          sx={{
            borderRadius: `${RADIUS}px`,
            border: `1px solid ${alpha('#000', 0.08)}`,
            bgcolor: alpha('#fff', 0.55),
            backdropFilter: 'blur(10px)',
            p: 1.2,
          }}
        >
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="text" width="80%" />
        </Box>
      ))}
    </Stack>
  );
}

type PickItem = {
  id: string;
  title: string;
  counts: RiskCounts;
};

function PickerColumn(props: {
  title: string;
  placeholder: string;
  q: string;
  setQ: (v: string) => void;
  loading: boolean;
  disabled?: boolean;
  items: PickItem[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const {
    title,
    placeholder,
    q,
    setQ,
    loading,
    disabled,
    items,
    selectedId,
    onPick,
  } = props;

  const glassCard = {
    borderRadius: `${RADIUS}px`,
    border: `1px solid ${alpha('#000', 0.08)}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    bgcolor: alpha('#fff', 0.74),
    backdropFilter: 'blur(10px)',
  } as const;

  const inputSx = {
    '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS}px` },
    bgcolor: alpha('#fff', 0.55),
    backdropFilter: 'blur(10px)',
  } as const;

  return (
    <Card sx={glassCard}>
      <CardContent sx={{ p: { xs: 1.8, md: 2.2 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography sx={{ fontWeight: 950 }}>{title}</Typography>

          <Box
            sx={{
              px: 1.0,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: `${RADIUS}px`,
              bgcolor: alpha('#fff', 0.55),
              border: `1px solid ${alpha('#000', 0.1)}`,
              backdropFilter: 'blur(10px)',
              fontWeight: 950,
              fontSize: 12,
            }}
          >
            {loading ? '…' : items.length}
          </Box>
        </Stack>

        <Divider sx={{ my: 1.2, borderColor: alpha('#000', 0.08) }} />

        <TextField
          size="small"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          fullWidth
          sx={inputSx}
        />

        <Box sx={{ mt: 1.2 }}>
          {loading ? (
            <ListSkeleton />
          ) : (
            <Stack spacing={1}>
              {items.map((it) => {
                const selected = selectedId === it.id;
                const c = it.counts;
                const assessed = Math.max(0, c.total - c.unassessed);
                const pct =
                  c.total > 0 ? Math.round((assessed / c.total) * 100) : 0;

                return (
                  <Card
                    key={it.id}
                    variant="outlined"
                    sx={{
                      borderRadius: `${RADIUS}px`,
                      borderColor: selected
                        ? alpha(brand.caramel, 0.55)
                        : alpha('#000', 0.1),
                      boxShadow: 'none',
                      bgcolor: alpha('#fff', 0.55),
                      backdropFilter: 'blur(10px)',
                      overflow: 'hidden',
                      transition:
                        'border-color 120ms ease, box-shadow 120ms ease',
                      '&:hover': {
                        borderColor: alpha('#000', 0.16),
                        boxShadow: '0 10px 20px rgba(0,0,0,0.05)',
                      },
                    }}
                  >
                    <CardActionArea
                      onClick={() => onPick(it.id)}
                      disabled={disabled}
                    >
                      <Box sx={{ p: 1.2 }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          gap={1.2}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{ fontWeight: 950 }}
                              noWrap
                              title={it.title}
                            >
                              {it.title}
                            </Typography>
                            <Typography
                              sx={{
                                mt: 0.3,
                                color: 'text.secondary',
                                fontWeight: 750,
                                fontSize: 12.5,
                              }}
                            >
                              {c.unassessed > 0
                                ? `${c.unassessed} unassessed`
                                : 'All assessed'}{' '}
                              • {c.total} steps • {pct}%
                            </Typography>
                          </Box>

                          <Stack direction="row" gap={0.8} alignItems="center">
                            <Box
                              sx={{
                                px: 1.0,
                                height: 26,
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: `${RADIUS}px`,
                                bgcolor: alpha('#000', 0.05),
                                border: `1px solid ${alpha('#000', 0.08)}`,
                                fontWeight: 950,
                                fontSize: 12,
                              }}
                              title="Priority"
                            >
                              {scoreCounts(c)}
                            </Box>

                            {selected && (
                              <Box
                                sx={{
                                  px: 1.0,
                                  height: 26,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  borderRadius: `${RADIUS}px`,
                                  bgcolor: alpha(brand.mint, 0.14),
                                  border: `1px solid ${alpha(brand.mint, 0.22)}`,
                                  fontWeight: 950,
                                  fontSize: 12,
                                }}
                              >
                                Selected
                              </Box>
                            )}
                          </Stack>
                        </Stack>

                        {/* subtle micro progress */}
                        {c.total > 0 && (
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              mt: 1.0,
                              height: 7,
                              borderRadius: 999,
                              bgcolor: alpha('#000', 0.06),
                              '& .MuiLinearProgress-bar': { borderRadius: 999 },
                            }}
                          />
                        )}
                      </Box>
                    </CardActionArea>
                  </Card>
                );
              })}

              {items.length === 0 && (
                <Typography
                  sx={{ mt: 1, color: 'text.secondary', fontWeight: 750 }}
                >
                  Nothing found.
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function StartAssessmentPage() {
  const nav = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [err, setErr] = useState<string | null>(null);

  const [lines, setLines] = useState<LineDashboardItem[] | null>(null);
  const [machines, setMachines] = useState<MachineDashboardItem[] | null>(null);
  const [tasks, setTasks] = useState<TaskDashboardItem[] | null>(null);

  const [lineId, setLineId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const [qLine, setQLine] = useState('');
  const [qMachine, setQMachine] = useState('');
  const [qTask, setQTask] = useState('');

  // load lines once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        setLines(null);
        const data = await getLinesDashboard();
        if (!alive) return;
        setLines(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load lines');
        setLines([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // load machines when line selected
  useEffect(() => {
    if (!lineId) {
      setMachines(null);
      setMachineId(null);
      setTasks(null);
      setTaskId(null);
      setQMachine('');
      setQTask('');
      return;
    }

    let alive = true;
    (async () => {
      try {
        setErr(null);
        setMachines(null);
        setMachineId(null);
        setTasks(null);
        setTaskId(null);
        setQMachine('');
        setQTask('');
        const data = await getMachinesDashboard(lineId);
        if (!alive) return;
        setMachines(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load machines');
        setMachines([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lineId]);

  // load tasks when machine selected
  useEffect(() => {
    if (!machineId) {
      setTasks(null);
      setTaskId(null);
      setQTask('');
      return;
    }

    let alive = true;
    (async () => {
      try {
        setErr(null);
        setTasks(null);
        setTaskId(null);
        setQTask('');
        const data = await getTasksDashboard(machineId);
        if (!alive) return;
        setTasks(data);
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

  const filteredLines = useMemo(() => {
    if (!lines) return [];
    const qq = qLine.trim().toLowerCase();
    const base = qq
      ? lines.filter((x) => x.name.toLowerCase().includes(qq))
      : lines;
    return [...base].sort(
      (a, b) => scoreCounts(b.counts) - scoreCounts(a.counts),
    );
  }, [lines, qLine]);

  const filteredMachines = useMemo(() => {
    if (!machines) return [];
    const qq = qMachine.trim().toLowerCase();
    const base = qq
      ? machines.filter((x) => x.name.toLowerCase().includes(qq))
      : machines;
    return [...base].sort(
      (a, b) => scoreCounts(b.counts) - scoreCounts(a.counts),
    );
  }, [machines, qMachine]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    const qq = qTask.trim().toLowerCase();
    const base = qq
      ? tasks.filter((x) => x.name.toLowerCase().includes(qq))
      : tasks;
    return [...base].sort(
      (a, b) => scoreCounts(b.counts) - scoreCounts(a.counts),
    );
  }, [tasks, qTask]);

  const selectedLine = useMemo(
    () => (lines ?? []).find((x) => String(x.id) === String(lineId)) ?? null,
    [lines, lineId],
  );
  const selectedMachine = useMemo(
    () =>
      (machines ?? []).find((x) => String(x.id) === String(machineId)) ?? null,
    [machines, machineId],
  );
  const selectedTask = useMemo(
    () => (tasks ?? []).find((x) => String(x.id) === String(taskId)) ?? null,
    [tasks, taskId],
  );

  const selectedCounts = selectedTask?.counts ?? null;

  const started =
    !!selectedCounts &&
    selectedCounts.total > 0 &&
    selectedCounts.unassessed < selectedCounts.total;

  const assessed = selectedCounts
    ? selectedCounts.total - selectedCounts.unassessed
    : 0;
  const pct =
    selectedCounts && selectedCounts.total > 0
      ? Math.round((assessed / selectedCounts.total) * 100)
      : 0;

  const highest = started ? highestBandFromCounts(selectedCounts) : null;

  const canStart =
    !!taskId && !!selectedTask && (selectedTask.counts?.total ?? 0) > 0;

  function clearLine() {
    setLineId(null);
    setMachineId(null);
    setTaskId(null);
    setMachines(null);
    setTasks(null);
  }
  function clearMachine() {
    setMachineId(null);
    setTaskId(null);
    setTasks(null);
  }
  function clearTask() {
    setTaskId(null);
  }

  const glassBar = {
    borderRadius: `${RADIUS}px`,
    border: `1px solid ${alpha('#000', 0.08)}`,
    bgcolor: alpha('#fff', 0.72),
    backdropFilter: 'blur(10px)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  } as const;

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
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1.6 }}
        >
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Tooltip title="Back" arrow>
              <span>
                <IconButton
                  onClick={() => nav(-1)}
                  sx={{
                    borderRadius: `${RADIUS}px`,
                    border: `1px solid ${alpha('#000', 0.1)}`,
                    bgcolor: alpha('#fff', 0.52),
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Typography
              sx={{ fontWeight: 950, fontSize: { xs: 20, md: 24 } }}
              noWrap
            >
              Start assessment
            </Typography>

            {started && selectedCounts && (
              <Box
                sx={{
                  ml: 0.5,
                  px: 1.0,
                  height: 26,
                  display: { xs: 'none', sm: 'inline-flex' },
                  alignItems: 'center',
                  borderRadius: `${RADIUS}px`,
                  bgcolor: alpha('#fff', 0.55),
                  border: `1px solid ${alpha('#000', 0.1)}`,
                  backdropFilter: 'blur(10px)',
                  fontWeight: 950,
                  fontSize: 12,
                }}
              >
                {pct}% • {assessed}/{selectedCounts.total}
              </Box>
            )}
          </Stack>

          <Stack direction="row" gap={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => nav('/')}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                borderColor: alpha('#000', 0.18),
              }}
            >
              Dashboard
            </Button>

            <Button
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              disabled={!machineId}
              onClick={() => {
                if (!machineId) return;
                // ✅ correct route based on your CreateTaskPage
                nav(`/machines/${machineId}/tasks/new`);
              }}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                borderColor: alpha('#000', 0.18),
              }}
            >
              Create task
            </Button>

            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              disabled={!canStart}
              onClick={() => nav(`/tasks/${taskId}/assess`)}
              sx={{
                fontWeight: 950,
                borderRadius: `${RADIUS}px`,
                boxShadow: 'none',
                height: 40,
              }}
            >
              {started ? 'Continue' : 'Start'}
            </Button>
          </Stack>
        </Stack>

        {!!err && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS}px` }}>
            {err}
          </Alert>
        )}

        {/* Selection bar (breadcrumbs) */}
        <Box sx={{ ...glassBar, p: 1.2, mb: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            gap={1}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
              <Chip
                label={selectedLine ? selectedLine.name : 'Line'}
                onDelete={selectedLine ? clearLine : undefined}
                deleteIcon={<CloseIcon />}
                sx={{ fontWeight: 950, borderRadius: `${RADIUS}px` }}
                variant={selectedLine ? 'filled' : 'outlined'}
              />

              <Chip
                label={selectedMachine ? selectedMachine.name : 'Machine'}
                onDelete={selectedMachine ? clearMachine : undefined}
                deleteIcon={<CloseIcon />}
                sx={{ fontWeight: 950, borderRadius: `${RADIUS}px` }}
                variant={selectedMachine ? 'filled' : 'outlined'}
                disabled={!selectedLine}
              />

              <Chip
                label={selectedTask ? selectedTask.name : 'Task'}
                onDelete={selectedTask ? clearTask : undefined}
                deleteIcon={<CloseIcon />}
                sx={{ fontWeight: 950, borderRadius: `${RADIUS}px` }}
                variant={selectedTask ? 'filled' : 'outlined'}
                disabled={!selectedMachine}
              />
            </Stack>

            {started && selectedCounts && (
              <Stack
                direction="row"
                gap={1}
                alignItems="center"
                sx={{ flexWrap: 'wrap' }}
              >
                {highest && (
                  <Chip
                    size="small"
                    label={`Highest: ${bandLabel(highest)}`}
                    color={bandChipColor(highest)}
                    sx={{ fontWeight: 950, borderRadius: `${RADIUS}px` }}
                  />
                )}
                <Box sx={{ minWidth: 220, width: isMobile ? '100%' : 260 }}>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 9,
                      borderRadius: 999,
                      bgcolor: alpha('#000', 0.06),
                      '& .MuiLinearProgress-bar': { borderRadius: 999 },
                    }}
                  />
                </Box>
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Main picker: 3 columns */}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            alignItems: 'start',
          }}
        >
          <PickerColumn
            title="Line"
            placeholder="Search…"
            q={qLine}
            setQ={setQLine}
            loading={!lines}
            items={filteredLines.map((x) => ({
              id: String(x.id),
              title: x.name,
              counts: x.counts as any,
            }))}
            selectedId={lineId}
            onPick={(id) => {
              setLineId(id);
              setMachineId(null);
              setTaskId(null);
            }}
          />

          <PickerColumn
            title="Machine"
            placeholder="Search…"
            q={qMachine}
            setQ={setQMachine}
            loading={!!lineId && !machines}
            disabled={!lineId}
            items={filteredMachines.map((x) => ({
              id: String(x.id),
              title: x.name,
              counts: x.counts as any,
            }))}
            selectedId={machineId}
            onPick={(id) => {
              setMachineId(id);
              setTaskId(null);
            }}
          />

          <PickerColumn
            title="Task"
            placeholder="Search…"
            q={qTask}
            setQ={setQTask}
            loading={!!machineId && !tasks}
            disabled={!machineId}
            items={filteredTasks.map((x) => ({
              id: String(x.id),
              title: x.name,
              counts: x.counts as any,
            }))}
            selectedId={taskId}
            onPick={(id) => setTaskId(id)}
          />
        </Box>
      </Box>
    </Box>
  );
}
