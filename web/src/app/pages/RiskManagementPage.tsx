/* eslint-disable react-hooks/exhaustive-deps */
// src/app/pages/RiskManagementPage.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';

import { brand } from '../theme';
import type {
  ActionCategoryMeta,
  DotColor,
  LineRiskItem,
  MachineRiskItem,
  RecommendationsResponse,
  RiskMetaResponse,
  StepRiskItem,
  StepsRiskResponse,
  TaskRiskItem,
  TaskCategoryMeta,
  TaskPhaseMeta,
} from '../api/risk';
import {
  getRiskLines as rmLines,
  getRiskMachines as rmMachines,
  getRiskMeta as rmMeta,
  getRiskRecommendations as rmActions,
  getRiskSteps as rmSteps,
  getRiskTasks as rmTasks,
  setRiskControlImplemented,
} from '../api/risk';

const RADIUS = 14;

function GlassCard({
  title,
  right,
  children,
  subtitle,
  onTitleClick,
  titleClickable,
}: {
  title?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  onTitleClick?: () => void;
  titleClickable?: boolean;
}) {
  return (
    <Card
      sx={{
        borderRadius: `${RADIUS}px`,
        border: `1px solid ${alpha('#000', 0.08)}`,
        bgcolor: alpha('#fff', 0.74),
        backdropFilter: 'blur(14px)',
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: 2.2 }}>
        {(title || right) && (
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            sx={{ mb: 1.25 }}
          >
            <Box
              onClick={titleClickable ? onTitleClick : undefined}
              sx={{
                cursor: titleClickable ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              {title && (
                <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
              )}
              {subtitle && (
                <Typography
                  sx={{
                    mt: 0.2,
                    fontSize: 12,
                    fontWeight: 750,
                    color: 'text.secondary',
                  }}
                >
                  {subtitle}
                </Typography>
              )}
            </Box>
            {right}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function safeDate(d?: string | Date | null) {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleDateString();
}

function dotLabel(dot: DotColor) {
  switch (dot) {
    case 'gray':
      return 'Not assessed';
    case 'green':
      return 'Low';
    case 'yellow':
      return 'Medium';
    case 'orange':
      return 'High';
    case 'red':
      return 'Critical';
    default:
      return dot;
  }
}

function implementedCount(ac: any) {
  return ac?.implemented ?? ac?.verified ?? 0;
}

type ScopeSummary = {
  risk: {
    total: number;
    unassessed: number;
    veryLow: number;
    low: number;
    medium: number;
    mediumPlus: number;
    high: number;
    veryHigh: number;
  };
  additionalControls: {
    total: number;
    implemented: number;
    overdue: number;
    open: number;
  };
  highRiskRecommendedCategoryCounts: Record<string, number>;
};

function emptySummary(): ScopeSummary {
  return {
    risk: {
      total: 0,
      unassessed: 0,
      veryLow: 0,
      low: 0,
      medium: 0,
      mediumPlus: 0,
      high: 0,
      veryHigh: 0,
    },
    additionalControls: { total: 0, implemented: 0, overdue: 0, open: 0 },
    highRiskRecommendedCategoryCounts: {},
  };
}

function aggregate(items: Array<any>): ScopeSummary {
  const out = emptySummary();

  for (const it of items) {
    const r = it?.risk;
    if (r) {
      out.risk.total += r.total ?? 0;
      out.risk.unassessed += r.unassessed ?? 0;
      out.risk.veryLow += r.veryLow ?? 0;
      out.risk.low += r.low ?? 0;
      out.risk.medium += r.medium ?? 0;
      out.risk.mediumPlus += r.mediumPlus ?? 0;
      out.risk.high += r.high ?? 0;
      out.risk.veryHigh += r.veryHigh ?? 0;
    }

    const ac = it?.additionalControls;
    if (ac) {
      out.additionalControls.total += ac.total ?? 0;
      out.additionalControls.implemented += implementedCount(ac);
      out.additionalControls.overdue += ac.overdue ?? 0;
      out.additionalControls.open += ac.open ?? 0;
    }

    const cc = it?.highRiskRecommendedCategoryCounts ?? {};
    for (const k of Object.keys(cc)) {
      out.highRiskRecommendedCategoryCounts[k] =
        (out.highRiskRecommendedCategoryCounts[k] ?? 0) + (cc[k] ?? 0);
    }
  }

  return out;
}

function RiskBandBars({ risk }: { risk: ScopeSummary['risk'] }) {
  const total = risk.total || 1;
  const rows = [
    { k: 'VERY_HIGH', label: 'Very High', v: risk.veryHigh },
    { k: 'HIGH', label: 'High', v: risk.high },
    { k: 'MEDIUM_PLUS', label: 'Medium+', v: risk.mediumPlus },
    { k: 'MEDIUM', label: 'Medium', v: risk.medium },
    { k: 'LOW', label: 'Low', v: risk.low },
    { k: 'VERY_LOW', label: 'Very Low', v: risk.veryLow },
    { k: 'UNASSESSED', label: 'Not assessed', v: risk.unassessed },
  ];

  return (
    <Stack spacing={0.9}>
      {rows.map((r) => (
        <Box key={r.k}>
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mb: 0.4 }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 850 }}>
              {r.label}
            </Typography>
            <Typography
              sx={{ fontSize: 12, fontWeight: 850, color: 'text.secondary' }}
            >
              {r.v} • {pct(r.v, total)}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={pct(r.v, total)}
            sx={{
              height: 10,
              borderRadius: 99,
              bgcolor: alpha('#000', 0.06),
              '& .MuiLinearProgress-bar': {
                borderRadius: 99,
                bgcolor: alpha(brand.heartRed, 0.55),
              },
            }}
          />
        </Box>
      ))}
    </Stack>
  );
}

function StatPill({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Box
      sx={{
        borderRadius: `${RADIUS}px`,
        border: `1px solid ${alpha('#000', 0.08)}`,
        bgcolor: alpha('#fff', 0.66),
        backdropFilter: 'blur(10px)',
        px: 1.6,
        py: 1.35,
        minWidth: 220,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: 0.6,
            color: 'text.secondary',
          }}
        >
          {label.toUpperCase()}
        </Typography>
        {icon}
      </Stack>

      <Typography sx={{ fontSize: 24, fontWeight: 950, mt: 0.3 }}>
        {value}
      </Typography>

      {sub && (
        <Typography
          sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 750 }}
        >
          {sub}
        </Typography>
      )}
    </Box>
  );
}

/** ✅ Steps endpoint *should* include Step.reviewDate; types didn’t have it. */
type StepWithReview = StepRiskItem & { reviewDate?: string | null };

function getStepReviewDateRaw(s: StepWithReview): string | Date | null {
  return (s as any)?.reviewDate ?? null;
}
function getStepReviewDate(s: StepWithReview): Date | null {
  const raw = getStepReviewDateRaw(s);
  if (!raw) return null;
  const d = typeof raw === 'string' ? new Date(raw) : raw;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysFromNow(d: Date) {
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function ActionCategoryBars({
  metaCats,
  groups,
}: {
  metaCats: ActionCategoryMeta[];
  groups: RecommendationsResponse['groups'] | undefined;
}) {
  const byId = new Map<string, number>();
  for (const g of groups ?? []) byId.set(g.categoryId, g.open ?? 0);

  const rows = metaCats
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color ?? alpha(brand.heartRed, 0.65),
      open: byId.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.open - a.open);

  const totalOpen = rows.reduce((s, r) => s + r.open, 0) || 1;

  return (
    <Stack spacing={0.9}>
      {rows.map((r) => (
        <Box key={r.id}>
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mb: 0.4 }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 850 }}>
              {r.name}
            </Typography>
            <Typography
              sx={{ fontSize: 12, fontWeight: 850, color: 'text.secondary' }}
            >
              {r.open} • {pct(r.open, totalOpen)}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={pct(r.open, totalOpen)}
            sx={{
              height: 10,
              borderRadius: 99,
              bgcolor: alpha('#000', 0.06),
              '& .MuiLinearProgress-bar': {
                borderRadius: 99,
                bgcolor: r.color,
              },
            }}
          />
        </Box>
      ))}
    </Stack>
  );
}

