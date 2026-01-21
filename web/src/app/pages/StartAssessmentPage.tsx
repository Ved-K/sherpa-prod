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
  LinearProgress,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
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

type PickCardItem = {
  id: string;
  title: string;
  subtitle: string;
};

function ListSkeleton() {
  return (
    <Stack spacing={1}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={i}
          variant="outlined"
          sx={{ borderRadius: 2.5, borderColor: 'divider', boxShadow: 'none' }}
        >
          <CardContent>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="85%" />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function PickList(props: {
  title: string;
  searchPlaceholder: string;
  q: string;
  setQ: (v: string) => void;
  loading: boolean;
  disabled?: boolean;
  items: PickCardItem[];
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const {
    title,
    searchPlaceholder,
    q,
    setQ,
    loading,
    disabled,
    items,
    selectedId,
    onPick,
  } = props;

  return (
    <Stack spacing={1.2}>
      <Stack spacing={0.4}>
        <Typography sx={{ fontWeight: 950, fontSize: 18 }}>{title}</Typography>
        <Typography sx={{ color: 'text.secondary', fontWeight: 650 }}>
          Choose one to continue.
        </Typography>
      </Stack>

      <TextField
        size="small"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={searchPlaceholder}
        disabled={disabled}
        sx={{ width: '100%' }}
      />

      {loading ? (
        <ListSkeleton />
      ) : (
        <Stack spacing={1}>
          {items.map((it) => {
            const selected = selectedId === it.id;

            return (
              <Card
                key={it.id}
                variant="outlined"
                sx={{
                  borderRadius: 2.5,
                  borderColor: selected ? 'rgba(227,0,27,0.45)' : 'divider',
                  boxShadow: 'none',
                }}
              >
                <CardActionArea
                  onClick={() => onPick(it.id)}
                  disabled={disabled}
                >
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={2}
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
                          variant="body2"
                          sx={{ color: 'text.secondary', fontWeight: 650 }}
                        >
                          {it.subtitle}
                        </Typography>
                      </Box>

                      {selected && (
                        <Chip
                          size="small"
                          label="Selected"
                          sx={{ fontWeight: 900, borderRadius: 2 }}
                        />
                      )}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}

          {items.length === 0 && (
            <Typography sx={{ color: 'text.secondary', fontWeight: 650 }}>
              Nothing found.
            </Typography>
          )}
        </Stack>
      )}
    </Stack>
  );
}

export default function StartAssessmentPage() {
  const nav = useNavigate();

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

  const [tab, setTab] = useState(0); // 0=Line, 1=Machine, 2=Task

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

  useEffect(() => {
    if (!lineId) {
      setMachines(null);
      setMachineId(null);
      setTasks(null);
      setTaskId(null);
      setTab(0);
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

        const data = await getMachinesDashboard(lineId);
        if (!alive) return;
        setMachines(data);
        setTab(1);
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

  useEffect(() => {
    if (!machineId) {
      setTasks(null);
      setTaskId(null);
      if (lineId) setTab(1);
      return;
    }

    let alive = true;
    (async () => {
      try {
        setErr(null);
        setTasks(null);
        setTaskId(null);

        const data = await getTasksDashboard(machineId);
        if (!alive) return;
        setTasks(data);
        setTab(2);
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
    setTab(0);
  }

  function clearMachine() {
    setMachineId(null);
    setTaskId(null);
    setTasks(null);
    setTab(1);
  }

  function clearTask() {
    setTaskId(null);
    setTab(2);
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack spacing={0.6} sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 950, fontSize: { xs: 26, md: 34 } }}>
          Start assessment
        </Typography>
      </Stack>

      {!!err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Card
        variant="outlined"
        sx={{ borderRadius: 3, borderColor: 'divider', boxShadow: 'none' }}
      >
        <CardContent>
          {/* Chips + Actions */}
          <Stack spacing={1.25} sx={{ mb: 1.5 }}>
            <Stack
              direction="row"
              gap={1}
              flexWrap="wrap"
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack
                direction="row"
                gap={1}
                flexWrap="wrap"
                alignItems="center"
              >
                <Chip
                  label={
                    selectedLine ? `Line: ${selectedLine.name}` : 'Line: —'
                  }
                  onDelete={selectedLine ? clearLine : undefined}
                  deleteIcon={<CloseIcon />}
                  sx={{ fontWeight: 900, borderRadius: 2 }}
                  variant={selectedLine ? 'filled' : 'outlined'}
                />

                <Chip
                  label={
                    selectedMachine
                      ? `Machine: ${selectedMachine.name}`
                      : 'Machine: —'
                  }
                  onDelete={selectedMachine ? clearMachine : undefined}
                  deleteIcon={<CloseIcon />}
                  sx={{ fontWeight: 900, borderRadius: 2 }}
                  variant={selectedMachine ? 'filled' : 'outlined'}
                  disabled={!selectedLine}
                />

                <Chip
                  label={
                    selectedTask ? `Task: ${selectedTask.name}` : 'Task: —'
                  }
                  onDelete={selectedTask ? clearTask : undefined}
                  deleteIcon={<CloseIcon />}
                  sx={{ fontWeight: 900, borderRadius: 2 }}
                  variant={selectedTask ? 'filled' : 'outlined'}
                  disabled={!selectedMachine}
                />
              </Stack>

              <Stack direction="row" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={() => nav('/')}
                  sx={{ borderRadius: 2 }}
                >
                  Dashboard
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => nav('/tasks/new')}
                  sx={{ borderRadius: 2 }}
                >
                  Create task
                </Button>

                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  disabled={!canStart}
                  onClick={() => nav(`/tasks/${taskId}/assess`)}
                  sx={{ fontWeight: 900, borderRadius: 2 }}
                >
                  Start
                </Button>
              </Stack>
            </Stack>

            {/* Progress + Highest residual */}
            {started && selectedCounts && (
              <Box sx={{ mb: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 0.8 }}
                >
                  <Typography sx={{ fontWeight: 900 }}>Progress</Typography>

                  <Stack direction="row" gap={1} alignItems="center">
                    {highest && (
                      <Chip
                        size="small"
                        label={`Highest risk: ${bandLabel(highest)}`}
                        color={bandChipColor(highest)}
                        sx={{ fontWeight: 900, borderRadius: 2 }}
                      />
                    )}
                    <Typography
                      sx={{ color: 'text.secondary', fontWeight: 750 }}
                    >
                      {assessed}/{selectedCounts.total} assessed ({pct}%)
                    </Typography>
                  </Stack>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ height: 10, borderRadius: 999 }}
                />
              </Box>
            )}
          </Stack>

          <Divider sx={{ mb: 1.5 }} />

          {/* Tabs */}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="1. Line" />
            <Tab label="2. Machine" disabled={!lineId} />
            <Tab label="3. Task" disabled={!machineId} />
          </Tabs>

          {tab === 0 && (
            <PickList
              title="Choose a line"
              searchPlaceholder="Search lines…"
              q={qLine}
              setQ={setQLine}
              loading={!lines}
              items={filteredLines.map((x) => ({
                id: String(x.id),
                title: x.name,
                subtitle: `Priority ${scoreCounts(x.counts)} • Steps ${x.counts.total} • Unassessed ${x.counts.unassessed}`,
              }))}
              selectedId={lineId}
              onPick={(id) => {
                setLineId(id);
                setMachineId(null);
                setTaskId(null);
              }}
            />
          )}

          {tab === 1 && (
            <PickList
              title="Choose a machine"
              searchPlaceholder="Search machines…"
              q={qMachine}
              setQ={setQMachine}
              loading={!!lineId && !machines}
              disabled={!lineId}
              items={filteredMachines.map((x) => ({
                id: String(x.id),
                title: x.name,
                subtitle: `Priority ${scoreCounts(x.counts)} • Steps ${x.counts.total} • Unassessed ${x.counts.unassessed}`,
              }))}
              selectedId={machineId}
              onPick={(id) => {
                setMachineId(id);
                setTaskId(null);
              }}
            />
          )}

          {tab === 2 && (
            <PickList
              title="Choose a task"
              searchPlaceholder="Search tasks…"
              q={qTask}
              setQ={setQTask}
              loading={!!machineId && !tasks}
              disabled={!machineId}
              items={filteredTasks.map((x) => ({
                id: String(x.id),
                title: x.name,
                subtitle: `Priority ${scoreCounts(x.counts)} • Steps ${x.counts.total} • Unassessed ${x.counts.unassessed}`,
              }))}
              selectedId={taskId}
              onPick={(id) => setTaskId(id)}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
