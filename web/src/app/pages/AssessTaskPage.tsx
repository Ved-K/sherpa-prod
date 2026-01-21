/* eslint-disable react-hooks/rules-of-hooks */
// src/app/pages/AssessTaskPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { listStepsForTask, type Step } from '../api/steps';
import {
  listHazardCategories,
  listHazards,
  type Hazard,
  type HazardCategory,
} from '../api/hazards';
import {
  listActionCategories,
  type ActionCategory,
} from '../api/actionCategories';
import {
  bulkCreateAssessments,
  deleteAssessment,
  listAssessmentsForStep,
  patchAssessment,
  type Assessment,
} from '../api/assessments';
import {
  createControl,
  deleteControl,
  listControls,
  patchControl,
  type Control,
  type ControlType,
} from '../api/controls';
import { getStepsDashboard, type StepDashboardItem } from '../api/dashboard';

import {
  UNILEVER_PROBABILITIES,
  UNILEVER_SEVERITIES,
  bandChipColor,
  unileverBand,
  unileverRating,
} from '../utils/UnileverRiskMatrix1';

/* ------------------------------ Types ------------------------------ */

type RiskBandKey =
  | 'VERY_HIGH'
  | 'HIGH'
  | 'MEDIUM_PLUS'
  | 'MEDIUM'
  | 'LOW'
  | 'VERY_LOW'
  | 'UNASSESSED';

type Tone = 'default' | 'error' | 'warning' | 'info' | 'success';

/* ------------------------------ Utils ------------------------------ */

// null/undefined -> undefined (fixes TS mismatch vs helpers expecting number|undefined)
function n(v?: number | null): number | undefined {
  return v == null ? undefined : v;
}

// trim + collapse whitespace, return undefined if empty
function cleanText(s?: string | null): string | undefined {
  const t = String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return t.length ? t : undefined;
}

function fmtDateInput(iso?: string | null) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function highestBandFromCounts(
  counts?: StepDashboardItem['counts'],
): RiskBandKey {
  if (!counts) return 'UNASSESSED';
  const total = counts.total ?? 0;
  const unassessed = counts.unassessed ?? 0;
  if (total > 0 && unassessed >= total) return 'UNASSESSED';
  if ((counts.veryHigh ?? 0) > 0) return 'VERY_HIGH';
  if ((counts.high ?? 0) > 0) return 'HIGH';
  if ((counts.mediumPlus ?? 0) > 0) return 'MEDIUM_PLUS';
  if ((counts.medium ?? 0) > 0) return 'MEDIUM';
  if ((counts.low ?? 0) > 0) return 'LOW';
  return 'VERY_LOW';
}

function bandLabel(b: RiskBandKey) {
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
    default:
      return 'Unassessed';
  }
}

function bandChipTone(b: RiskBandKey): Tone {
  switch (b) {
    case 'VERY_HIGH':
      return 'error';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM_PLUS':
      return 'info';
    case 'MEDIUM':
      return 'default';
    case 'LOW':
    case 'VERY_LOW':
      return 'success';
    default:
      return 'default';
  }
}

function startedFromCounts(counts?: StepDashboardItem['counts']): boolean {
  const total = counts?.total ?? 0;
  const unassessed = counts?.unassessed ?? 0;
  return total > 0 && unassessed < total;
}

/* ------------------------------ Styles ----------------------------- */

const cardSx = {
  borderRadius: 3,
  boxShadow: 'none',
  borderColor: 'divider',
} as const;

const stepTileSx = (selected: boolean) =>
  ({
    border: '1px solid',
    borderColor: selected ? 'rgba(0,0,0,0.65)' : 'divider',
    borderRadius: 2.5,
    p: 1.2,
    backgroundColor: selected ? 'rgba(0,0,0,0.03)' : 'transparent',
  }) as const;

/* ============================== Page =============================== */