function mapById<T extends { id: string; name: string }>(xs: T[]) {
  const m = new Map<string, string>();
  for (const x of xs) m.set(x.id, x.name);
  return m;
}

export default function RiskManagementPage() {
  const [tab, setTab] = useState<'OVERVIEW' | 'ACTIONS' | 'STEPS'>('OVERVIEW');

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [meta, setMeta] = useState<RiskMetaResponse | null>(null);

  const [lines, setLines] = useState<LineRiskItem[]>([]);
  const [machines, setMachines] = useState<MachineRiskItem[]>([]);
  const [tasks, setTasks] = useState<TaskRiskItem[]>([]);
  const [steps, setSteps] = useState<StepWithReview[]>([]);

  const [lineId, setLineId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  // Task filters (by meta IDs)
  const [taskCategoryId, setTaskCategoryId] = useState<string | null>(null);
  const [taskPhaseId, setTaskPhaseId] = useState<string | null>(null);

  // Steps filters
  const [dotFilter, setDotFilter] = useState<DotColor | null>(null);
  const [actionCategoryId, setActionCategoryId] = useState<string | null>(null);

  // Actions
  const [actions, setActions] = useState<RecommendationsResponse | null>(null);
  const [actionsLoading, setActionsLoading] = useState(false);

  const [actionsView, setActionsView] = useState<
    'OPEN' | 'OVERDUE' | 'IMPLEMENTED' | 'ALL'
  >('OPEN');
  const [actionsSearch, setActionsSearch] = useState('');
  const [actionsCatId, setActionsCatId] = useState<string | null>(null);
  const [actionsBusy, setActionsBusy] = useState<Record<string, boolean>>({});

  // Line-level tasks cache (for reassessment schedule when only Line is selected)
  const [lineTasks, setLineTasks] = useState<
    Array<TaskRiskItem & { _machineName?: string }>
  >([]);
  const [lineTasksLoading, setLineTasksLoading] = useState(false);

  // Reassessment schedule derived from steps.reviewDate
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleIndex, setScheduleIndex] = useState<
    Record<
      string,
      { earliest: Date | null; overdue: boolean; stepsWithDates: number }
    >
  >({});

  // Dialog for step dates
  const [stepScheduleOpen, setStepScheduleOpen] = useState(false);
  const [stepScheduleTask, setStepScheduleTask] = useState<TaskRiskItem | null>(
    null,
  );
  const [stepScheduleRows, setStepScheduleRows] = useState<
    Array<{ stepNo: number; title: string; due: Date | null }>
  >([]);
  const [stepScheduleLoading, setStepScheduleLoading] = useState(false);

  const catNameById = useMemo(
    () => mapById(meta?.taskCategories ?? []),
    [meta],
  );
  const phaseNameById = useMemo(() => mapById(meta?.taskPhases ?? []), [meta]);

  const selectedLine = useMemo(
    () => lines.find((x) => x.id === lineId) ?? null,
    [lines, lineId],
  );
  const selectedMachine = useMemo(
    () => machines.find((x) => x.id === machineId) ?? null,
    [machines, machineId],
  );
  const selectedTask = useMemo(
    () => tasks.find((x) => x.id === taskId) ?? null,
    [tasks, taskId],
  );

  const factorySummary = useMemo(() => aggregate(lines), [lines]);

  const selectionSummary = useMemo(() => {
    if (selectedTask) return aggregate([selectedTask]);
    if (selectedMachine) return aggregate([selectedMachine]);
    if (selectedLine) return aggregate([selectedLine]);
    return factorySummary;
  }, [selectedLine, selectedMachine, selectedTask, factorySummary]);

  const selectionLabel = useMemo(() => {
    const parts = ['Factory'];
    if (selectedLine?.name) parts.push(selectedLine.name);
    if (selectedMachine?.name) parts.push(selectedMachine.name);
    if (selectedTask?.name) parts.push(selectedTask.name);
    return parts.join(' / ');
  }, [selectedLine, selectedMachine, selectedTask]);

  async function reloadAll() {
    setErr(null);
    setLoading(true);
    try {
      const [m, ls] = await Promise.all([rmMeta(), rmLines()]);
      setMeta(m);
      setLines(ls);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load Risk management');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
  }, []);

  // machines
  useEffect(() => {
    (async () => {
      if (!lineId) {
        setMachines([]);
        setMachineId(null);
        setTaskId(null);
        setTasks([]);
        setSteps([]);
        setLineTasks([]);
        return;
      }
      setErr(null);
      try {
        setMachines(await rmMachines(lineId));
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load machines');
      }
    })();
  }, [lineId]);

  // tasks for selected machine (SERVER-SIDE FILTER)
  useEffect(() => {
    (async () => {
      if (!machineId) {
        setTasks([]);
        setTaskId(null);
        setSteps([]);
        return;
      }
      setErr(null);
      try {
        const ts = await rmTasks(machineId, {
          taskCategoryId: taskCategoryId ?? undefined,
          taskPhaseId: taskPhaseId ?? undefined,
        });
        setTasks(ts);

        // if current selected task no longer in filtered set, clear it
        if (taskId && !ts.some((t) => t.id === taskId)) setTaskId(null);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load tasks');
      }
    })();
  }, [machineId, taskCategoryId, taskPhaseId]);

  // tasks across a line (for schedule) — also apply SERVER-SIDE FILTER per machine
  useEffect(() => {
    (async () => {
      if (!lineId || !!machineId) {
        setLineTasks([]);
        setLineTasksLoading(false);
        return;
      }
      if (!machines.length) {
        setLineTasks([]);
        return;
      }

      let cancelled = false;
      setLineTasksLoading(true);

      try {
        const perMachine = await Promise.all(
          machines.map(async (m) => {
            const ts = await rmTasks(m.id, {
              taskCategoryId: taskCategoryId ?? undefined,
              taskPhaseId: taskPhaseId ?? undefined,
            });
            return ts.map((t) => ({ ...t, _machineName: m.name }));
          }),
        );
        if (cancelled) return;
        setLineTasks(perMachine.flat());
      } catch {
        if (cancelled) return;
        setLineTasks([]);
      } finally {
        if (!cancelled) setLineTasksLoading(false);
      }

      return () => {
        cancelled = true;
      };
    })();
  }, [lineId, machineId, machines, taskCategoryId, taskPhaseId]);

  // steps (only when Steps tab is open)
  useEffect(() => {
    (async () => {
      if (tab !== 'STEPS') return;
      if (!taskId) {
        setSteps([]);
        return;
      }
      setErr(null);
      try {
        const res = await rmSteps(taskId, {
          dot: dotFilter ?? undefined,
          actionCategoryId: actionCategoryId ?? undefined,
        });
        setSteps((res?.steps ?? []) as StepWithReview[]);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load steps');
      }
    })();
  }, [tab, taskId, dotFilter, actionCategoryId]);

  // actions: load on Actions tab
  useEffect(() => {
    (async () => {
      if (tab !== 'ACTIONS') return;
      setActionsLoading(true);
      setErr(null);
      try {
        const res = await rmActions({
          lineId: lineId ?? undefined,
          machineId: machineId ?? undefined,
          taskId: taskId ?? undefined,
          limit: 800,
        });
        setActions(res);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load actions');
      } finally {
        setActionsLoading(false);
      }
    })();
  }, [tab, lineId, machineId, taskId]);

  // actions: also load on Overview for the graph (quietly)
  useEffect(() => {
    (async () => {
      if (tab !== 'OVERVIEW') return;
      try {
        const res = await rmActions({
          lineId: lineId ?? undefined,
          machineId: machineId ?? undefined,
          taskId: taskId ?? undefined,
          limit: 800,
        });
        setActions(res);
      } catch {
        // ignore in overview
      }
    })();
  }, [tab, lineId, machineId, taskId]);

  /** ---- Actions table rows ---- */
  const actionRows = useMemo(() => {
    const now = new Date();
    const groups = actions?.groups ?? [];
    const rows: any[] = [];

    for (const g of groups) {
      for (const c of g.controls ?? []) {
        const implemented =
          !!c.isImplemented ||
          !!c.implementedAt ||
          !!c.verifiedAt ||
          (typeof c.status === 'string' &&
            ['IMPLEMENTED', 'VERIFIED'].includes(c.status));

        const implementedAt =
          c.implementedAt ?? c.verifiedAt ?? c.completedAt ?? null;

        const overdue =
          !implemented &&
          c.dueDate &&
          new Date(c.dueDate).getTime() < now.getTime();

        const scopeStr =
          (c.line?.name ?? '—') +
          ' / ' +
          (c.machine?.name ?? '—') +
          (c.task?.name ? ` / ${c.task.name}` : '') +
          (c.step?.stepNo ? ` • Step ${c.step.stepNo}` : '');

        rows.push({
          ...c,
          categoryId: g.categoryId,
          categoryName: g.categoryName,
          color: g.color ?? null,
          implemented,
          implementedAt,
          overdue,
          scopeStr,
        });
      }
    }

    const q = actionsSearch.trim().toLowerCase();

    return rows
      .filter((r) => {
        if (actionsCatId && r.categoryId !== actionsCatId) return false;
        if (actionsView === 'OPEN') return !r.implemented;
        if (actionsView === 'OVERDUE') return r.overdue;
        if (actionsView === 'IMPLEMENTED') return r.implemented;
        return true;
      })
      .filter((r) => {
        if (!q) return true;
        const hay =
          `${r.categoryName ?? ''} ${r.description ?? ''} ${r.scopeStr ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ao = a.overdue ? 0 : 1;
        const bo = b.overdue ? 0 : 1;
        if (ao !== bo) return ao - bo;

        const ad = a.dueDate
          ? new Date(a.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate
          ? new Date(b.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
  }, [actions, actionsView, actionsSearch, actionsCatId]);

  const actionStats = useMemo(() => {
    const groups = actions?.groups ?? [];
    let total = 0;
    let implemented = 0;
    let overdue = 0;

    for (const g of groups) {
      total += g.total ?? 0;
      implemented += g.implemented ?? g.verified ?? 0;
      overdue += g.overdue ?? 0;
    }

    return {
      total,
      implemented,
      open: total - implemented,
      overdue,
      showing: actionRows.length,
    };
  }, [actions, actionRows]);

  async function toggleImplemented(controlId: string, next: boolean) {
    setActionsBusy((p) => ({ ...p, [controlId]: true }));
    setErr(null);

    // optimistic update (just flip flags; counts will correct on refetch)
    setActions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.map((g) => ({
          ...g,
          controls: (g.controls ?? []).map((c) => {
            if (c.id !== controlId) return c;
            return {
              ...c,
              isImplemented: next,
              implementedAt: next ? new Date().toISOString() : null,
              status: next ? 'IMPLEMENTED' : 'OPEN',
            };
          }),
        })),
      };
    });

    try {
      await setRiskControlImplemented(controlId, next);
      // refetch actions in current scope
      const res = await rmActions({
        lineId: lineId ?? undefined,
        machineId: machineId ?? undefined,
        taskId: taskId ?? undefined,
        limit: 800,
      });
      setActions(res);
      await reloadAll();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update action');
    } finally {
      setActionsBusy((p) => ({ ...p, [controlId]: false }));
    }
  }

  /** ---- Reassessment schedule (derived from step.reviewDate) ---- */
  const scopeTasks = useMemo(() => {
    if (selectedTask) return [selectedTask];
    if (machineId) return tasks;
    if (lineId) return lineTasks;
    return [];
  }, [selectedTask, machineId, tasks, lineId, lineTasks]);

  useEffect(() => {
    if (tab !== 'OVERVIEW') return;
    if (!lineId && !machineId && !taskId) {
      setScheduleIndex({});
      setScheduleLoading(false);
      return;
    }
    if (scopeTasks.length === 0) {
      setScheduleIndex({});
      setScheduleLoading(false);
      return;
    }

    let cancelled = false;
    setScheduleLoading(true);

    (async () => {
      const next: typeof scheduleIndex = {};
      const now = new Date();

      // keep it sane
      const taskIds = scopeTasks.map((t) => t.id).slice(0, 120);

      // small concurrency
      const CONCURRENCY = 6;
      let idx = 0;

      async function worker() {
        while (idx < taskIds.length && !cancelled) {
          const tid = taskIds[idx++];
          try {
            const res: StepsRiskResponse = await rmSteps(tid);
            const list = (res?.steps ?? []) as StepWithReview[];
            const dates = list.map(getStepReviewDate).filter(Boolean) as Date[];
            const earliest = dates.length
              ? new Date(Math.min(...dates.map((d) => d.getTime())))
              : null;
            next[tid] = {
              earliest,
              overdue: !!earliest && earliest.getTime() < now.getTime(),
              stepsWithDates: dates.length,
            };
          } catch {
            // IMPORTANT: don’t spam global error for schedule probing
            next[tid] = { earliest: null, overdue: false, stepsWithDates: 0 };
          }
        }
      }

      await Promise.all(new Array(CONCURRENCY).fill(0).map(() => worker()));
      if (cancelled) return;

      setScheduleIndex(next);
      setScheduleLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, lineId, machineId, taskId, scopeTasks]);

  const scheduleRows = useMemo(() => {
    const now = new Date();
    const rows = scopeTasks.map((t: any) => {
      const s = scheduleIndex[t.id];
      const due = s?.earliest ?? null;
      const overdue = !!due && due.getTime() < now.getTime();
      const cat = t.categoryId ? catNameById.get(t.categoryId) : null;
      const ph = t.phaseId ? phaseNameById.get(t.phaseId) : null;
      return {
        t,
        due,
        overdue,
        cat,
        ph,
        stepsWithDates: s?.stepsWithDates ?? 0,
      };
    });

    const overdueRows = rows
      .filter((r) => r.overdue)
      .sort((a, b) => (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0));

    const upcomingRows = rows
      .filter((r) => !r.overdue)
      .sort(
        (a, b) =>
          (a.due?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.due?.getTime() ?? Number.MAX_SAFE_INTEGER),
      );

    const ordered = [...overdueRows, ...upcomingRows];
    const top10 = ordered.slice(0, 10);
    const nextDue = upcomingRows.find((r) => !!r.due)?.due ?? null;

    return {
      ordered,
      top10,
      overdueCount: overdueRows.length,
      nextDue,
    };
  }, [scopeTasks, scheduleIndex, catNameById, phaseNameById]);

  async function openStepSchedule(task: TaskRiskItem) {
    setStepScheduleOpen(true);
    setStepScheduleTask(task);
    setStepScheduleRows([]);
    setStepScheduleLoading(true);

    try {
      const res: StepsRiskResponse = await rmSteps(task.id);
      const list = (res?.steps ?? []) as StepWithReview[];

      const rows = list
        .map((s) => ({
          stepNo: s.stepNo,
          title: s.title,
          due: getStepReviewDate(s),
        }))
        .sort((a, b) => {
          const ad = a.due?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bd = b.due?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return ad - bd;
        });

      setStepScheduleRows(rows);
    } catch {
      setStepScheduleRows([]);
    } finally {
      setStepScheduleLoading(false);
    }
  }

  const factoryHighVeryHigh =
    (factorySummary.risk.high ?? 0) + (factorySummary.risk.veryHigh ?? 0);
  const selectionHighVeryHigh =
    (selectionSummary.risk.high ?? 0) + (selectionSummary.risk.veryHigh ?? 0);

  const assessedPct = pct(
    selectionSummary.risk.total - selectionSummary.risk.unassessed,
    selectionSummary.risk.total,
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <GlassCard title="Risk management">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={22} />
            <Typography sx={{ fontWeight: 850 }}>Loading…</Typography>
          </Stack>
        </GlassCard>
      </Box>
    );
  }

  const selectedTaskCat = selectedTask?.categoryId
    ? catNameById.get(selectedTask.categoryId)
    : null;
  const selectedTaskPhase = selectedTask?.phaseId
    ? phaseNameById.get(selectedTask.phaseId)
    : null;

  const showImplementedAt = actionsView === 'IMPLEMENTED';

  return (
    <Box sx={{ p: 3, pb: 10 }}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        spacing={1.2}
        sx={{ mb: 1.6 }}
      >
        <Box>
          <Typography
            sx={{ fontSize: 26, fontWeight: 950, letterSpacing: 0.2 }}
          >
            Risk management
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <Typography
              sx={{ color: 'text.secondary', fontWeight: 750, fontSize: 12 }}
            >
              {selectionLabel}
            </Typography>

            {selectedTaskCat && (
              <Chip
                size="small"
                label={selectedTaskCat}
                sx={{ fontWeight: 950, bgcolor: alpha('#000', 0.06) }}
              />
            )}
            {selectedTaskPhase && (
              <Chip
                size="small"
                label={selectedTaskPhase}
                sx={{ fontWeight: 950, bgcolor: alpha('#000', 0.06) }}
              />
            )}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Chip
            size="small"
            label={`Factory High+Very High: ${factoryHighVeryHigh}`}
            sx={{ fontWeight: 950, border: `1px solid ${alpha('#000', 0.08)}` }}
          />
          <Chip
            size="small"
            label={`Factory actions open: ${factorySummary.additionalControls.open}`}
            sx={{ fontWeight: 950, border: `1px solid ${alpha('#000', 0.08)}` }}
          />
          <Chip
            size="small"
            label={`Factory actions overdue: ${factorySummary.additionalControls.overdue}`}
            sx={{
              fontWeight: 950,
              border: `1px solid ${alpha('#000', 0.08)}`,
              bgcolor:
                factorySummary.additionalControls.overdue > 0
                  ? alpha('#F59E0B', 0.18)
                  : alpha('#fff', 0.7),
            }}
          />

          <Tooltip title="Reset to Factory">
            <span>
              <IconButton
                onClick={() => {
                  setLineId(null);
                  setMachineId(null);
                  setTaskId(null);
                  setTaskCategoryId(null);
                  setTaskPhaseId(null);
                  setDotFilter(null);
                  setActionCategoryId(null);
                }}
                sx={{
                  ml: 0.5,
                  borderRadius: 2,
                  border: `1px solid ${alpha('#000', 0.08)}`,
                  bgcolor: alpha('#fff', 0.6),
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Refresh">
            <IconButton
              onClick={reloadAll}
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha('#000', 0.08)}`,
                bgcolor: alpha('#fff', 0.6),
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 1.6, borderRadius: `${RADIUS}px` }}>
          {err}
        </Alert>
      )}

      {/* Scope */}
      <GlassCard
        title="Scope"
        right={
          <Tabs
            value={tab === 'OVERVIEW' ? 0 : tab === 'ACTIONS' ? 1 : 2}
            onChange={(_, v) =>
              setTab(v === 0 ? 'OVERVIEW' : v === 1 ? 'ACTIONS' : 'STEPS')
            }
            sx={{
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36, fontWeight: 950 },
            }}
          >
            <Tab label="Overview" />
            <Tab label="Risk management actions" />
            <Tab label="Steps" disabled={!taskId} />
          </Tabs>
        }
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.2}
          alignItems={{ xs: 'stretch', lg: 'center' }}
        >
          <Autocomplete
            options={lines}
            getOptionLabel={(o) => o.name}
            value={selectedLine}
            onChange={(_, v) => {
              setLineId(v?.id ?? null);
              setMachineId(null);
              setTaskId(null);
            }}
            renderInput={(p) => <TextField {...p} label="Line" size="small" />}
            sx={{ minWidth: 260, flex: 1 }}
          />

          <Autocomplete
            options={machines}
            getOptionLabel={(o) => o.name}
            value={selectedMachine}
            onChange={(_, v) => {
              setMachineId(v?.id ?? null);
              setTaskId(null);
            }}
            disabled={!lineId}
            renderInput={(p) => (
              <TextField {...p} label="Machine" size="small" />
            )}
            sx={{ minWidth: 260, flex: 1 }}
          />

          <Autocomplete
            options={tasks as any[]}
            getOptionLabel={(o: any) => o.name}
            value={selectedTask as any}
            onChange={(_, v: any) => setTaskId(v?.id ?? null)}
            disabled={!machineId}
            renderInput={(p) => <TextField {...p} label="Task" size="small" />}
            renderOption={(props, o: any) => {
              const cn = o.categoryId ? catNameById.get(o.categoryId) : null;
              const pn = o.phaseId ? phaseNameById.get(o.phaseId) : null;
              return (
                <li {...props}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ width: '100%' }}
                  >
                    <Typography sx={{ fontWeight: 850 }}>{o.name}</Typography>
                    <Stack direction="row" spacing={0.7} alignItems="center">
                      {cn && (
                        <Chip
                          size="small"
                          label={cn}
                          sx={{ fontWeight: 900 }}
                        />
                      )}
                      {pn && (
                        <Chip
                          size="small"
                          label={pn}
                          sx={{ fontWeight: 900 }}
                        />
                      )}
                    </Stack>
                  </Stack>
                </li>
              );
            }}
            sx={{ minWidth: 340, flex: 1.2 }}
          />
        </Stack>
      </GlassCard>

      {/* Task filters (separate card, no description) */}
      {(!!machineId || (!!lineId && !machineId)) && (
        <Box sx={{ mt: 1.4 }}>
          <GlassCard
            title="Task filters"
            right={
              (taskCategoryId || taskPhaseId) && (
                <Button
                  size="small"
                  onClick={() => {
                    setTaskCategoryId(null);
                    setTaskPhaseId(null);
                  }}
                  sx={{ fontWeight: 950 }}
                >
                  Clear
                </Button>
              )
            }
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
              <Autocomplete
                options={meta?.taskCategories ?? []}
                getOptionLabel={(o: TaskCategoryMeta) => o.name}
                value={
                  (meta?.taskCategories ?? []).find(
                    (x) => x.id === taskCategoryId,
                  ) ?? null
                }
                onChange={(_, v) => setTaskCategoryId(v?.id ?? null)}
                renderInput={(p) => (
                  <TextField {...p} label="Category" size="small" />
                )}
                sx={{ minWidth: 260, flex: 1 }}
              />
              <Autocomplete
                options={meta?.taskPhases ?? []}
                getOptionLabel={(o: TaskPhaseMeta) => o.name}
                value={
                  (meta?.taskPhases ?? []).find((x) => x.id === taskPhaseId) ??
                  null
                }
                onChange={(_, v) => setTaskPhaseId(v?.id ?? null)}
                renderInput={(p) => (
                  <TextField {...p} label="Phase" size="small" />
                )}
                sx={{ minWidth: 260, flex: 1 }}
              />
              <Box sx={{ flex: 1 }} />
              {lineId && !machineId && (
                <Chip
                  size="small"
                  label={
                    lineTasksLoading
                      ? 'Loading tasks…'
                      : `${lineTasks.length} tasks`
                  }
                  sx={{
                    fontWeight: 950,
                    border: `1px solid ${alpha('#000', 0.08)}`,
                    bgcolor: alpha('#fff', 0.7),
                    alignSelf: { xs: 'flex-start', md: 'center' },
                  }}
                />
              )}
            </Stack>
          </GlassCard>
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        {tab === 'OVERVIEW' && (
          <Stack spacing={2}>
            {/* KPIs */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.25}
              flexWrap="wrap"
            >
              <StatPill
                label="High + very high steps"
                value={selectionHighVeryHigh}
                sub={`${selectionSummary.risk.total} steps • ${assessedPct}% assessed`}
                icon={<WarningAmberRoundedIcon sx={{ opacity: 0.7 }} />}
              />
              <StatPill
                label="Actions open"
                value={selectionSummary.additionalControls.open}
                sub={`${selectionSummary.additionalControls.overdue} overdue`}
                icon={<WarningAmberRoundedIcon sx={{ opacity: 0.7 }} />}
              />
              <StatPill
                label="Implemented"
                value={`${selectionSummary.additionalControls.implemented}/${selectionSummary.additionalControls.total}`}
                sub={`${pct(
                  selectionSummary.additionalControls.implemented,
                  selectionSummary.additionalControls.total,
                )}% complete`}
                icon={<DoneRoundedIcon sx={{ opacity: 0.7 }} />}
              />
              <StatPill
                label="Overdue reassessments"
                value={
                  lineId || machineId || taskId
                    ? scheduleRows.overdueCount
                    : '—'
                }
                sub={
                  !lineId && !machineId && !taskId
                    ? 'Select a Line / Machine'
                    : scheduleLoading
                      ? 'Checking step review dates…'
                      : scheduleRows.nextDue
                        ? `Next due: ${safeDate(scheduleRows.nextDue)}`
                        : 'No step review dates found'
                }
                icon={<WarningAmberRoundedIcon sx={{ opacity: 0.7 }} />}
              />
              <Box sx={{ flex: 1 }} />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr' },
                gap: 2,
                alignItems: 'start', // ✅ stops “stretched card = white space”
              }}
            >
              <GlassCard title="Risk distribution">
                <RiskBandBars risk={selectionSummary.risk} />
              </GlassCard>

              <Stack spacing={2}>
                <GlassCard title="Risk management actions">
                  {meta?.actionCategories?.length ? (
                    <ActionCategoryBars
                      metaCats={meta.actionCategories}
                      groups={actions?.groups}
                    />
                  ) : (
                    <Typography
                      sx={{ color: 'text.secondary', fontWeight: 750 }}
                    >
                      No action categories found.
                    </Typography>
                  )}
                </GlassCard>

                <GlassCard
                  title="Reassessment schedule"
                  titleClickable
                  onTitleClick={() => setScheduleExpanded((p) => !p)}
                  right={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label={
                          scheduleLoading
                            ? 'Loading…'
                            : `${scheduleRows.overdueCount} overdue`
                        }
                        sx={{
                          fontWeight: 950,
                          border: `1px solid ${alpha('#000', 0.08)}`,
                          bgcolor:
                            scheduleRows.overdueCount > 0
                              ? alpha('#F59E0B', 0.18)
                              : alpha('#fff', 0.7),
                        }}
                      />
                      <IconButton
                        onClick={() => setScheduleExpanded((p) => !p)}
                        sx={{
                          borderRadius: 2,
                          border: `1px solid ${alpha('#000', 0.08)}`,
                          bgcolor: alpha('#fff', 0.6),
                        }}
                      >
                        {scheduleExpanded ? (
                          <ExpandLessRoundedIcon />
                        ) : (
                          <ExpandMoreRoundedIcon />
                        )}
                      </IconButton>
                    </Stack>
                  }
                >
                  {!lineId && !machineId && !taskId ? (
                    <Typography
                      sx={{ color: 'text.secondary', fontWeight: 750 }}
                    >
                      Pick a Line / Machine / Task to see due reassessments.
                    </Typography>
                  ) : scheduleLoading && scheduleRows.top10.length === 0 ? (
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography sx={{ fontWeight: 850 }}>
                        Checking step review dates…
                      </Typography>
                    </Stack>
                  ) : scheduleRows.ordered.length === 0 ? (
                    <Typography
                      sx={{ color: 'text.secondary', fontWeight: 750 }}
                    >
                      No tasks found in this scope.
                    </Typography>
                  ) : (
                    <Stack spacing={0.9}>
                      {/* Always show top 10 */}
                      {scheduleRows.top10.map((r) => {
                        const due = r.due;
                        const overdue = r.overdue;
                        const badge =
                          due == null
                            ? '—'
                            : overdue
                              ? `${Math.abs(daysFromNow(due))}d overdue`
                              : `${daysFromNow(due)}d`;

                        return (
                          <Stack
                            key={r.t.id}
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            onClick={() => openStepSchedule(r.t)}
                            sx={{
                              cursor: 'pointer',
                              borderRadius: `${RADIUS}px`,
                              border: `1px solid ${alpha('#000', 0.08)}`,
                              bgcolor: overdue
                                ? alpha('#F59E0B', 0.12)
                                : alpha('#fff', 0.55),
                              px: 1.2,
                              py: 0.9,
                            }}
                          >
                            <Box sx={{ pr: 1 }}>
                              <Typography sx={{ fontWeight: 900 }}>
                                {r.t.name}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: 12,
                                  color: 'text.secondary',
                                  fontWeight: 750,
                                }}
                              >
                                {'_machineName' in r.t &&
                                (r.t as any)._machineName
                                  ? `${(r.t as any)._machineName} • `
                                  : ''}
                                Due {safeDate(due)}
                                {r.cat ? ` • ${r.cat}` : ''}
                                {r.ph ? ` • ${r.ph}` : ''}
                              </Typography>
                            </Box>

                            <Chip
                              size="small"
                              label={badge}
                              sx={{
                                fontWeight: 950,
                                bgcolor: overdue
                                  ? alpha('#F59E0B', 0.2)
                                  : alpha('#000', 0.06),
                              }}
                            />
                          </Stack>
                        );
                      })}

                      <Collapse
                        in={scheduleExpanded}
                        timeout={180}
                        unmountOnExit
                      >
                        <Box sx={{ mt: 1 }}>
                          <Divider sx={{ mb: 1 }} />
                          <Typography
                            sx={{
                              fontSize: 12,
                              fontWeight: 950,
                              color: 'text.secondary',
                              mb: 1,
                            }}
                          >
                            All tasks (ordered: overdue → due soon)
                          </Typography>
                          <Stack spacing={0.75}>
                            {scheduleRows.ordered.map((r) => (
                              <Stack
                                key={r.t.id}
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                onClick={() => openStepSchedule(r.t)}
                                sx={{
                                  cursor: 'pointer',
                                  borderRadius: `${RADIUS}px`,
                                  border: `1px solid ${alpha('#000', 0.08)}`,
                                  bgcolor: alpha('#fff', 0.55),
                                  px: 1.2,
                                  py: 0.85,
                                }}
                              >
                                <Typography sx={{ fontWeight: 850 }}>
                                  {r.t.name}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={safeDate(r.due)}
                                  sx={{
                                    fontWeight: 950,
                                    bgcolor: r.overdue
                                      ? alpha('#F59E0B', 0.18)
                                      : alpha('#000', 0.06),
                                  }}
                                />
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      </Collapse>

                      <Typography
                        sx={{
                          fontSize: 12,
                          color: 'text.secondary',
                          fontWeight: 750,
                        }}
                      >
                        Showing top 10. Click a task to see step dates.
                      </Typography>
                    </Stack>
                  )}
                </GlassCard>
              </Stack>
            </Box>
          </Stack>
        )}

        {tab === 'ACTIONS' && (
          <GlassCard
            title="Risk management actions"
            right={
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={`Open ${actionStats.open}`}
                  sx={{
                    fontWeight: 950,
                    border: `1px solid ${alpha('#000', 0.08)}`,
                  }}
                />
                <Chip
                  size="small"
                  label={`Overdue ${actionStats.overdue}`}
                  sx={{
                    fontWeight: 950,
                    border: `1px solid ${alpha('#000', 0.08)}`,
                    bgcolor:
                      actionStats.overdue > 0
                        ? alpha('#F59E0B', 0.18)
                        : alpha('#fff', 0.7),
                  }}
                />
                <Chip
                  size="small"
                  label={`Implemented ${actionStats.implemented}`}
                  sx={{
                    fontWeight: 950,
                    border: `1px solid ${alpha('#000', 0.08)}`,
                    bgcolor: alpha('#10B981', 0.1),
                  }}
                />
              </Stack>
            }
          >
            <Stack spacing={1.25}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.2}
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {(['OPEN', 'OVERDUE', 'IMPLEMENTED', 'ALL'] as const).map(
                    (k) => {
                      const active = actionsView === k;
                      const label =
                        k === 'OPEN'
                          ? 'Open'
                          : k === 'OVERDUE'
                            ? 'Overdue'
                            : k === 'IMPLEMENTED'
                              ? 'Implemented'
                              : 'All';
                      return (
                        <Chip
                          key={k}
                          label={label}
                          onClick={() => setActionsView(k)}
                          sx={{
                            fontWeight: 950,
                            border: `1px solid ${alpha('#000', 0.08)}`,
                            bgcolor: active
                              ? alpha(brand.heartRed, 0.12)
                              : alpha('#fff', 0.7),
                            cursor: 'pointer',
                          }}
                        />
                      );
                    },
                  )}
                </Stack>

                <Box sx={{ flex: 1 }} />

                <Autocomplete
                  options={meta?.actionCategories ?? []}
                  getOptionLabel={(o: any) => o.name}
                  value={
                    (meta?.actionCategories ?? []).find(
                      (x: any) => x.id === actionsCatId,
                    ) ?? null
                  }
                  onChange={(_, v) => setActionsCatId(v?.id ?? null)}
                  renderInput={(p) => (
                    <TextField {...p} label="Category" size="small" />
                  )}
                  sx={{ minWidth: 240 }}
                />

                <TextField
                  value={actionsSearch}
                  onChange={(e) => setActionsSearch(e.target.value)}
                  label="Search"
                  size="small"
                  sx={{ minWidth: 260 }}
                />
              </Stack>

              <Divider />

              {actionsLoading ? (
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography sx={{ fontWeight: 850 }}>Loading…</Typography>
                </Stack>
              ) : actionRows.length === 0 ? (
                <Typography sx={{ color: 'text.secondary', fontWeight: 750 }}>
                  No actions match your filters.
                </Typography>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{ fontWeight: 950, width: 92 }}
                          align="center"
                        >
                          Done
                        </TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>Action</TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>Due</TableCell>
                        {showImplementedAt && (
                          <TableCell sx={{ fontWeight: 950 }}>
                            Implemented
                          </TableCell>
                        )}
                        <TableCell sx={{ fontWeight: 950 }}>Location</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {actionRows.slice(0, 250).map((r) => {
                        const busy = !!actionsBusy[r.id];
                        return (
                          <TableRow
                            key={r.id}
                            hover
                            sx={{
                              bgcolor: r.overdue
                                ? alpha('#F59E0B', 0.1)
                                : 'transparent',
                            }}
                          >
                            <TableCell align="center">
                              <Checkbox
                                checked={!!r.implemented}
                                disabled={busy}
                                onChange={(_, v) => toggleImplemented(r.id, v)}
                              />
                            </TableCell>

                            <TableCell sx={{ fontWeight: 850 }}>
                              <Stack spacing={0.35}>
                                <Typography sx={{ fontWeight: 900 }}>
                                  {r.description}
                                </Typography>
                                {r.step?.title && (
                                  <Typography
                                    sx={{
                                      fontSize: 12,
                                      color: 'text.secondary',
                                      fontWeight: 750,
                                    }}
                                  >
                                    Step {r.step.stepNo}: {r.step.title}
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>

                            <TableCell>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 99,
                                    bgcolor:
                                      r.color ?? alpha(brand.heartRed, 0.65),
                                    border: `1px solid ${alpha('#000', 0.12)}`,
                                  }}
                                />
                                <Typography sx={{ fontWeight: 850 }}>
                                  {r.categoryName}
                                </Typography>
                              </Stack>
                            </TableCell>

                            <TableCell>
                              <Chip
                                size="small"
                                label={safeDate(r.dueDate)}
                                sx={{
                                  fontWeight: 900,
                                  bgcolor: r.overdue
                                    ? alpha('#F59E0B', 0.2)
                                    : alpha('#000', 0.06),
                                }}
                              />
                            </TableCell>

                            {showImplementedAt && (
                              <TableCell>{safeDate(r.implementedAt)}</TableCell>
                            )}

                            <TableCell
                              sx={{ color: 'text.secondary', fontWeight: 750 }}
                            >
                              {r.scopeStr}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {actionRows.length > 250 && (
                    <Typography
                      sx={{
                        mt: 1,
                        fontSize: 12,
                        color: 'text.secondary',
                        fontWeight: 750,
                      }}
                    >
                      Showing 250 of {actionRows.length}. Use filters/search to
                      narrow.
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          </GlassCard>
        )}

        {tab === 'STEPS' && (
          <GlassCard title="Steps">
            {!taskId ? (
              <Typography sx={{ color: 'text.secondary', fontWeight: 750 }}>
                Select a task to view steps.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                  <Autocomplete
                    options={
                      ['red', 'orange', 'yellow', 'green', 'gray'] as DotColor[]
                    }
                    getOptionLabel={(o) => `Priority: ${dotLabel(o)}`}
                    value={dotFilter}
                    onChange={(_, v) => setDotFilter(v ?? null)}
                    renderInput={(p) => (
                      <TextField {...p} label="Priority" size="small" />
                    )}
                    sx={{ minWidth: 220 }}
                  />
                  <Autocomplete
                    options={meta?.actionCategories ?? []}
                    getOptionLabel={(o: any) => o.name}
                    value={
                      (meta?.actionCategories ?? []).find(
                        (x: any) => x.id === actionCategoryId,
                      ) ?? null
                    }
                    onChange={(_, v) => setActionCategoryId(v?.id ?? null)}
                    renderInput={(p) => (
                      <TextField
                        {...p}
                        label="Recommended category"
                        size="small"
                      />
                    )}
                    sx={{ minWidth: 320 }}
                  />
                  <Box sx={{ flex: 1 }} />
                  <Chip
                    label={`${steps.length} steps`}
                    sx={{
                      fontWeight: 950,
                      border: `1px solid ${alpha('#000', 0.08)}`,
                    }}
                  />
                </Stack>

                <Divider />

                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 950 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>Step</TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>Priority</TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>Current</TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>
                          Predicted
                        </TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>
                          Reassessment due
                        </TableCell>
                        <TableCell sx={{ fontWeight: 950 }} align="right">
                          Categories
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {steps.map((s) => {
                        const due = getStepReviewDate(s);
                        const overdue = !!due && due.getTime() < Date.now();
                        return (
                          <TableRow key={s.id} hover>
                            <TableCell sx={{ fontWeight: 950 }}>
                              {s.stepNo}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 850 }}>
                              {s.title}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={s.dot ? dotLabel(s.dot) : '—'}
                                sx={{
                                  fontWeight: 900,
                                  bgcolor:
                                    s.dot === 'red'
                                      ? alpha(brand.heartRed, 0.14)
                                      : s.dot === 'orange'
                                        ? alpha('#F59E0B', 0.18)
                                        : s.dot === 'yellow'
                                          ? alpha('#FBBF24', 0.18)
                                          : s.dot === 'green'
                                            ? alpha('#10B981', 0.16)
                                            : alpha('#000', 0.06),
                                }}
                              />
                            </TableCell>
                            <TableCell>{s.currentBand ?? '—'}</TableCell>
                            <TableCell>{s.predictedBand ?? '—'}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={safeDate(getStepReviewDateRaw(s) as any)}
                                sx={{
                                  fontWeight: 900,
                                  bgcolor: overdue
                                    ? alpha('#F59E0B', 0.2)
                                    : alpha('#000', 0.06),
                                }}
                              />
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: 'text.secondary', fontWeight: 750 }}
                            >
                              {(s.recommendedActionCategoryIds ?? []).length}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Stack>
            )}
          </GlassCard>
        )}
      </Box>

      {/* Step schedule dialog */}
      <Dialog
        open={stepScheduleOpen}
        onClose={() => setStepScheduleOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ fontWeight: 950 }}>
          {stepScheduleTask?.name ?? 'Task'} — step reassessment dates
        </DialogTitle>
        <DialogContent>
          {stepScheduleLoading ? (
            <Stack
              direction="row"
              spacing={1.2}
              alignItems="center"
              sx={{ py: 1 }}
            >
              <CircularProgress size={18} />
              <Typography sx={{ fontWeight: 850 }}>Loading…</Typography>
            </Stack>
          ) : stepScheduleRows.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', fontWeight: 750 }}>
              No step review dates found.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 950, width: 80 }}>
                      Step
                    </TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 950, width: 190 }}>
                      Reassessment due
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 950, width: 120 }}
                      align="right"
                    >
                      Status
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stepScheduleRows.map((r) => {
                    const overdue = !!r.due && r.due.getTime() < Date.now();
                    return (
                      <TableRow key={`${r.stepNo}-${r.title}`} hover>
                        <TableCell sx={{ fontWeight: 950 }}>
                          {r.stepNo}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 850 }}>
                          {r.title}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={safeDate(r.due)}
                            sx={{
                              fontWeight: 950,
                              bgcolor: overdue
                                ? alpha('#F59E0B', 0.2)
                                : alpha('#000', 0.06),
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {r.due == null ? (
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: 'text.secondary',
                                fontWeight: 750,
                              }}
                            >
                              —
                            </Typography>
                          ) : overdue ? (
                            <Chip
                              size="small"
                              label="Overdue"
                              sx={{
                                fontWeight: 950,
                                bgcolor: alpha('#F59E0B', 0.2),
                              }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              label="Upcoming"
                              sx={{
                                fontWeight: 950,
                                bgcolor: alpha('#10B981', 0.12),
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setStepScheduleOpen(false)}
            sx={{ fontWeight: 950 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