export default function AssessTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const nav = useNavigate();

  const taskIdStr = String(taskId ?? '').trim();

  const [err, setErr] = useState<string | null>(null);

  const [steps, setSteps] = useState<Step[]>([]);
  const [stepDash, setStepDash] = useState<StepDashboardItem[]>([]);
  const stepDashById = useMemo(() => {
    const m = new Map<string, StepDashboardItem>();
    stepDash.forEach((s) => m.set(String(s.id), s));
    return m;
  }, [stepDash]);

  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const selectedStep = useMemo(
    () => steps.find((s) => String(s.id) === String(selectedStepId)) ?? null,
    [steps, selectedStepId],
  );

  const [loadingSteps, setLoadingSteps] = useState(true);

  const [hazCats, setHazCats] = useState<HazardCategory[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const hazardById = useMemo(() => {
    const m = new Map<string, Hazard>();
    hazards.forEach((h) => m.set(String(h.id), h));
    return m;
  }, [hazards]);

  const catById = useMemo(() => {
    const m = new Map<string, HazardCategory>();
    hazCats.forEach((c) => m.set(String(c.id), c));
    return m;
  }, [hazCats]);

  const [actionCats, setActionCats] = useState<ActionCategory[]>([]);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Hazard picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerQ, setPickerQ] = useState('');
  const [pickerCat, setPickerCat] = useState('');
  const [pickerList, setPickerList] = useState<Hazard[]>([]);
  const [selectedHazardIds, setSelectedHazardIds] = useState<Set<string>>(
    new Set(),
  );
  const [pickerShowSelectedOnly, setPickerShowSelectedOnly] = useState(false);

  if (!taskIdStr) {
    return (
      <Alert severity="error">
        Missing taskId in URL. Route should be <b>/tasks/:taskId/assess</b>
      </Alert>
    );
  }

  /* ------------------------- Load libraries ------------------------ */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        const [cats, haz, acats] = await Promise.all([
          listHazardCategories(),
          listHazards(),
          listActionCategories({ activeOnly: 'true' }),
        ]);
        if (!alive) return;
        setHazCats(cats ?? []);
        setHazards(haz ?? []);
        setActionCats((acats ?? []).filter((x) => x.isActive !== false));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load libraries');
      }
    })();

    return () => {
      alive = false;
    };
  }, [taskIdStr]);

  /* ---------------------- Load steps + dash ------------------------ */

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingSteps(true);
      setErr(null);

      try {
        const s = await listStepsForTask(taskIdStr);
        if (!alive) return;

        const sorted = (s ?? []).slice().sort((a, b) => a.stepNo - b.stepNo);
        setSteps(sorted);
        setSelectedStepId(sorted[0] ? String(sorted[0].id) : '');

        if (sorted.length === 0) {
          nav(`/tasks/${taskIdStr}/steps/new`, { replace: true });
          return;
        }

        try {
          const d = await getStepsDashboard(taskIdStr);
          if (!alive) return;
          setStepDash((d ?? []).slice().sort((a, b) => a.stepNo - b.stepNo));
        } catch {
          if (!alive) return;
          setStepDash([]);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load steps');
        setSteps([]);
        setSelectedStepId('');
        setStepDash([]);
      } finally {
        if (alive) setLoadingSteps(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [taskIdStr, nav]);

  async function refreshStepDash() {
    try {
      const d = await getStepsDashboard(taskIdStr);
      setStepDash((d ?? []).slice().sort((a, b) => a.stepNo - b.stepNo));
    } catch {
      // non-blocking
    }
  }

  /* ----------------------- Progress + risk ------------------------- */

  const taskProgress = useMemo(() => {
    const total = steps.length;
    if (total === 0) return { total: 0, started: 0, pct: 0, show: false };

    const started = steps.reduce((acc, step) => {
      const dash = stepDashById.get(String(step.id));
      return acc + (startedFromCounts(dash?.counts) ? 1 : 0);
    }, 0);

    const pct = total > 0 ? Math.round((started / total) * 100) : 0;
    const show = started > 0;
    return { total, started, pct, show };
  }, [steps, stepDashById]);

  const highestResidual = useMemo(() => {
    if (!taskProgress.show) return 'UNASSESSED' as RiskBandKey;

    let best: RiskBandKey = 'UNASSESSED';
    const rank: Record<RiskBandKey, number> = {
      UNASSESSED: 0,
      VERY_LOW: 1,
      LOW: 2,
      MEDIUM: 3,
      MEDIUM_PLUS: 4,
      HIGH: 5,
      VERY_HIGH: 6,
    };

    for (const s of stepDash) {
      const b = highestBandFromCounts(s.counts);
      if (rank[b] > rank[best]) best = b;
    }

    return best;
  }, [stepDash, taskProgress.show]);

  /* ----------------------- Assessments load ------------------------ */

  async function loadAssessments(stepId: string) {
    setLoadingAssessments(true);
    setErr(null);
    try {
      const data = await listAssessmentsForStep(stepId);
      setAssessments(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load assessments');
      setAssessments([]);
    } finally {
      setLoadingAssessments(false);
    }
  }

  useEffect(() => {
    if (!selectedStepId) {
      setAssessments([]);
      return;
    }
    loadAssessments(selectedStepId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStepId]);

  /* ------------------------ Step navigation ------------------------ */

  function stepIndex() {
    return steps.findIndex((s) => String(s.id) === String(selectedStepId));
  }

  function goPrevStep() {
    const i = stepIndex();
    if (i > 0) setSelectedStepId(String(steps[i - 1].id));
  }

  function goNextStep() {
    const i = stepIndex();
    if (i >= 0 && i < steps.length - 1) {
      setSelectedStepId(String(steps[i + 1].id));
    }
  }

  /* ------------------------ Hazard picker -------------------------- */

  const filteredPicker = useMemo(() => {
    const qq = pickerQ.trim().replace(/\s+/g, ' ').toLowerCase();

    return (pickerList ?? []).filter((h) => {
      if (pickerCat && String(h.categoryId) !== String(pickerCat)) return false;

      const matchesQ =
        !qq ||
        (h.name ?? '').toLowerCase().includes(qq) ||
        (h.code ?? '').toLowerCase().includes(qq) ||
        (h.description ?? '').toLowerCase().includes(qq);

      if (!matchesQ) return false;

      if (pickerShowSelectedOnly) return selectedHazardIds.has(String(h.id));

      return true;
    });
  }, [
    pickerList,
    pickerQ,
    pickerCat,
    pickerShowSelectedOnly,
    selectedHazardIds,
  ]);

  const hazardsByCategory = useMemo(() => {
    const map = new Map<string, Hazard[]>();
    for (const h of filteredPicker) {
      const k = String(h.categoryId);
      map.set(k, [...(map.get(k) ?? []), h]);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          String(a.code ?? '').localeCompare(String(b.code ?? '')),
      );
      map.set(k, arr);
    }
    return map;
  }, [filteredPicker]);

  function setHazardChecked(hazardId: string, checked: boolean) {
    setSelectedHazardIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(hazardId);
      else next.delete(hazardId);
      return next;
    });
  }

  function toggleCategory(categoryId: string, check: boolean) {
    const hz = hazardsByCategory.get(categoryId) ?? [];
    setSelectedHazardIds((prev) => {
      const next = new Set(prev);
      for (const h of hz) {
        const id = String(h.id);
        if (check) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function openPicker() {
    setPickerOpen(true);
    setPickerQ('');
    setPickerCat('');
    setPickerShowSelectedOnly(false);
    setSelectedHazardIds(new Set());

    if (hazards.length > 0) {
      setPickerList(hazards);
      return;
    }

    setPickerLoading(true);
    try {
      const data = await listHazards();
      setPickerList(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load hazards');
      setPickerList([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function refreshPicker() {
    setPickerLoading(true);
    try {
      const data = await listHazards({
        q: pickerQ || undefined,
        categoryId: pickerCat || undefined,
      });
      setPickerList(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to search hazards');
      setPickerList([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function addSelectedHazards() {
    if (!selectedStepId) return;
    const ids = Array.from(selectedHazardIds);
    if (ids.length === 0) return;

    setPickerLoading(true);
    try {
      await bulkCreateAssessments(selectedStepId, ids);
      await loadAssessments(selectedStepId);
      await refreshStepDash();
      setPickerOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to add hazards');
    } finally {
      setPickerLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.6} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 950, fontSize: { xs: 24, md: 32 } }}>
            Risk assessment
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontWeight: 650 }}>
            Step → Hazards → Existing vs After controls → Controls / Actions.
          </Typography>

          {taskProgress.show && (
            <Box
              sx={{
                mt: 0.9,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2.5,
                p: 1.1,
                maxWidth: 760,
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
                sx={{ mb: 0.6 }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  {`Progress: ${taskProgress.started}/${taskProgress.total} steps started (${taskProgress.pct}%)`}
                </Typography>
                <Chip
                  size="small"
                  label={`Highest risk: ${bandLabel(highestResidual)}`}
                  color={bandChipTone(highestResidual)}
                  sx={{ fontWeight: 900, borderRadius: 2 }}
                />
              </Stack>

              <LinearProgress
                variant="determinate"
                value={taskProgress.pct}
                sx={{ height: 10, borderRadius: 999 }}
              />
            </Box>
          )}
        </Stack>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => nav(`/tasks/${taskIdStr}/assess`)}
          sx={{ borderRadius: 2 }}
        >
          Back
        </Button>
      </Stack>

      {!!err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '340px 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* LEFT: steps rail */}
        <Card variant="outlined" sx={cardSx}>
          <CardContent>
            <Typography sx={{ fontWeight: 950, mb: 1 }}>Steps</Typography>
            <Divider sx={{ mb: 1.5 }} />

            {loadingSteps ? (
              <Stack alignItems="center" sx={{ py: 3 }}>
                <CircularProgress size={22} />
              </Stack>
            ) : (
              <Stack spacing={1}>
                {steps.map((s) => {
                  const selected = String(s.id) === String(selectedStepId);

                  const dash = stepDashById.get(String(s.id));
                  const band = highestBandFromCounts(dash?.counts);
                  const started = startedFromCounts(dash?.counts);

                  return (
                    <Box
                      key={String(s.id)}
                      onClick={() => setSelectedStepId(String(s.id))}
                      role="button"
                      tabIndex={0}
                      sx={{ cursor: 'pointer' }}
                    >
                      <Box sx={stepTileSx(selected)}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          gap={1}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" gap={1} alignItems="center">
                              <Typography sx={{ fontWeight: 950 }}>
                                Step {s.stepNo}
                              </Typography>

                              {started && (
                                <Badge
                                  variant="dot"
                                  color="success"
                                  overlap="circular"
                                  sx={{
                                    '& .MuiBadge-badge': {
                                      width: 8,
                                      height: 8,
                                      borderRadius: 999,
                                    },
                                  }}
                                />
                              )}
                            </Stack>

                            <Typography
                              sx={{ color: 'text.secondary', fontWeight: 650 }}
                              noWrap
                              title={s.title}
                            >
                              {s.title || 'Untitled'}
                            </Typography>
                          </Box>

                          <Chip
                            size="small"
                            label={bandLabel(band)}
                            color={bandChipTone(band)}
                            variant={
                              band === 'UNASSESSED' ? 'outlined' : 'filled'
                            }
                            sx={{ fontWeight: 900, borderRadius: 2 }}
                          />
                        </Stack>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: assessments */}
        <Card variant="outlined" sx={cardSx}>
          <CardContent>
            {!selectedStep ? (
              <Alert severity="info">Select a step to start assessing.</Alert>
            ) : (
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  gap={2}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{ fontWeight: 950, fontSize: 20 }}
                      noWrap
                      title={selectedStep.title}
                    >
                      {`Step ${selectedStep.stepNo}: ${selectedStep.title || 'Untitled'}`}
                    </Typography>

                    {!!selectedStep.method && (
                      <Typography
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 650,
                          mt: 0.4,
                        }}
                      >
                        {selectedStep.method}
                      </Typography>
                    )}

                    {!!selectedStep.trainingLink && (
                      <Typography sx={{ mt: 0.6 }}>
                        <a
                          href={selectedStep.trainingLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Training link
                        </a>
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" gap={1}>
                    <Button
                      variant="outlined"
                      onClick={goPrevStep}
                      disabled={stepIndex() <= 0}
                      sx={{ borderRadius: 2 }}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={goNextStep}
                      disabled={stepIndex() >= steps.length - 1}
                      sx={{ borderRadius: 2 }}
                    >
                      Next
                    </Button>
                  </Stack>
                </Stack>

                <Divider />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography sx={{ fontWeight: 950 }}>
                    Hazard assessments
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={openPicker}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                  >
                    Add hazards
                  </Button>
                </Stack>

                {loadingAssessments ? (
                  <Stack alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress size={22} />
                  </Stack>
                ) : assessments.length === 0 ? (
                  <Alert severity="info">
                    No hazards on this step yet. Click <b>Add hazards</b>.
                  </Alert>
                ) : (
                  <Stack spacing={1.25}>
                    {assessments.map((a) => (
                      <AssessmentCard
                        key={a.id}
                        a={a}
                        hazard={hazardById.get(String(a.hazardId))}
                        categoryName={(() => {
                          const hz = hazardById.get(String(a.hazardId));
                          if (!hz) return undefined;
                          return catById.get(String(hz.categoryId))?.name;
                        })()}
                        actionCategories={actionCats}
                        onChanged={(next) => {
                          setAssessments((prev) =>
                            prev.map((x) => (x.id === a.id ? next : x)),
                          );
                        }}
                        onSave={async (patch) => {
                          const updated = await patchAssessment(a.id, patch);
                          setAssessments((prev) =>
                            prev.map((x) => (x.id === a.id ? updated : x)),
                          );
                          await refreshStepDash();
                        }}
                        onDelete={async () => {
                          await deleteAssessment(a.id);
                          setAssessments((prev) =>
                            prev.filter((x) => x.id !== a.id),
                          );
                          await refreshStepDash();
                        }}
                      />
                    ))}
                  </Stack>
                )}

                <Divider sx={{ mt: 1 }} />

                <Stack direction="row" justifyContent="flex-end" gap={1}>
                  <Button
                    variant="outlined"
                    onClick={() => nav(`/tasks/${taskIdStr}/assess`)}
                    sx={{ borderRadius: 2 }}
                  >
                    Exit
                  </Button>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={goNextStep}
                    disabled={stepIndex() >= steps.length - 1}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                  >
                    Next step
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Hazard Picker */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ fontWeight: 950 }}>
          Add hazards to this step
        </DialogTitle>

        <DialogContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            gap={1.2}
            sx={{ mt: 1, mb: 1 }}
          >
            <TextField
              label="Search"
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              fullWidth
            />
            <TextField
              label="Category"
              select
              value={pickerCat}
              onChange={(e) => setPickerCat(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">All</MenuItem>
              {hazCats
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
            </TextField>
            <Button
              variant="contained"
              onClick={refreshPicker}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Search
            </Button>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mt: 0.5 }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={pickerShowSelectedOnly}
                  onChange={(e) => setPickerShowSelectedOnly(e.target.checked)}
                />
              }
              label="Show selected only"
            />

            <Button
              variant="outlined"
              onClick={() => setSelectedHazardIds(new Set())}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              Clear selected
            </Button>
          </Stack>

          {pickerLoading ? (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={22} />
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: 480, overflow: 'auto', mt: 1 }}>
              {hazCats
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((cat) => {
                  const list = hazardsByCategory.get(String(cat.id)) ?? [];
                  if (list.length === 0) return null;

                  const selectedInCat = list.filter((h) =>
                    selectedHazardIds.has(String(h.id)),
                  ).length;

                  return (
                    <Box
                      key={String(cat.id)}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2.5,
                        p: 1.2,
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 0.8 }}
                        gap={1}
                      >
                        <Stack
                          direction="row"
                          gap={1}
                          alignItems="center"
                          sx={{ minWidth: 0 }}
                        >
                          <Typography
                            sx={{ fontWeight: 950 }}
                            noWrap
                            title={cat.name}
                          >
                            {cat.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${selectedInCat}/${list.length}`}
                            sx={{ fontWeight: 900, borderRadius: 2 }}
                          />
                        </Stack>

                        <Stack direction="row" gap={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => toggleCategory(String(cat.id), true)}
                            sx={{ borderRadius: 2, fontWeight: 900 }}
                          >
                            Select all
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              toggleCategory(String(cat.id), false)
                            }
                            sx={{ borderRadius: 2, fontWeight: 900 }}
                          >
                            Clear
                          </Button>
                        </Stack>
                      </Stack>

                      <Stack spacing={0.6}>
                        {list.map((h) => {
                          const id = String(h.id);
                          const checked = selectedHazardIds.has(id);

                          return (
                            <Box
                              key={id}
                              sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                px: 1,
                                py: 0.6,
                              }}
                            >
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={checked}
                                    onChange={(e) =>
                                      setHazardChecked(id, e.target.checked)
                                    }
                                  />
                                }
                                label={
                                  <Stack>
                                    <Typography sx={{ fontWeight: 850 }}>
                                      {h.code ? `${h.code} — ` : ''}
                                      {h.name}
                                    </Typography>
                                    {!!h.description && (
                                      <Typography
                                        sx={{ color: 'text.secondary' }}
                                      >
                                        {h.description}
                                      </Typography>
                                    )}
                                  </Stack>
                                }
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  );
                })}

              {filteredPicker.length === 0 && (
                <Alert severity="info">No hazards found.</Alert>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setPickerOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={addSelectedHazards}
            variant="contained"
            sx={{ borderRadius: 2, fontWeight: 900 }}
            disabled={pickerLoading || selectedHazardIds.size === 0}
          >
            Add selected ({selectedHazardIds.size})
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ============================ Cards ============================ */

function AssessmentCard({
  a,
  hazard,
  categoryName,
  actionCategories,
  onChanged,
  onSave,
  onDelete,
}: {
  a: Assessment;
  hazard?: Hazard;
  categoryName?: string;
  actionCategories: ActionCategory[];
  onChanged: (next: Assessment) => void;
  onSave: (patch: Partial<Assessment>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [rowErr, setRowErr] = useState<string | null>(null);

  // controls
  const [controlsLoading, setControlsLoading] = useState(false);
  const [existingControls, setExistingControls] = useState<Control[]>([]);
  const [additionalControls, setAdditionalControls] = useState<Control[]>([]);

  // quick add controls
  const [newExType, setNewExType] = useState<ControlType>('ADMIN');
  const [newExDesc, setNewExDesc] = useState('');
  const [newAddType, setNewAddType] = useState<ControlType>('ADMIN');
  const [newAddDesc, setNewAddDesc] = useState('');
  const [newAddCategoryId, setNewAddCategoryId] = useState<string>('');
  const [newAddOwner, setNewAddOwner] = useState('');
  const [newAddDue, setNewAddDue] = useState('');

  // ✅ normalize nullable values before calling helpers
  const exSev = n(a.existingSeverity);
  const exProb = n(a.existingProbability);
  const newSev = n(a.newSeverity);
  const newProb = n(a.newProbability);

  const existingBand = unileverBand(exSev, exProb);
  const afterBand = unileverBand(newSev, newProb);

  const existingRating = unileverRating(exSev, exProb);
  const afterRating = unileverRating(newSev, newProb);

  async function ensureControlsLoaded() {
    if (controlsLoading) return;
    if (existingControls.length || additionalControls.length) return;

    setControlsLoading(true);
    try {
      const [ex, add] = await Promise.all([
        listControls(a.id, { phase: 'EXISTING' }),
        listControls(a.id, { phase: 'ADDITIONAL' }),
      ]);
      setExistingControls(ex ?? []);
      setAdditionalControls(add ?? []);
    } catch (e: any) {
      setRowErr(e?.message ?? 'Failed to load controls');
    } finally {
      setControlsLoading(false);
    }
  }

  async function saveAssessment() {
    setSaving(true);
    setRowErr(null);
    try {
      await onSave({
        unsafeConditions: cleanText(a.unsafeConditions),
        unsafeActs: cleanText(a.unsafeActs),
        potentialHarm: cleanText(a.potentialHarm),

        existingSeverity: n(a.existingSeverity),
        existingProbability: n(a.existingProbability),
        newSeverity: n(a.newSeverity),
        newProbability: n(a.newProbability),

        notes: cleanText(a.notes),
        status: a.status ?? undefined,
      });
    } catch (e: any) {
      setRowErr(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addExistingControl() {
    const desc = cleanText(newExDesc);
    if (!desc) return;
    setRowErr(null);

    try {
      const c = await createControl(a.id, {
        phase: 'EXISTING',
        type: newExType,
        description: desc,
        isVerified: false,
      });
      setExistingControls((prev) => [c, ...prev]);
      setNewExDesc('');
    } catch (e: any) {
      setRowErr(e?.message ?? 'Failed to add control');
    }
  }

  async function addAdditionalControl() {
    const desc = cleanText(newAddDesc);
    if (!desc) return;

    if (!newAddCategoryId) {
      setRowErr('Pick an Action Category for Additional controls.');
      return;
    }

    setRowErr(null);

    try {
      const c = await createControl(a.id, {
        phase: 'ADDITIONAL',
        type: newAddType,
        description: desc,
        categoryId: newAddCategoryId,
        owner: cleanText(newAddOwner) || undefined,
        dueDate: newAddDue ? new Date(newAddDue).toISOString() : undefined,
        isVerified: false,
      });
      setAdditionalControls((prev) => [c, ...prev]);
      setNewAddDesc('');
      setNewAddOwner('');
      setNewAddDue('');
      setNewAddCategoryId('');
    } catch (e: any) {
      setRowErr(e?.message ?? 'Failed to add control');
    }
  }

  async function saveControl(id: string, patch: Partial<Control>) {
    setRowErr(null);
    try {
      const updated = await patchControl(id, patch);
      setExistingControls((prev) =>
        prev.map((x) => (x.id === id ? updated : x)),
      );
      setAdditionalControls((prev) =>
        prev.map((x) => (x.id === id ? updated : x)),
      );
    } catch (e: any) {
      setRowErr(e?.message ?? 'Failed to save control');
    }
  }

  async function removeControl(id: string) {
    setRowErr(null);
    try {
      await deleteControl(id);
      setExistingControls((prev) => prev.filter((x) => x.id !== id));
      setAdditionalControls((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setRowErr(e?.message ?? 'Failed to delete control');
    }
  }

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 2.5, boxShadow: 'none', borderColor: 'divider' }}
    >
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          gap={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Typography sx={{ fontWeight: 950 }}>
                {hazard?.code ? `${hazard.code} — ` : ''}
                {hazard?.name ?? `Hazard ${a.hazardId}`}
              </Typography>

              {!!categoryName && (
                <Chip
                  size="small"
                  label={categoryName}
                  sx={{ fontWeight: 800 }}
                />
              )}

              {existingBand && (
                <Chip
                  size="small"
                  label={`Existing: ${existingBand}${existingRating != null ? ` (${existingRating})` : ''}`}
                  color={bandChipColor(existingBand)}
                  sx={{ fontWeight: 900 }}
                />
              )}

              {afterBand && (
                <Chip
                  size="small"
                  label={`After controls: ${afterBand}${afterRating != null ? ` (${afterRating})` : ''}`}
                  color={bandChipColor(afterBand)}
                  sx={{ fontWeight: 900 }}
                />
              )}
            </Stack>

            {!!rowErr && (
              <Typography
                sx={{ color: 'error.main', fontWeight: 700, mt: 0.6 }}
              >
                {rowErr}
              </Typography>
            )}
          </Box>

          <Stack direction="row" gap={1} alignItems="center">
            <Button
              variant="contained"
              onClick={saveAssessment}
              disabled={saving}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <IconButton
              onClick={onDelete}
              disabled={saving}
              title="Remove hazard assessment"
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Stack>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            if (v === 2) ensureControlsLoaded();
          }}
          sx={{ mt: 1 }}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab label="Hazard" />
          <Tab label="Risk" />
          <Tab label="Controls" />
          <Tab label="Notes" />
        </Tabs>

        <Divider sx={{ my: 1.25 }} />

        {tab === 0 && (
          <Stack spacing={1.2}>
            <TextField
              label="Unsafe conditions"
              value={a.unsafeConditions ?? ''}
              onChange={(e) =>
                onChanged({ ...a, unsafeConditions: e.target.value })
              }
              multiline
              minRows={2}
            />
            <TextField
              label="Unsafe acts"
              value={a.unsafeActs ?? ''}
              onChange={(e) => onChanged({ ...a, unsafeActs: e.target.value })}
              multiline
              minRows={2}
            />
            <TextField
              label="Potential harm / consequence"
              value={a.potentialHarm ?? ''}
              onChange={(e) =>
                onChanged({ ...a, potentialHarm: e.target.value })
              }
              multiline
              minRows={2}
            />
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={1.2}>
            <Typography sx={{ fontWeight: 950 }}>Existing risk</Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 1.2,
              }}
            >
              <TextField
                label="Severity"
                select
                value={a.existingSeverity ?? ''}
                onChange={(e) =>
                  onChanged({
                    ...a,
                    existingSeverity:
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              >
                <MenuItem value="">—</MenuItem>
                {UNILEVER_SEVERITIES.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Probability"
                select
                value={a.existingProbability ?? ''}
                onChange={(e) =>
                  onChanged({
                    ...a,
                    existingProbability:
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              >
                <MenuItem value="">—</MenuItem>
                {UNILEVER_PROBABILITIES.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Typography sx={{ fontWeight: 950, mt: 1 }}>
              After controls risk
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 1.2,
              }}
            >
              <TextField
                label="Severity"
                select
                value={a.newSeverity ?? ''}
                onChange={(e) =>
                  onChanged({
                    ...a,
                    newSeverity:
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              >
                <MenuItem value="">—</MenuItem>
                {UNILEVER_SEVERITIES.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Probability"
                select
                value={a.newProbability ?? ''}
                onChange={(e) =>
                  onChanged({
                    ...a,
                    newProbability:
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              >
                <MenuItem value="">—</MenuItem>
                {UNILEVER_PROBABILITIES.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={1.4}>
            {controlsLoading ? (
              <Stack alignItems="center" sx={{ py: 2 }}>
                <CircularProgress size={20} />
              </Stack>
            ) : (
              <>
                {/* Existing */}
                <Box>
                  <Typography sx={{ fontWeight: 950, mb: 0.8 }}>
                    Existing controls
                  </Typography>

                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    gap={1}
                    sx={{ mb: 1 }}
                  >
                    <TextField
                      label="Type"
                      select
                      value={newExType}
                      onChange={(e) =>
                        setNewExType(e.target.value as ControlType)
                      }
                      sx={{ minWidth: 220 }}
                    >
                      <MenuItem value="ENGINEERING">Engineering</MenuItem>
                      <MenuItem value="ADMIN">Administrative</MenuItem>
                      <MenuItem value="PPE">PPE</MenuItem>
                      <MenuItem value="OTHER">Other</MenuItem>
                    </TextField>

                    <TextField
                      label="Description"
                      value={newExDesc}
                      onChange={(e) => setNewExDesc(e.target.value)}
                      fullWidth
                    />

                    <Button
                      variant="outlined"
                      onClick={addExistingControl}
                      startIcon={<AddIcon />}
                      sx={{ borderRadius: 2, fontWeight: 900 }}
                      disabled={!cleanText(newExDesc)}
                    >
                      Add
                    </Button>
                  </Stack>

                  <Stack spacing={0.8}>
                    {existingControls.map((c) => (
                      <ControlRow
                        key={c.id}
                        c={c}
                        actionCategories={actionCategories}
                        onSave={saveControl}
                        onDelete={removeControl}
                      />
                    ))}
                    {existingControls.length === 0 && (
                      <Alert severity="info">
                        No existing controls added yet.
                      </Alert>
                    )}
                  </Stack>
                </Box>

                <Divider />

                {/* Additional */}
                <Box>
                  <Typography sx={{ fontWeight: 950, mb: 0.8 }}>
                    Additional controls / actions
                  </Typography>

                  <Stack spacing={1} sx={{ mb: 1 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
                      <TextField
                        label="Type"
                        select
                        value={newAddType}
                        onChange={(e) =>
                          setNewAddType(e.target.value as ControlType)
                        }
                        sx={{ minWidth: 220 }}
                      >
                        <MenuItem value="ENGINEERING">Engineering</MenuItem>
                        <MenuItem value="ADMIN">Administrative</MenuItem>
                        <MenuItem value="PPE">PPE</MenuItem>
                        <MenuItem value="OTHER">Other</MenuItem>
                      </TextField>

                      <TextField
                        label="Action category"
                        select
                        value={newAddCategoryId}
                        onChange={(e) => setNewAddCategoryId(e.target.value)}
                        sx={{ minWidth: 260 }}
                      >
                        <MenuItem value="">Select…</MenuItem>
                        {actionCategories
                          .slice()
                          .sort(
                            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
                          )
                          .filter((x) => x.isActive !== false)
                          .map((ac) => (
                            <MenuItem key={ac.id} value={String(ac.id)}>
                              {ac.name}
                            </MenuItem>
                          ))}
                      </TextField>

                      <TextField
                        label="Owner (optional)"
                        value={newAddOwner}
                        onChange={(e) => setNewAddOwner(e.target.value)}
                        sx={{ minWidth: 220 }}
                      />

                      <TextField
                        label="Due date (optional)"
                        type="date"
                        value={newAddDue}
                        onChange={(e) => setNewAddDue(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 190 }}
                      />
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
                      <TextField
                        label="Description"
                        value={newAddDesc}
                        onChange={(e) => setNewAddDesc(e.target.value)}
                        fullWidth
                      />
                      <Button
                        variant="outlined"
                        onClick={addAdditionalControl}
                        startIcon={<AddIcon />}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                        disabled={!cleanText(newAddDesc) || !newAddCategoryId}
                      >
                        Add
                      </Button>
                    </Stack>
                  </Stack>

                  <Stack spacing={0.8}>
                    {additionalControls.map((c) => (
                      <ControlRow
                        key={c.id}
                        c={c}
                        actionCategories={actionCategories}
                        onSave={saveControl}
                        onDelete={removeControl}
                      />
                    ))}
                    {additionalControls.length === 0 && (
                      <Alert severity="info">
                        No additional actions added yet.
                      </Alert>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}

        {tab === 3 && (
          <TextField
            label="Notes"
            value={a.notes ?? ''}
            onChange={(e) => onChanged({ ...a, notes: e.target.value })}
            multiline
            minRows={3}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ControlRow({
  c,
  actionCategories,
  onSave,
  onDelete,
}: {
  c: Control;
  actionCategories: ActionCategory[];
  onSave: (id: string, patch: Partial<Control>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [local, setLocal] = useState<Control>(c);
  const [saving, setSaving] = useState(false);

  useEffect(() => setLocal(c), [c]);

  async function save() {
    setSaving(true);
    try {
      await onSave(c.id, {
        type: local.type,
        description: cleanText(local.description),
        categoryId:
          local.phase === 'ADDITIONAL' ? (local.categoryId ?? null) : undefined,
        owner: local.owner ?? null,
        dueDate: local.dueDate ?? null,
        isVerified: !!local.isVerified,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2.25,
        p: 1,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        gap={1}
        alignItems="center"
      >
        <TextField
          label="Type"
          select
          value={local.type}
          onChange={(e) =>
            setLocal((p) => ({ ...p, type: e.target.value as ControlType }))
          }
          sx={{ minWidth: 220 }}
          size="small"
        >
          <MenuItem value="ENGINEERING">Engineering</MenuItem>
          <MenuItem value="ADMIN">Administrative</MenuItem>
          <MenuItem value="PPE">PPE</MenuItem>
          <MenuItem value="OTHER">Other</MenuItem>
        </TextField>

        {local.phase === 'ADDITIONAL' && (
          <TextField
            label="Action category"
            select
            value={local.categoryId ?? ''}
            onChange={(e) =>
              setLocal((p) => ({ ...p, categoryId: e.target.value || null }))
            }
            sx={{ minWidth: 260 }}
            size="small"
          >
            <MenuItem value="">Select…</MenuItem>
            {actionCategories
              .slice()
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .filter((x) => x.isActive !== false)
              .map((ac) => (
                <MenuItem key={ac.id} value={String(ac.id)}>
                  {ac.name}
                </MenuItem>
              ))}
          </TextField>
        )}

        <TextField
          label="Description"
          value={local.description ?? ''}
          onChange={(e) =>
            setLocal((p) => ({ ...p, description: e.target.value }))
          }
          fullWidth
          size="small"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={!!local.isVerified}
              onChange={(e) =>
                setLocal((p) => ({ ...p, isVerified: e.target.checked }))
              }
            />
          }
          label="Verified"
        />

        <IconButton
          onClick={() => onDelete(c.id)}
          disabled={saving}
          title="Delete"
        >
          <DeleteOutlineIcon />
        </IconButton>

        <Button
          variant="outlined"
          onClick={save}
          disabled={saving || !cleanText(local.description)}
          sx={{ borderRadius: 2, fontWeight: 900 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={1} sx={{ mt: 1 }}>
        <TextField
          label="Owner"
          value={local.owner ?? ''}
          onChange={(e) => setLocal((p) => ({ ...p, owner: e.target.value }))}
          size="small"
          sx={{ minWidth: 240 }}
        />
        <TextField
          label="Due date"
          type="date"
          value={fmtDateInput(local.dueDate)}
          onChange={(e) =>
            setLocal((p) => ({
              ...p,
              dueDate: e.target.value
                ? new Date(e.target.value).toISOString()
                : null,
            }))
          }
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ minWidth: 200 }}
        />
      </Stack>
    </Box>
  );
}
