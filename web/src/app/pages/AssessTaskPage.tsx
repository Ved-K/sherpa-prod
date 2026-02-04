/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
// src/app/pages/AssessTaskPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ChipProps } from '@mui/material/Chip';
import type { StepIconProps } from '@mui/material/StepIcon';

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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Step as MuiStep,
  StepButton,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { MenuProps } from '@mui/material/Menu';
import type { SelectProps } from '@mui/material/Select';
import { alpha } from '@mui/material/styles';

import {
  listStepsForTask,
  updateStep,
  deleteStep,
  type Step as StepModel,
} from '../api/steps';

import {
  listHazardCategories,
  listHazards,
  type Hazard,
  type HazardCategory,
} from '../api/hazards';
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
import {
  getStepsDashboard,
  type StepDashboardItem,
  type StepDashboardResponse,
} from '../api/dashboard';

import {
  UNILEVER_PROBABILITIES,
  UNILEVER_SEVERITIES,
  bandChipColor,
  unileverBand,
  unileverRating,
  type RiskBand,
} from '../utils/UnileverRiskMatrix1';
import { brand } from '../theme';

/* ------------------------------ Types ------------------------------ */

type RiskBandKey =
  | 'VERY_LOW'
  | 'LOW'
  | 'MEDIUM'
  | 'MEDIUM_PLUS'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'UNASSESSED';

type ChipColor = NonNullable<ChipProps['color']>;

type DraftControl = {
  clientId: string;
  phase: 'EXISTING' | 'ADDITIONAL';
  type: ControlType;
  description: string;
  categoryId?: string; // additional only
};

type ControlsCache = {
  existing: Control[];
  additional: Control[];
  draft: DraftControl[];
};

/* ------------------------------ Utils ------------------------------ */

type StepSummary = {
  totalHazards: number;

  // these already existed (keep them)
  existingDone: boolean;
  predictedDone: boolean;
  existingBand: RiskBandKey;

  // NEW: “all fields complete” signals
  detailsDone: boolean;
  existingControlsDone: boolean;
  additionalControlsDone: boolean;
  complete: boolean;
};

function bandKeyFromBand(b?: RiskBand | null): RiskBandKey {
  return (b as unknown as RiskBandKey) ?? 'UNASSESSED';
}

function summaryFromAssessments(list: Assessment[]): StepSummary {
  const totalHazards = list.length;

  const existingFilled = list.filter(existingRiskComplete);
  const predictedFilled = list.filter(predictedRiskComplete);

  const existingDone =
    totalHazards > 0 && existingFilled.length === totalHazards;
  const predictedDone =
    totalHazards > 0 && predictedFilled.length === totalHazards;

  // ✅ require ALL detail fields (not OR)
  const a0 = list[0] ?? null;
  const detailsDone =
    totalHazards > 0 &&
    Boolean(
      cleanText(a0?.unsafeConditions) &&
        cleanText(a0?.unsafeActs) &&
        cleanText(a0?.potentialHarm),
    );

  let existingBand: RiskBandKey = 'UNASSESSED';

  // worst band from filled existing risks
  if (existingFilled.length > 0) {
    const rank: Record<RiskBandKey, number> = {
      UNASSESSED: 0,
      VERY_LOW: 1,
      LOW: 2,
      MEDIUM: 3,
      MEDIUM_PLUS: 4,
      HIGH: 5,
      VERY_HIGH: 6,
    };

    let best = 0;

    for (const a of existingFilled) {
      const b = unileverBand(n(a.existingSeverity), n(a.existingProbability));
      const key = bandKeyFromBand(b);
      const r = rank[key] ?? 0;
      if (r > best) {
        best = r;
        existingBand = key;
      }
    }
  }

  // controls are filled later (selected step from cache/drafts; other steps from background scan)
  return {
    totalHazards,
    existingDone,
    predictedDone,
    existingBand,

    detailsDone,
    existingControlsDone: false,
    additionalControlsDone: false,
    complete: false,
  };
}

function n(v?: number | null): number | undefined {
  return v == null ? undefined : v;
}

function cleanText(s?: string | null): string | undefined {
  const t = String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return t.length ? t : undefined;
}

function bandAbbrev(b: RiskBandKey) {
  switch (b) {
    case 'VERY_HIGH':
      return 'VH';
    case 'HIGH':
      return 'H';
    case 'MEDIUM_PLUS':
      return 'M+';
    case 'MEDIUM':
      return 'M';
    case 'LOW':
      return 'L';
    case 'VERY_LOW':
      return 'VL';
    default:
      return '—';
  }
}

function bandLabel(b: RiskBandKey) {
  switch (b) {
    case 'VERY_HIGH':
      return 'Very high';
    case 'HIGH':
      return 'High';
    case 'MEDIUM_PLUS':
      return 'Medium+';
    case 'MEDIUM':
      return 'Medium';
    case 'LOW':
      return 'Low';
    case 'VERY_LOW':
      return 'Very low';
    default:
      return '—';
  }
}

function shortRiskBand(b?: RiskBand | null) {
  if (!b) return '—';
  return bandAbbrev(b as unknown as RiskBandKey);
}

function bandTone(b: RiskBandKey): ChipColor {
  if (b === 'VERY_HIGH') return 'error';
  if (b === 'HIGH') return 'warning';
  if (b === 'MEDIUM_PLUS') return 'info';
  if (b === 'MEDIUM') return 'warning';
  if (b === 'LOW' || b === 'VERY_LOW') return 'success';
  return 'default';
}

type StepStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PREDICTION_PENDING'
  | 'ADDITIONAL_CONTROLS_PENDING'
  | 'PREDICTED_RISK_PENDING'
  | 'COMPLETE';

function statusLabel(s: StepStatus) {
  if (s === 'COMPLETE') return 'Complete';
  if (s === 'ADDITIONAL_CONTROLS_PENDING') return 'Additional controls pending';
  if (s === 'PREDICTED_RISK_PENDING') return 'Predicted risk pending';
  if (s === 'IN_PROGRESS') return 'In progress';
  return 'Not started';
}

function statusTone(s: StepStatus): ChipColor {
  if (s === 'COMPLETE') return 'primary';
  if (s === 'ADDITIONAL_CONTROLS_PENDING') return 'secondary';
  if (s === 'PREDICTED_RISK_PENDING') return 'secondary';
  if (s === 'IN_PROGRESS') return 'info';
  return 'default';
}

function existingRiskComplete(a?: Assessment | null) {
  return Boolean(
    a && a.existingSeverity != null && a.existingProbability != null,
  );
}

function predictedRiskComplete(a?: Assessment | null) {
  return Boolean(a && a.newSeverity != null && a.newProbability != null);
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const BAND_ACCENT: Record<Exclude<RiskBandKey, 'UNASSESSED'>, string> = {
  VERY_LOW: '#2E7D32',
  LOW: '#388E3C',
  MEDIUM: '#F9A825',
  MEDIUM_PLUS: '#FB8C00',
  HIGH: '#E53935',
  VERY_HIGH: '#B71C1C',
};

function bandAccent(bandKey: RiskBandKey) {
  return bandKey !== 'UNASSESSED' ? BAND_ACCENT[bandKey] : '#9E9E9E';
}

const SCORE_ACCENT: Record<number, string> = {
  1: '#2E7D32',
  2: '#388E3C',
  4: '#F9A825',
  6: '#FB8C00',
  8: '#E53935',
  10: '#B71C1C',
};

function scoreAccent(n: number) {
  return SCORE_ACCENT[n] ?? '#607D8B';
}

const SEVERITY_DESC: Record<number, string> = {
  1: 'Delay only',
  2: 'Minor injury (FAC), minor damage',
  4: 'Lost time injury, illness, damage & multiple minor injuries',
  6: 'Major injury, disabling illness, major damage & multiple recordable injuries',
  8: 'Single death',
  10: 'Multiple deaths',
};

const PROB_DESC: Record<number, string> = {
  10: 'Certain or imminent',
  8: 'Very likely',
  6: 'Likely',
  4: 'May happen',
  2: 'Unlikely',
  1: 'Very unlikely',
};

const PROB_GUIDE: Record<
  number,
  {
    exposure: string;
    existingControl: string;
    siteExperience: string;
    unileverExperience: string;
  }
> = {
  10: {
    exposure: 'Constant',
    existingControl: 'No existing control in place',
    siteExperience: '2–3 times in last 1 year',
    unileverExperience: '—',
  },
  8: {
    exposure: 'Hourly',
    existingControl: 'One admin control – not monitored / not well implemented',
    siteExperience: '1 time in last 1 year',
    unileverExperience: '—',
  },
  6: {
    exposure: 'Daily',
    existingControl: 'One admin control – well monitored / implemented',
    siteExperience: '1 time in past 3 years',
    unileverExperience: '—',
  },
  4: {
    exposure: 'Weekly',
    existingControl:
      'Two admin controls – well monitored/implemented AND/OR one engineering control – well maintained',
    siteExperience: 'None',
    unileverExperience: '2–3 times in last 1 year',
  },
  2: {
    exposure: 'Monthly',
    existingControl:
      'Two independent engineering controls – at least one well maintained',
    siteExperience: 'None',
    unileverExperience: '1 time in last 1 year',
  },
  1: {
    exposure: 'Yearly (or more)',
    existingControl:
      'Two independent engineering controls – both well maintained',
    siteExperience: 'None',
    unileverExperience: '1 time in past 3 years',
  },
};

const RISK_BAND_GUIDANCE: Record<
  Exclude<RiskBandKey, 'UNASSESSED'>,
  { title: string; body: string[] }
> = {
  VERY_LOW: {
    title: 'Very Low',
    body: [
      'These risks are considered acceptable.',
      'No further action is necessary other than to ensure that the controls are maintained.',
    ],
  },
  LOW: {
    title: 'Low',
    body: [
      'No additional controls are required unless they can be implemented at very low cost (in terms of time, money, and effort) or if required by legislation or Unilever standard.',
      'Actions to further reduce these risks are assigned low priority.',
      'Arrangements should be made to ensure that the controls are maintained.',
    ],
  },
  MEDIUM: {
    title: 'Medium',
    body: [
      'Consideration should be as to whether the risks can be lowered, where applicable, to a tolerable level and preferably to an acceptable level, but the costs of additional risk reduction measures should be considered or if required by legislation or Unilever standard.',
      'The risk reduction measures should be implemented within a defined time-period.',
      'Arrangements should be made to ensure that controls are maintained, particularly if the risk levels are associated with harmful consequences.',
    ],
  },
  MEDIUM_PLUS: {
    title: 'Medium+',
    body: [
      'Consideration should be as to whether the risks can be lowered, where applicable, to a tolerable level and preferably to an acceptable level, but the costs of additional risk reduction measures should be considered or if required by legislation or Unilever standard.',
      'The risk reduction measures should be implemented within a defined time-period.',
      'Arrangements should be made to ensure that controls are maintained, particularly if the risk levels are associated with harmful consequences.',
    ],
  },
  HIGH: {
    title: 'High',
    body: [
      'Substantial efforts should be made to reduce the risk.',
      'Risk reduction measures should be implemented urgently within a defined time period, and it might be necessary to consider suspending or restricting the activity, or to apply interim risk control measures, until this has been completed.',
      'Considerable resources might have to be allocated to additional control measures.',
      'Arrangements should be made to ensure that controls are maintained, particularly if the risk levels are associated with extremely harmful consequences and very harmful consequences.',
    ],
  },
  VERY_HIGH: {
    title: 'Very High',
    body: [
      'These risks are unacceptable. Substantial improvements in risk control measures are necessary so that the risk is reduced to a tolerable or acceptable level.',
      'The work activity should be halted until risk controls are implemented that reduces the risk so that it is no longer very high.',
      'If it is not possible to reduce the risk, the work should remain prohibited.',
    ],
  },
};

const RADIUS = 14;

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

/* ========= Curated suggestions (type-filtered) ========= */

const EXISTING_SUGGESTIONS: Record<'ENGINEERING' | 'ADMIN', string[]> = {
  ENGINEERING: [
    'Fixed guarding/interlocked access doors fitted and functional.',
    'Emergency stops present, accessible, and tested (pre-start).',
    'Isolation points labelled and accessible (electrical/pneumatic/hydraulic).',
    'LOTO available and used: isolation verified and personal locks applied.',
    'Safe speed / jog mode enabled for cleaning/maintenance tasks.',
    'Light curtain / interlock functioning as intended (where fitted).',
  ],
  ADMIN: [
    'SOP/SSOW available and communicated to operators.',
    'Pre-start checks completed and recorded.',
    'Permit-to-work used where required (maintenance / hot works / confined space).',
    'Housekeeping standard maintained (dry floors, no trip hazards, clear walkways).',
    'PPE requirements defined and enforced (e.g., gloves, eye protection, hearing).',
    'Toolbox talk / pre-task brief completed.',
  ],
};

const ADDITIONAL_SUGGESTIONS: Record<
  'ENGINEERING' | 'ADMIN',
  { text: string; categoryId: string }[]
> = {
  ENGINEERING: [
    {
      categoryId: 'Engineering change',
      text: 'Add/upgrade guarding to prevent access to moving parts.',
    },
    {
      categoryId: 'Engineering change',
      text: 'Install interlock/light curtain to stop equipment when access is opened.',
    },
    {
      categoryId: 'LOTO',
      text: 'Update isolation points/signage and verify LOTO steps at isolators.',
    },
    {
      categoryId: 'Maintenance',
      text: 'Repair/replace faulty interlocks/sensors and add PM check.',
    },
  ],
  ADMIN: [
    {
      categoryId: 'Training',
      text: 'Provide refresher training and record competency sign-off.',
    },
    {
      categoryId: 'Procedure',
      text: 'Update SOP/SSOW to include this hazard and required controls.',
    },
    {
      categoryId: 'Supervision',
      text: 'Increase supervision/spot checks for this task until stable.',
    },
    {
      categoryId: 'Signage',
      text: 'Add clear warning signage at point of hazard and isolation points.',
    },
  ],
};

const BAND_RANK: Record<RiskBandKey, number> = {
  UNASSESSED: 0,
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  MEDIUM_PLUS: 4,
  HIGH: 5,
  VERY_HIGH: 6,
};

// ✅ shared select menu styling (module scope so RiskStage can use it too)
const selectMenuProps: Partial<MenuProps> = {
  PaperProps: {
    sx: {
      mt: 0.8,
      borderRadius: 2,
      overflow: 'hidden',
      border: `1px solid ${alpha('#000', 0.08)}`,
      boxShadow: '0 18px 45px rgba(0,0,0,0.18)',
    },
  },
  MenuListProps: {
    dense: true,
    sx: {
      py: 0.6,
      '& .MuiMenuItem-root': {
        py: 1,
        gap: 1.2,
      },
    },
  },
};

function renderScoreValue(
  value: unknown,
  desc: Record<number, string>,
  placeholder = '—',
) {
  if (value === '' || value == null) {
    return (
      <Typography sx={{ color: 'text.disabled', fontWeight: 800 }}>
        {placeholder}
      </Typography>
    );
  }

  const n =
    typeof value === 'number'
      ? value
      : Number.isFinite(Number(value))
        ? Number(value)
        : NaN;

  const label = Number.isFinite(n) ? (desc[n] ?? String(value)) : String(value);

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      {Number.isFinite(n) && (
        <Chip
          size="small"
          label={n}
          sx={{
            height: 22,
            fontWeight: 950,
            borderRadius: 999,
            bgcolor: alpha('#000', 0.06),
          }}
        />
      )}

      <Typography
        sx={{
          fontWeight: 900,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

/* ============================== Page =============================== */

export default function AssessTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const nav = useNavigate();
  const theme = useTheme();

  const taskIdStr = String(taskId ?? '').trim();
  const [err, setErr] = useState<string | null>(null);

  const [stepSummaries, setStepSummaries] = useState<
    Record<string, StepSummary>
  >({});

  const [assessmentsOwnerStepId, setAssessmentsOwnerStepId] = useState('');

  // steps + dashboard
  const [steps, setSteps] = useState<StepModel[]>([]);
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

  // step edit/delete
  const [editStepOpen, setEditStepOpen] = useState(false);
  const [editStepTitle, setEditStepTitle] = useState('');
  const [editStepTrainingLink, setEditStepTrainingLink] = useState('');
  const [editStepSaving, setEditStepSaving] = useState(false);

  const [deleteStepOpen, setDeleteStepOpen] = useState(false);
  const [deleteStepLoading, setDeleteStepLoading] = useState(false);

  // hazards library for picker
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

  // assessments for selected step (these represent the selected hazards)
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  const selectedStepIdRef = useRef<string>('');

  useEffect(() => {
    selectedStepIdRef.current = String(selectedStepId);
  }, [selectedStepId]);

  useEffect(() => {
    return () => {
      if (autoRiskSaveTimerRef.current) {
        window.clearTimeout(autoRiskSaveTimerRef.current);
        autoRiskSaveTimerRef.current = null;
      }
    };
  }, []);

  // stage is PER STEP (not per hazard)
  const STAGES = [
    'Hazards',
    'Hazard details',
    'Existing controls',
    'Current risk',
    'Additional controls',
    'Predicted risk',
  ] as const;

  type StageIndex = number;

  type StepSession = {
    stage: StageIndex;
    controlAnchorId: string | null;
    assessments: Assessment[];
  };

  const DEFAULT_STEP_SESSION: StepSession = {
    stage: 0,
    controlAnchorId: null,
    assessments: [],
  };

  const controlsPrefetchRef = useRef<Record<string, boolean>>({});

  async function prefetchControlsForAnchor(anchorId: string) {
    const key = String(anchorId || '');
    if (!key) return;

    // already loaded into cache?
    const cur = controlsCacheRef.current[key];
    if (cur && Array.isArray(cur.existing) && Array.isArray(cur.additional))
      return;

    // already in-flight?
    if (controlsPrefetchRef.current[key]) return;
    controlsPrefetchRef.current[key] = true;

    try {
      const [ex, add] = await Promise.all([
        listControls(key, { phase: 'EXISTING' }),
        listControls(key, { phase: 'ADDITIONAL' }),
      ]);

      const next: ControlsCache = {
        existing: ex ?? [],
        additional: add ?? [],
        draft: controlsCacheRef.current[key]?.draft ?? [],
      };

      controlsCacheRef.current[key] = next;

      // if we're currently viewing this anchor, keep UI lists consistent if needed
      if (String(controlAnchorId) === key) {
        if (stage === 2) setExistingControls(next.existing);
        if (stage === 4) setAdditionalControls(next.additional);
        setDraftControls(next.draft);
      }

      bumpRenderTick((x) => x + 1);
    } catch {
      // non-blocking (we just won't show it as completed until loaded elsewhere)
    } finally {
      delete controlsPrefetchRef.current[key];
    }
  }

  function clampStage(n: number): StageIndex {
    return Math.max(0, Math.min(STAGES.length - 1, n));
  }

  const [stage, setStage] = useState<StageIndex>(0);
  const [controlAnchorId, setControlAnchorId] = useState<string | null>(null);

  const stepAssessment = useMemo(() => {
    if (assessments.length === 0) return null;

    if (controlAnchorId) {
      const hit =
        assessments.find((x) => String(x.id) === String(controlAnchorId)) ??
        null;
      if (hit) return hit;
    }

    return assessments[0] ?? null;
  }, [assessments, controlAnchorId]);

  // session memory per step
  const stepSessionsRef = useRef<Record<string, StepSession>>({});
  const [renderTick, bumpRenderTick] = useState(0); // only bump on step switch / big changes

  function StepRiskIcon({
    active,
    className,
    band,
  }: StepIconProps & { band: RiskBandKey }) {
    const palette: any = theme.palette;
    const rank = BAND_RANK[band] ?? 0;
    const base = palette.primary.main;

    const toneColor =
      band === 'UNASSESSED'
        ? alpha(palette.text.primary, 0.55)
        : alpha(base, 0.85);

    const bg =
      band === 'UNASSESSED'
        ? alpha(palette.grey[900], 0.04)
        : alpha(base, 0.06 + rank * 0.03);

    const bd =
      band === 'UNASSESSED'
        ? alpha(palette.grey[700], 0.22)
        : alpha(base, 0.18 + rank * 0.07);

    return (
      <Box
        className={className}
        sx={{
          width: 34,
          height: 34,
          borderRadius: '999px',
          display: 'grid',
          placeItems: 'center',
          bgcolor: bg,
          border: `2px solid ${active ? bd : alpha(bd, 0.65)}`,
          boxShadow: 'none',
          transform: 'none',
        }}
        title={
          band === 'UNASSESSED'
            ? 'Risk: —'
            : `Risk: ${bandLabel(band)} (${bandAbbrev(band)})`
        }
      >
        <Typography
          sx={{
            fontWeight: 950,
            fontSize: 12,
            letterSpacing: -0.3,
            color: toneColor,
          }}
        >
          {bandAbbrev(band)}
        </Typography>
      </Box>
    );
  }

  function getOrCreateStepSession(stepId: string): StepSession {
    const id = String(stepId);
    const existing = stepSessionsRef.current[id];
    if (existing) return existing;

    const fresh: StepSession = {
      ...DEFAULT_STEP_SESSION,
      assessments: [],
    };
    stepSessionsRef.current[id] = fresh;
    return fresh;
  }

  function ensureStepSession(stepId: string): StepSession {
    return getOrCreateStepSession(stepId);
  }

  function persistStepSession(stepId: string) {
    const id = String(stepId);

    stepSessionsRef.current[id] = {
      stage: clampStage(stage),
      controlAnchorId,
      assessments: [...assessments],
    };

    const base = summaryFromAssessments(assessments ?? []);

    const anchorId = controlAnchorId ? String(controlAnchorId) : '';
    const counts = anchorId
      ? cachedControlCounts(anchorId)
      : { existing: 0, additional: 0 };

    const exDraft = anchorId ? validDraftCountFor('EXISTING', anchorId) : 0;
    const addDraft = anchorId ? validDraftCountFor('ADDITIONAL', anchorId) : 0;

    const existingControlsDone =
      Boolean(anchorId) && counts.existing + exDraft > 0;

    const additionalControlsDone =
      Boolean(anchorId) && counts.additional + addDraft > 0;

    const complete =
      base.totalHazards > 0 &&
      base.detailsDone &&
      existingControlsDone &&
      base.existingDone &&
      additionalControlsDone &&
      base.predictedDone;

    setStepSummaries((prev) => ({
      ...prev,
      [id]: {
        ...base,
        existingControlsDone,
        additionalControlsDone,
        complete,
      },
    }));
  }

  function cachedControlCounts(anchorId: string) {
    const c = controlsCacheRef.current[String(anchorId)];
    return {
      existing: c?.existing?.length ?? 0,
      additional: c?.additional?.length ?? 0,
    };
  }

  function restoreStepSession(stepId: string) {
    const s = stepSessionsRef.current[String(stepId)];
    if (!s) return false;

    const list = s.assessments ?? [];
    setAssessments(list);
    setAssessmentsOwnerStepId(String(stepId));

    const nextAnchor =
      s.controlAnchorId &&
      list.some((a) => String(a.id) === String(s.controlAnchorId))
        ? s.controlAnchorId
        : list[0]?.id
          ? String(list[0].id)
          : '';
    setControlAnchorId(nextAnchor);

    setStage(Number.isFinite(s.stage) ? Number(s.stage) : 0);

    return true;
  }

  // controls (cached per anchor assessment)
  const controlsCacheRef = useRef<Record<string, ControlsCache>>({});
  const [controlsLoading, setControlsLoading] = useState(false);
  const [existingControls, setExistingControls] = useState<Control[]>([]);
  const [additionalControls, setAdditionalControls] = useState<Control[]>([]);
  const [draftControls, setDraftControls] = useState<DraftControl[]>([]);

  const validDraftCountFor = useCallback(
    (phase: 'EXISTING' | 'ADDITIONAL', anchorId: string) => {
      const cachedDrafts =
        controlsCacheRef.current[String(anchorId)]?.draft ?? draftControls;

      return (cachedDrafts ?? []).filter((d) => {
        if (d.phase !== phase) return false;
        if (!cleanText(d.description)) return false;
        if (phase === 'ADDITIONAL' && !cleanText(d.categoryId)) return false;
        return true;
      }).length;
    },
    [draftControls], // ✅ cleanText no longer needed
  );

  // saving
  const [savingStep, setSavingStep] = useState(false);

  // risk auto-save timer
  const autoRiskSaveTimerRef = useRef<number | null>(null);

  // hazard picker dialog
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
      <Alert severity="error" sx={{ borderRadius: `${RADIUS}px` }}>
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
        const [cats, haz] = await Promise.all([
          listHazardCategories(),
          listHazards(),
        ]);
        if (!alive) return;
        setHazCats(cats ?? []);
        setHazards(haz ?? []);
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
    if (assessments.length === 0) {
      if (controlAnchorId !== null) setControlAnchorId(null);
      return;
    }

    if (
      controlAnchorId &&
      assessments.some((a) => String(a.id) === String(controlAnchorId))
    ) {
      return;
    }

    setControlAnchorId(String(assessments[0].id));
  }, [assessments, controlAnchorId]);

  useEffect(() => {
    if (!controlAnchorId) return;
    void prefetchControlsForAnchor(String(controlAnchorId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlAnchorId]);

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

        // after setSteps(sorted) / setSelectedStepId(...)
        (async () => {
          const ids = sorted.map((x) => String(x.id));
          const limit = 6;

          const results: Record<string, StepSummary> = {};
          let cursor = 0;

          async function worker() {
            while (cursor < ids.length) {
              const i = cursor++;
              const id = ids[i];
              try {
                const list = (await listAssessmentsForStep(id)) ?? [];
                results[id] = summaryFromAssessments(list);
              } catch {
                results[id] = summaryFromAssessments([]);
              }
            }
          }

          await Promise.all(
            Array.from({ length: Math.min(limit, ids.length) }, () => worker()),
          );

          if (!alive) return;
          setStepSummaries(results);
        })();

        if (sorted.length === 0) {
          nav(`/tasks/${taskIdStr}/steps/new`, { replace: true });
          return;
        }

        try {
          const d = await getStepsDashboard(taskIdStr);
          if (!alive) return;
          const dashSteps = Array.isArray(d)
            ? d
            : ((d as StepDashboardResponse | null)?.steps ?? []);
          setStepDash(dashSteps.slice().sort((a, b) => a.stepNo - b.stepNo));
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
      const dashSteps = Array.isArray(d)
        ? d
        : ((d as StepDashboardResponse | null)?.steps ?? []);
      setStepDash(dashSteps.slice().sort((a, b) => a.stepNo - b.stepNo));
    } catch {
      // non-blocking
    }
  }

  useEffect(() => {
    if (!assessmentsOwnerStepId) return;

    setStepSummaries((prev) => ({
      ...prev,
      [String(assessmentsOwnerStepId)]: summaryFromAssessments(
        assessments ?? [],
      ),
    }));
  }, [assessments, assessmentsOwnerStepId]);

  /* ------------------------ Step edit/delete ------------------------ */

  function openEditStep() {
    if (!selectedStep) return;
    setEditStepTitle(selectedStep.title ?? '');
    setEditStepTrainingLink(selectedStep.trainingLink ?? '');
    setEditStepOpen(true);
  }

  async function saveStepEdits() {
    if (!selectedStepId) return;

    setEditStepSaving(true);
    setErr(null);
    try {
      const patch: any = {
        title: cleanText(editStepTitle) ?? '',
        trainingLink: cleanText(editStepTrainingLink) ?? null,
      };

      const updated = await updateStep(selectedStepId, patch);

      setSteps((prev) =>
        prev.map((s) =>
          String(s.id) === String(selectedStepId) ? updated : s,
        ),
      );

      setEditStepOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update step');
    } finally {
      setEditStepSaving(false);
    }
  }

  async function discoverAnchorWithControls(list: Assessment[]) {
    // Fast path: first one
    if (list.length === 0) return '';

    // Check a few rows until we find one that has controls saved
    const candidates = list.slice(0, 12);
    for (const a of candidates) {
      try {
        const [ex, add] = await Promise.all([
          listControls(String(a.id), { phase: 'EXISTING' }),
          listControls(String(a.id), { phase: 'ADDITIONAL' }),
        ]);
        if ((ex?.length ?? 0) > 0 || (add?.length ?? 0) > 0) {
          return String(a.id);
        }
      } catch {
        // ignore and keep searching
      }
    }

    // Fallback to first
    return String(list[0].id);
  }

  async function confirmDeleteStep() {
    if (!selectedStepId) return;

    setDeleteStepLoading(true);
    setErr(null);
    try {
      await deleteStep(selectedStepId);

      delete stepSessionsRef.current[String(selectedStepId)];

      const idx = steps.findIndex(
        (s) => String(s.id) === String(selectedStepId),
      );
      const remaining = steps.filter(
        (s) => String(s.id) !== String(selectedStepId),
      );

      setSteps(remaining);

      const nextId =
        remaining[idx]?.id ?? remaining[idx - 1]?.id ?? remaining[0]?.id ?? '';

      setSelectedStepId(nextId ? String(nextId) : '');
      setDeleteStepOpen(false);

      if (!nextId) {
        nav(`/tasks/${taskIdStr}/steps/new`, { replace: true });
        return;
      }

      await refreshStepDash();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete step');
    } finally {
      setDeleteStepLoading(false);
    }
  }

  /* ----------------------- Assessments load ------------------------ */

  async function loadAssessments(stepId: string) {
    setLoadingAssessments(true);
    setErr(null);
    try {
      const data = await listAssessmentsForStep(stepId);
      const list = data ?? [];
      setAssessments(list);
      setAssessmentsOwnerStepId(String(stepId));

      const session = ensureStepSession(stepId);

      // 1) Prefer the session anchor if it still exists
      let anchor =
        session.controlAnchorId &&
        list.some((a) => String(a.id) === String(session.controlAnchorId))
          ? String(session.controlAnchorId)
          : '';

      // 2) If no session anchor, try to find the assessment that already has controls
      if (!anchor && list.length > 0) {
        anchor = await discoverAnchorWithControls(list);
      }

      const nextStage = Number.isFinite(session.stage)
        ? Number(session.stage)
        : 0;

      setControlAnchorId(anchor);
      void prefetchControlsForAnchor(anchor);

      setStage(nextStage);

      stepSessionsRef.current[String(stepId)] = {
        ...session,
        controlAnchorId: anchor,
        stage: nextStage,
        assessments: list,
      };

      bumpRenderTick((x) => x + 1);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load assessments');
      setAssessments([]);
      setControlAnchorId('');
      setStage(0);
    } finally {
      setLoadingAssessments(false);
    }
  }

  useEffect(() => {
    if (!selectedStepId) {
      setAssessments([]);
      setControlAnchorId('');
      setStage(0);
      return;
    }

    const restored = restoreStepSession(selectedStepId);
    if (!restored) {
      loadAssessments(selectedStepId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStepId]);

  // keep anchor valid if assessments change
  useEffect(() => {
    if (!selectedStepId) return;
    if (assessments.length === 0) {
      if (controlAnchorId) setControlAnchorId('');
      return;
    }
    if (
      controlAnchorId &&
      assessments.some((a) => String(a.id) === String(controlAnchorId))
    )
      return;

    const next = String(assessments[0].id);
    setControlAnchorId(next);

    const s = ensureStepSession(selectedStepId);
    stepSessionsRef.current[String(selectedStepId)] = {
      ...s,
      stage,
      controlAnchorId: next,
      assessments,
    };
    bumpRenderTick((x) => x + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessments]);

  /* ------------------------ Step navigation ------------------------ */

  const activeStepIndex = useMemo(() => {
    return steps.findIndex((s) => String(s.id) === String(selectedStepId));
  }, [steps, selectedStepId]);

  function goPrevStep() {
    if (activeStepIndex <= 0) return;
    persistStepSession(selectedStepId);
    bumpRenderTick((x) => x + 1);
    setSelectedStepId(String(steps[activeStepIndex - 1].id));
  }

  function goNextStep() {
    if (activeStepIndex < 0 || activeStepIndex >= steps.length - 1) return;
    persistStepSession(selectedStepId);
    bumpRenderTick((x) => x + 1);
    setSelectedStepId(String(steps[activeStepIndex + 1].id));
  }

  /* -------------------- Local risk & status per step ---------------- */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function combinedStepBand(stepId: string): RiskBandKey {
    if (String(stepId) === String(selectedStepId)) {
      return getSummaryForStep(stepId)?.existingBand ?? 'UNASSESSED';
    }
    const dash = stepDashById.get(String(stepId));
    if (dash?.currentBand) return bandKeyFromBand(dash.currentBand);
    return getSummaryForStep(stepId)?.existingBand ?? 'UNASSESSED';
  }

  function getSummaryForStep(stepId: string): StepSummary | undefined {
    const sid = String(stepId);

    if (sid === String(selectedStepId)) {
      return selectedSummary;
    }

    return stepSummaries[sid];
  }

  const selectedSummary = useMemo(() => {
    const base = summaryFromAssessments(assessments ?? []);
    const anchorId = controlAnchorId ? String(controlAnchorId) : '';

    const counts = anchorId
      ? cachedControlCounts(anchorId)
      : { existing: 0, additional: 0 };

    const exDraft = anchorId ? validDraftCountFor('EXISTING', anchorId) : 0;
    const addDraft = anchorId ? validDraftCountFor('ADDITIONAL', anchorId) : 0;

    const existingControlsDone =
      Boolean(anchorId) && counts.existing + exDraft > 0;

    const additionalControlsDone =
      Boolean(anchorId) && counts.additional + addDraft > 0;

    const complete =
      base.totalHazards > 0 &&
      base.detailsDone &&
      existingControlsDone &&
      base.existingDone &&
      additionalControlsDone &&
      base.predictedDone;

    return {
      ...base,
      existingControlsDone,
      additionalControlsDone,
      complete,
    };
  }, [assessments, controlAnchorId, validDraftCountFor, renderTick]);

  /* ------------------------ Controls load/cache -------------------- */

  function setControlsForAnchor(anchorId: string, next: ControlsCache) {
    controlsCacheRef.current[String(anchorId)] = next;
    bumpRenderTick((x) => x + 1);
  }

  function restoreControlsFromCache(anchorId: string) {
    const c = controlsCacheRef.current[String(anchorId)];
    if (!c) return false;

    setExistingControls(c.existing ?? []);
    setAdditionalControls(c.additional ?? []);
    setDraftControls(c.draft ?? []);
    return true;
  }

  async function ensureControlsLoaded(anchorId: string) {
    if (!anchorId) return;
    setControlsLoading(true);
    setErr(null);
    try {
      const [ex, add] = await Promise.all([
        listControls(anchorId, { phase: 'EXISTING' }),
        listControls(anchorId, { phase: 'ADDITIONAL' }),
      ]);

      const next: ControlsCache = {
        existing: ex ?? [],
        additional: add ?? [],
        draft: controlsCacheRef.current[String(anchorId)]?.draft ?? [],
      };

      setExistingControls(next.existing);
      setAdditionalControls(next.additional);
      setDraftControls(next.draft);
      setControlsForAnchor(anchorId, next);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load controls');
      setExistingControls([]);
      setAdditionalControls([]);
      setDraftControls([]);
    } finally {
      setControlsLoading(false);
    }
  }

  // load controls when we enter a controls stage OR anchor changes
  useEffect(() => {
    if (!controlAnchorId) {
      setExistingControls([]);
      setAdditionalControls([]);
      setDraftControls([]);
      return;
    }

    // Always restore fast, then load if missing and stage needs it.
    restoreControlsFromCache(controlAnchorId);

    const needsControls = stage === 2 || stage === 4;
    if (needsControls) {
      const has = restoreControlsFromCache(controlAnchorId);
      if (!has) ensureControlsLoaded(controlAnchorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlAnchorId, stage]);

  /* ------------------------ Step-level saving ----------------------- */

  function buildStepPatchFromAssessment(a: Assessment): Partial<Assessment> {
    return {
      unsafeConditions: cleanText(a.unsafeConditions),
      unsafeActs: cleanText(a.unsafeActs),
      potentialHarm: cleanText(a.potentialHarm),
      notes: cleanText(a.notes),

      existingSeverity: n(a.existingSeverity),
      existingProbability: n(a.existingProbability),

      newSeverity: n(a.newSeverity),
      newProbability: n(a.newProbability),

      status: a.status ?? undefined,
    };
  }

  function updateAllAssessmentsLocal(patch: Partial<Assessment>) {
    setAssessments((prev) => prev.map((x) => ({ ...x, ...patch })));
    persistStepSession(selectedStepId);
    bumpRenderTick((x) => x + 1);
  }

  async function patchAllAssessments(patch: Partial<Assessment>) {
    if (assessments.length === 0) return;

    const ids = assessments.map((a) => String(a.id));
    const results = await Promise.all(
      ids.map(async (id) => {
        const updated = await patchAssessment(id, patch);
        return [String(updated.id), updated] as const;
      }),
    );

    const map = new Map<string, Assessment>(results);

    setAssessments((prev) => prev.map((x) => map.get(String(x.id)) ?? x));
    persistStepSession(selectedStepId);
    bumpRenderTick((x) => x + 1);
    await refreshStepDash();
  }

  async function saveStepAssessment() {
    if (!stepAssessment) {
      setErr('Add at least one hazard before saving.');
      return;
    }

    setSavingStep(true);
    setErr(null);

    try {
      const patch = buildStepPatchFromAssessment(stepAssessment);
      await patchAllAssessments(patch);
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed');
      throw e;
    } finally {
      setSavingStep(false);
    }
  }

  /* -------------------- Risk auto-save (safe) ----------------- */

  function scheduleAutoSaveRisk(
    kind: 'EXISTING' | 'AFTER',
    sev?: number,
    prob?: number,
  ) {
    if (assessments.length === 0) return;

    const isExistingStage = stage === 3;
    const isResidualStage = stage === 5;

    if (kind === 'EXISTING' && !isExistingStage) return;
    if (kind === 'AFTER' && !isResidualStage) return;

    if (autoRiskSaveTimerRef.current) {
      window.clearTimeout(autoRiskSaveTimerRef.current);
      autoRiskSaveTimerRef.current = null;
    }

    autoRiskSaveTimerRef.current = window.setTimeout(async () => {
      try {
        const patch: Partial<Assessment> =
          kind === 'EXISTING'
            ? {
                existingSeverity: sev ?? null,
                existingProbability: prob ?? null,
              }
            : { newSeverity: sev ?? null, newProbability: prob ?? null };

        await patchAllAssessments(patch);
      } catch (e: any) {
        setErr(e?.message ?? 'Auto-save failed');
      }
    }, 250);
  }

  /* ------------------------ Controls CRUD -------------------------- */

  function setControlsCacheDraft(anchorId: string, nextDraft: DraftControl[]) {
    const cur = controlsCacheRef.current[String(anchorId)];
    setControlsForAnchor(anchorId, {
      existing: cur?.existing ?? existingControls,
      additional: cur?.additional ?? additionalControls,
      draft: nextDraft,
    });
  }

  async function createNewControl(d: DraftControl) {
    if (!controlAnchorId) return;

    const desc = cleanText(d.description);
    if (!desc) return;

    if (d.phase === 'ADDITIONAL') {
      const cat = cleanText(d.categoryId);
      if (!cat) return;
    }

    setErr(null);
    try {
      const payload: any = {
        phase: d.phase,
        type: d.type,
        description: desc,
      };

      if (d.phase === 'ADDITIONAL')
        payload.categoryId = cleanText(d.categoryId) ?? null;

      const created = await createControl(controlAnchorId, payload);

      if (d.phase === 'EXISTING') {
        const next = [created, ...existingControls];
        setExistingControls(next);
        setControlsForAnchor(controlAnchorId, {
          existing: next,
          additional: additionalControls,
          draft: draftControls.filter((x) => x.clientId !== d.clientId),
        });
      } else {
        const next = [created, ...additionalControls];
        setAdditionalControls(next);
        setControlsForAnchor(controlAnchorId, {
          existing: existingControls,
          additional: next,
          draft: draftControls.filter((x) => x.clientId !== d.clientId),
        });
      }

      setDraftControls((prev) => prev.filter((x) => x.clientId !== d.clientId));
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to add control');
    }
  }

  async function saveControl(id: string, patch: any) {
    setErr(null);
    try {
      const updated = await patchControl(id, patch);

      setExistingControls((prev) =>
        prev.map((x) => (String(x.id) === String(id) ? updated : x)),
      );
      setAdditionalControls((prev) =>
        prev.map((x) => (String(x.id) === String(id) ? updated : x)),
      );

      if (controlAnchorId) {
        const key = String(controlAnchorId);
        const cur = controlsCacheRef.current[key] ?? {
          existing: existingControls,
          additional: additionalControls,
          draft: draftControls,
        };

        const replace = (arr: Control[]) =>
          (arr ?? []).map((x) => (String(x.id) === String(id) ? updated : x));

        const next: ControlsCache = {
          existing: replace(cur.existing),
          additional: replace(cur.additional),
          draft: cur.draft ?? draftControls,
        };

        controlsCacheRef.current[key] = next;
        setExistingControls(next.existing);
        setAdditionalControls(next.additional);
        setDraftControls(next.draft);
        bumpRenderTick((x) => x + 1);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save control');
    }
  }

  async function removeControl(id: string) {
    setErr(null);

    try {
      await deleteControl(id);

      const removeFrom = (arr: Control[]) =>
        (arr ?? []).filter((x) => String(x.id) !== String(id));

      const exNext = removeFrom(existingControls);
      const addNext = removeFrom(additionalControls);

      // update local UI immediately
      setExistingControls(exNext);
      setAdditionalControls(addNext);

      // update cache for current anchor (so switching hazards doesn't "resurrect" it)
      if (controlAnchorId) {
        const key = String(controlAnchorId);
        const cur = controlsCacheRef.current[key] ?? {
          existing: existingControls,
          additional: additionalControls,
          draft: draftControls,
        };

        const next: ControlsCache = {
          existing: removeFrom(cur.existing),
          additional: removeFrom(cur.additional),
          draft: cur.draft ?? draftControls,
        };

        controlsCacheRef.current[key] = next;

        // keep UI in sync with cache snapshot
        setExistingControls(next.existing);
        setAdditionalControls(next.additional);
        setDraftControls(next.draft);
      }

      bumpRenderTick((x) => x + 1);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete control');
    }
  }

  async function commitDraftsForPhase(phase: 'EXISTING' | 'ADDITIONAL') {
    const drafts = draftControls.filter((d) => d.phase === phase);
    for (const d of drafts) {
      const ok =
        cleanText(d.description) &&
        (phase === 'EXISTING' || cleanText(d.categoryId));
      if (ok) {
        // eslint-disable-next-line no-await-in-loop
        await createNewControl(d);
      }
    }
  }

  /* ------------------- Controls migration on delete ----------------- */

  async function migrateControls(
    fromAssessmentId: string,
    toAssessmentId: string,
  ) {
    // move persisted controls (both phases) to a new anchor assessment
    const [ex, add] = await Promise.all([
      listControls(fromAssessmentId, { phase: 'EXISTING' }),
      listControls(fromAssessmentId, { phase: 'ADDITIONAL' }),
    ]);

    const createdExisting: Control[] = [];
    const createdAdditional: Control[] = [];

    // Create copies in destination first
    for (const c of ex ?? []) {
      // eslint-disable-next-line no-await-in-loop
      const created = await createControl(toAssessmentId, {
        phase: 'EXISTING',
        type: c.type,
        description: c.description,
      });
      createdExisting.push(created);
    }

    for (const c of add ?? []) {
      // eslint-disable-next-line no-await-in-loop
      const created = await createControl(toAssessmentId, {
        phase: 'ADDITIONAL',
        type: c.type,
        description: c.description,
        categoryId: (c as any).categoryId ?? null,
      });
      createdAdditional.push(created);
    }

    // Delete originals
    for (const c of [...(ex ?? []), ...(add ?? [])]) {
      // eslint-disable-next-line no-await-in-loop
      await deleteControl(String(c.id));
    }

    // Swap UI + cache to new anchor
    setControlAnchorId(String(toAssessmentId));
    setExistingControls(createdExisting);
    setAdditionalControls(createdAdditional);

    setControlsForAnchor(String(toAssessmentId), {
      existing: createdExisting,
      additional: createdAdditional,
      draft: draftControls,
    });

    // drop old cache
    delete controlsCacheRef.current[String(fromAssessmentId)];
  }

  /* ------------------------ Hazard picker -------------------------- */

  const alreadyOnStepHazardIds = useMemo(() => {
    return new Set(assessments.map((a) => String(a.hazardId)));
  }, [assessments]);

  function setHazardChecked(hazardId: string, checked: boolean) {
    setSelectedHazardIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(hazardId);
      else next.delete(hazardId);
      return next;
    });
  }

  function toggleHazardRow(id: string) {
    const hid = String(id);
    const checked = selectedHazardIds.has(hid);
    setHazardChecked(hid, !checked);
  }

  const filteredPicker = useMemo(() => {
    const qq = pickerQ.trim().replace(/\s+/g, ' ').toLowerCase();

    return (pickerList ?? []).filter((h) => {
      if (alreadyOnStepHazardIds.has(String(h.id))) return false;
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
    alreadyOnStepHazardIds,
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
      } as any);
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

    const before = stepAssessment; // snapshot current step-level fields
    persistStepSession(selectedStepId);

    const ids = Array.from(selectedHazardIds).filter(
      (id) => !alreadyOnStepHazardIds.has(id),
    );
    if (ids.length === 0) return;

    setPickerLoading(true);
    setErr(null);
    try {
      await bulkCreateAssessments(selectedStepId, ids);

      const next = (await listAssessmentsForStep(selectedStepId)) ?? [];
      setAssessments(next);

      // preserve anchor if possible
      const nextAnchor =
        controlAnchorId &&
        next.some((a) => String(a.id) === String(controlAnchorId))
          ? controlAnchorId
          : next[0]?.id
            ? String(next[0].id)
            : '';
      setControlAnchorId(nextAnchor);

      // If we already had step-level data, copy it onto the newly created assessment rows
      if (before && ids.length > 0) {
        const patch = buildStepPatchFromAssessment(before);

        const targets = next.filter((a) => ids.includes(String(a.hazardId)));
        if (targets.length > 0) {
          const results = await Promise.all(
            targets.map(async (a) => {
              const updated = await patchAssessment(String(a.id), patch);
              return [String(updated.id), updated] as const;
            }),
          );
          const map = new Map<string, Assessment>(results);
          setAssessments((prev) => prev.map((x) => map.get(String(x.id)) ?? x));
        }
      }

      stepSessionsRef.current[String(selectedStepId)] = {
        stage,
        controlAnchorId: nextAnchor,
        assessments: next,
      };

      await refreshStepDash();
      setPickerOpen(false);
      bumpRenderTick((x) => x + 1);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to add hazards');
    } finally {
      setPickerLoading(false);
    }
  }

  /* ------------------------ Delete hazard -------------------------- */

  async function removeHazardAssessment(assessmentId: string) {
    setErr(null);
    try {
      // if this is the anchor holding controls, migrate controls first
      const isAnchor = String(assessmentId) === String(controlAnchorId);
      if (isAnchor) {
        const remaining = assessments.filter(
          (x) => String(x.id) !== String(assessmentId),
        );
        const nextAnchor = remaining[0]?.id ? String(remaining[0].id) : '';

        const hasAnyControls =
          (existingControls?.length ?? 0) > 0 ||
          (additionalControls?.length ?? 0) > 0;

        if (hasAnyControls && nextAnchor) {
          await migrateControls(String(controlAnchorId), nextAnchor);
        }
      }

      await deleteAssessment(assessmentId);

      const next = assessments.filter(
        (x) => String(x.id) !== String(assessmentId),
      );
      setAssessments(next);

      // update anchor if needed
      if (String(controlAnchorId) === String(assessmentId)) {
        const nextAnchor = next[0]?.id ? String(next[0].id) : '';
        setControlAnchorId(nextAnchor);
        if (!nextAnchor) {
          setExistingControls([]);
          setAdditionalControls([]);
          setDraftControls([]);
        }
      }

      persistStepSession(selectedStepId);
      bumpRenderTick((x) => x + 1);
      await refreshStepDash();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to remove hazard');
    }
  }

  /* ------------------------ Stage progress ------------------------- */

  const hazardsSelected = assessments.length > 0;

  const stageDone = useMemo(() => {
    const a = stepAssessment;

    const hazardsDone = hazardsSelected;

    const detailsDone = Boolean(
      cleanText(a?.unsafeConditions) &&
        cleanText(a?.unsafeActs) &&
        cleanText(a?.potentialHarm),
    );

    const anchorId = controlAnchorId ? String(controlAnchorId) : '';
    const counts = anchorId
      ? cachedControlCounts(anchorId)
      : { existing: 0, additional: 0 };

    const exControlsDone =
      anchorId &&
      counts.existing + validDraftCountFor('EXISTING', anchorId) > 0;

    const currentRiskDone = existingRiskComplete(a);

    // Additional controls optional: done if skipped OR anything added (saved OR valid draft)
    const addDraft = anchorId ? validDraftCountFor('ADDITIONAL', anchorId) : 0;

    const additionalControlsDone =
      Boolean(anchorId) && counts.additional + addDraft > 0;

    const predictedRiskDone = predictedRiskComplete(a);

    return [
      hazardsDone,
      detailsDone,
      Boolean(exControlsDone),
      Boolean(currentRiskDone),
      Boolean(additionalControlsDone),
      Boolean(predictedRiskDone),
    ] as const;
  }, [
    stepAssessment,
    hazardsSelected,
    controlAnchorId,
    validDraftCountFor,
    renderTick,
  ]);

  const stagePct = useMemo(() => {
    const doneCount = stageDone.filter(Boolean).length;
    return Math.round((doneCount / STAGES.length) * 100);
  }, [STAGES.length, stageDone]);

  const additionalControlsPending = useMemo(() => {
    const anchorId = controlAnchorId ? String(controlAnchorId) : '';
    if (!hazardsSelected || !anchorId) return false;
    const counts = cachedControlCounts(anchorId);
    const addDraft = validDraftCountFor('ADDITIONAL', anchorId);
    return counts.additional + addDraft === 0;
  }, [hazardsSelected, controlAnchorId, validDraftCountFor, renderTick]);

  const additionalCategoryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of additionalControls as any[]) {
      const v = cleanText(c?.categoryId);
      if (v) s.add(v);
    }
    [
      'Training',
      'Procedure',
      'Engineering change',
      'LOTO',
      'Maintenance',
      'Signage',
      'Supervision',
    ].forEach((x) => s.add(x));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [additionalControls]);

  const selectedStepStatus = selectedStep
    ? getStepStatus(String(selectedStep.id))
    : 'NOT_STARTED';

  const moveOnLabel =
    activeStepIndex >= steps.length - 1 ? 'Finish' : 'Next step';

  function getStepStatus(stepId: string): StepStatus {
    const summary = getSummaryForStep(stepId);

    if (summary) {
      if (summary.totalHazards === 0) return 'NOT_STARTED';
      if (summary.complete) return 'COMPLETE';

      // still building the foundation
      if (
        !summary.detailsDone ||
        !summary.existingControlsDone ||
        !summary.existingDone
      ) {
        return 'IN_PROGRESS';
      }

      // foundation done, now the “finish” gates
      if (!summary.additionalControlsDone) return 'ADDITIONAL_CONTROLS_PENDING';
      if (!summary.predictedDone) return 'PREDICTED_RISK_PENDING';

      return 'IN_PROGRESS';
    }

    // conservative fallback
    const dash = stepDashById.get(String(stepId));
    if (dash?.currentBand || dash?.predictedBand) return 'IN_PROGRESS';
    return 'NOT_STARTED';
  }

  function StageIcon(props: StepIconProps) {
    const { active, completed, icon } = props;
    const idx = Number(icon) - 1;

    const base = theme.palette.primary.main; // single hue
    const neutralBd = alpha(theme.palette.text.primary, 0.18);
    const neutralBg = alpha(theme.palette.text.primary, 0.04);

    const bd = active
      ? alpha(base, 0.75)
      : completed
        ? alpha(base, 0.45)
        : neutralBd;

    const bg = active
      ? alpha(base, 0.16)
      : completed
        ? alpha(base, 0.1)
        : neutralBg;

    const fg = active
      ? alpha(theme.palette.text.primary, 0.85)
      : completed
        ? alpha(theme.palette.text.primary, 0.75)
        : alpha(theme.palette.text.primary, 0.55);

    return (
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          bgcolor: bg,
          border: `2px solid ${bd}`,
          boxShadow: 'none',
          transform: 'none',
          transition: 'background-color 160ms ease, border-color 160ms ease',
        }}
      >
        <Typography sx={{ fontWeight: 950, fontSize: 12, color: fg }}>
          {idx + 1}
        </Typography>
      </Box>
    );
  }

  const canContinue = useMemo(() => !savingStep, [savingStep]);

  async function advanceToNextStepOrFinish() {
    // commit drafts for both phases (safe)
    try {
      await commitDraftsForPhase('EXISTING');
      await commitDraftsForPhase('ADDITIONAL');
    } catch {
      // non-blocking
    }

    // save step-level fields (if possible)
    try {
      if (hazardsSelected && stepAssessment) await saveStepAssessment();
    } catch {
      return;
    }

    persistStepSession(selectedStepId);
    bumpRenderTick((x) => x + 1);

    if (activeStepIndex >= 0 && activeStepIndex < steps.length - 1) {
      setSelectedStepId(String(steps[activeStepIndex + 1].id));
      return;
    }

    nav(`/start`, { replace: true });
  }

  async function continueClicked() {
    setErr(null);

    // commit drafts when leaving control stages
    try {
      if (stage === 2) await commitDraftsForPhase('EXISTING');
      if (stage === 4) await commitDraftsForPhase('ADDITIONAL');
    } catch {
      // non-blocking
    }

    // save on each transition (so nothing is lost)
    try {
      if (stepAssessment) await saveStepAssessment();
    } catch {
      return; // block progression if save fails
    }

    // finish step -> move on
    if (stage === STAGES.length - 1) {
      await advanceToNextStepOrFinish();
      return;
    }

    // otherwise just go next stage
    const nextStage = Math.min(STAGES.length - 1, stage + 1);
    setStage(nextStage);

    // persist session state for this step
    const id = selectedStepIdRef.current;
    const sess = ensureStepSession(id);
    stepSessionsRef.current[id] = {
      ...sess,
      stage: nextStage,
      controlAnchorId,
      assessments,
    };

    bumpRenderTick((x) => x + 1);
  }

  function backClicked() {
    const nextStage = Math.max(0, stage - 1);

    setStage(nextStage);

    const sess = ensureStepSession(selectedStepId);
    stepSessionsRef.current[String(selectedStepId)] = {
      ...sess,
      stage: nextStage,
      controlAnchorId,
      assessments,
    };
    bumpRenderTick((x) => x + 1);
  }

  /* ----------------------------- UI -------------------------------- */

  const stepExistingBand = useMemo(() => {
    if (!stepAssessment) return null;
    return unileverBand(
      n(stepAssessment.existingSeverity),
      n(stepAssessment.existingProbability),
    );
  }, [stepAssessment]);

  const stepPredictedBand = useMemo(() => {
    if (!stepAssessment) return null;
    return unileverBand(
      n(stepAssessment.newSeverity),
      n(stepAssessment.newProbability),
    );
  }, [stepAssessment]);

  async function exitClicked() {
    setErr(null);

    // best effort commit drafts
    try {
      await commitDraftsForPhase('EXISTING');
      await commitDraftsForPhase('ADDITIONAL');
    } catch {
      // non-blocking
    }

    // best effort save step fields (only if hazards exist)
    try {
      if (hazardsSelected && stepAssessment) await saveStepAssessment();
    } catch {
      return; // if save fails, don't exit silently
    }

    persistStepSession(selectedStepId);
    bumpRenderTick((x) => x + 1);
    nav(`/start`);
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
          py: { xs: 2, md: 3 },
          maxWidth: 1200,
          mx: 'auto',
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 2 }}
          gap={1.2}
        >
          <Stack spacing={0.6} sx={{ minWidth: 0 }}>
            <Stack direction="row" gap={1} alignItems="center">
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
                sx={{ fontWeight: 950, fontSize: { xs: 22, md: 28 } }}
                noWrap
              >
                Risk assessment
              </Typography>
            </Stack>
          </Stack>

          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            sx={{ flex: '0 0 auto' }}
          >
            <Button
              variant="outlined"
              onClick={() => void exitClicked()}
              sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
            >
              Exit
            </Button>
          </Stack>
        </Stack>

        {!!err && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS}px` }}>
            {err}
          </Alert>
        )}

        {/* Steps */}
        <Card sx={{ ...glassCard, mb: 2 }}>
          <CardContent sx={{ p: { xs: 1.6, md: 2 } }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
              gap={1}
            >
              <Typography sx={{ fontWeight: 950 }}>Overview</Typography>

              <Stack direction="row" gap={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={goPrevStep}
                  disabled={activeStepIndex <= 0}
                  sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
                >
                  Prev
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={goNextStep}
                  disabled={activeStepIndex >= steps.length - 1}
                  sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
                >
                  Next
                </Button>
              </Stack>
            </Stack>

            {loadingSteps ? (
              <Stack alignItems="center" sx={{ py: 2 }}>
                <CircularProgress size={22} />
              </Stack>
            ) : steps.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: `${RADIUS}px` }}>
                No steps yet.
              </Alert>
            ) : (
              <Box
                sx={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  pb: 0.5,
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                <Stepper
                  nonLinear
                  activeStep={Math.max(0, activeStepIndex)}
                  sx={{
                    minWidth: 860,
                    py: 2,
                    '& .MuiStepLabel-iconContainer': { alignItems: 'center' },
                  }}
                >
                  {steps.map((s) => {
                    const id = String(s.id);
                    const st = getStepStatus(id);
                    const isActive = id === String(selectedStepId);

                    const band = combinedStepBand(id);

                    return (
                      <MuiStep key={id}>
                        <StepButton
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const currentId = selectedStepIdRef.current;
                            const nextId = id;
                            if (nextId === currentId) return;

                            // save current step UI -> session
                            persistStepSession(currentId);

                            // switch step (effect will restore or fetch from API)
                            setSelectedStepId(nextId);
                          }}
                          sx={{
                            borderRadius: `${RADIUS}px`,
                            border: isActive
                              ? `2px solid ${alpha(brand.caramel, 0.65)}`
                              : `2px solid transparent`,
                            bgcolor: isActive
                              ? alpha(brand.caramel, 0.08)
                              : 'transparent',
                            py: 0.6,
                            '& .MuiStepLabel-label': { fontWeight: 850 },
                          }}
                        >
                          <StepLabel
                            StepIconComponent={(p) => (
                              <StepRiskIcon {...p} band={band} />
                            )}
                            optional={
                              <Stack
                                direction="row"
                                gap={0.8}
                                alignItems="center"
                                sx={{ mt: 0.3 }}
                              >
                                <Chip
                                  size="small"
                                  label={statusLabel(st)}
                                  color={statusTone(st)}
                                  variant={
                                    st === 'NOT_STARTED' ? 'outlined' : 'filled'
                                  }
                                  sx={{ fontWeight: 900, borderRadius: 999 }}
                                />
                              </Stack>
                            }
                          >
                            {`Step ${s.stepNo}`}
                          </StepLabel>
                        </StepButton>
                      </MuiStep>
                    );
                  })}
                </Stepper>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Step content */}
        <Card sx={glassCard}>
          <CardContent sx={{ p: { xs: 2, md: 2.4 } }}>
            {!selectedStep ? (
              <Alert severity="info" sx={{ borderRadius: `${RADIUS}px` }}>
                Select a step to start.
              </Alert>
            ) : (
              <Stack spacing={1.6}>
                {/* Step header */}
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  gap={1.5}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      gap={1}
                      alignItems="center"
                      flexWrap="wrap"
                    >
                      <Typography
                        sx={{ fontWeight: 950, fontSize: 18 }}
                      >{`Step ${selectedStep.stepNo}`}</Typography>

                      <Chip
                        size="small"
                        label={statusLabel(selectedStepStatus)}
                        color={statusTone(selectedStepStatus)}
                        variant={
                          selectedStepStatus === 'NOT_STARTED'
                            ? 'outlined'
                            : 'filled'
                        }
                        sx={{ fontWeight: 900, borderRadius: 999 }}
                      />

                      {stepAssessment && (
                        <>
                          <Chip
                            size="small"
                            label={`Existing: ${shortRiskBand(stepExistingBand)}`}
                            color={
                              stepExistingBand
                                ? (bandChipColor(stepExistingBand) as ChipColor)
                                : 'default'
                            }
                            variant={stepExistingBand ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 900, borderRadius: 999 }}
                          />
                          <Chip
                            size="small"
                            label={`Predicted: ${shortRiskBand(stepPredictedBand)}`}
                            color={
                              stepPredictedBand
                                ? (bandChipColor(
                                    stepPredictedBand,
                                  ) as ChipColor)
                                : 'default'
                            }
                            variant={stepPredictedBand ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 900, borderRadius: 999 }}
                          />
                        </>
                      )}
                    </Stack>

                    <Typography
                      sx={{ mt: 0.4, fontWeight: 800 }}
                      noWrap
                      title={selectedStep.title}
                    >
                      {selectedStep.title || '—'}
                    </Typography>
                  </Box>

                  {/* Actions */}
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    sx={{ flex: '0 0 auto' }}
                  >
                    <Tooltip
                      title={
                        selectedStep.trainingLink
                          ? 'Open training link'
                          : 'No training link'
                      }
                      arrow
                    >
                      <span>
                        <IconButton
                          component={selectedStep.trainingLink ? 'a' : 'button'}
                          href={selectedStep.trainingLink || undefined}
                          target={
                            selectedStep.trainingLink ? '_blank' : undefined
                          }
                          rel={
                            selectedStep.trainingLink ? 'noreferrer' : undefined
                          }
                          disabled={!selectedStep.trainingLink}
                          sx={{
                            borderRadius: `${RADIUS}px`,
                            border: `1px solid ${alpha('#000', 0.1)}`,
                            bgcolor: alpha('#fff', 0.55),
                            backdropFilter: 'blur(10px)',
                            opacity: selectedStep.trainingLink ? 1 : 0.55,
                          }}
                        >
                          <LinkIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Edit step" arrow>
                      <span>
                        <IconButton
                          onClick={openEditStep}
                          sx={{
                            borderRadius: `${RADIUS}px`,
                            border: `1px solid ${alpha('#000', 0.1)}`,
                            bgcolor: alpha('#fff', 0.55),
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <EditOutlinedIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Delete step" arrow>
                      <span>
                        <IconButton
                          onClick={() => setDeleteStepOpen(true)}
                          sx={{
                            borderRadius: `${RADIUS}px`,
                            border: `1px solid ${alpha('#000', 0.1)}`,
                            bgcolor: alpha('#fff', 0.55),
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Divider sx={{ borderColor: alpha('#000', 0.08) }} />

                {/* Step workflow */}
                <Card sx={glassCard}>
                  <CardContent sx={{ p: { xs: 1.8, md: 2.2 } }}>
                    {/* Stage progress */}
                    <Box>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 0.7 }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          {`${STAGES[stage]} (${stage + 1}/${STAGES.length})`}
                        </Typography>
                        <Typography
                          sx={{ color: 'text.secondary', fontWeight: 700 }}
                        >
                          {stagePct}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={stagePct}
                        sx={{ height: 10, borderRadius: 999 }}
                      />
                    </Box>

                    <Stepper
                      nonLinear
                      activeStep={stage}
                      alternativeLabel
                      sx={{
                        mt: 1.2,
                        '& .MuiStepLabel-label': { fontWeight: 800 },
                      }}
                    >
                      {STAGES.map((label, i) => {
                        const done = Boolean(stageDone[i]);
                        const pending = !done && i !== stage;

                        return (
                          <MuiStep key={label} completed={done}>
                            <StepButton
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (i === stage) return;

                                setStage(i);

                                const id = selectedStepIdRef.current;
                                const sess = ensureStepSession(id);
                                stepSessionsRef.current[id] = {
                                  ...sess,
                                  stage: i,
                                  controlAnchorId,
                                  assessments,
                                };

                                bumpRenderTick((x) => x + 1);
                              }}
                              sx={{
                                opacity: pending ? 0.45 : 1,
                                transition: 'opacity 160ms ease',
                                '& .MuiStepLabel-label': {
                                  color: pending
                                    ? alpha(theme.palette.text.primary, 0.45)
                                    : theme.palette.text.primary,
                                },
                                '& .MuiStepLabel-iconContainer': {
                                  opacity: pending ? 0.6 : 1,
                                },
                              }}
                            >
                              <StepLabel StepIconComponent={StageIcon}>
                                {label}
                              </StepLabel>
                            </StepButton>
                          </MuiStep>
                        );
                      })}
                    </Stepper>

                    <Divider
                      sx={{ my: 1.6, borderColor: alpha('#000', 0.08) }}
                    />

                    {/* Stage content */}
                    {stage === 0 && (
                      <Stack spacing={1.2}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={1}
                        >
                          <Typography sx={{ fontWeight: 950 }}>
                            Hazards
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={openPicker}
                            sx={{
                              borderRadius: `${RADIUS}px`,
                              fontWeight: 900,
                            }}
                          >
                            Add hazards
                          </Button>
                        </Stack>

                        {loadingAssessments ? (
                          <Stack alignItems="center" sx={{ py: 3 }}>
                            <CircularProgress size={22} />
                          </Stack>
                        ) : assessments.length === 0 ? (
                          <Alert
                            severity="info"
                            sx={{ borderRadius: `${RADIUS}px` }}
                          >
                            No hazards yet. Click <b>Add hazards</b>.
                          </Alert>
                        ) : (
                          <Box
                            sx={{
                              display: 'grid',
                              gap: 1,
                              gridTemplateColumns: {
                                xs: '1fr',
                                md: 'repeat(2, minmax(0, 1fr))',
                              },
                            }}
                          >
                            {assessments.map((a) => {
                              const hz = hazardById.get(String(a.hazardId));
                              const catName = hz
                                ? catById.get(String(hz.categoryId))?.name
                                : undefined;

                              return (
                                <Card
                                  key={String(a.id)}
                                  sx={{
                                    ...glassCard,
                                    bgcolor: alpha('#fff', 0.62),
                                    border: `1px solid ${alpha('#000', 0.08)}`,
                                  }}
                                >
                                  <CardContent sx={{ py: 1.2 }}>
                                    <Stack spacing={0.7}>
                                      <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="flex-start"
                                        gap={1}
                                      >
                                        <Box sx={{ minWidth: 0 }}>
                                          <Typography
                                            sx={{ fontWeight: 800 }}
                                            noWrap
                                            title={hz?.name}
                                          >
                                            {hz?.code ? `${hz.code} — ` : ''}
                                            {hz?.name ?? `Hazard ${a.hazardId}`}
                                          </Typography>
                                          {!!catName && (
                                            <Typography
                                              sx={{
                                                color: 'text.secondary',
                                                fontWeight: 650,
                                              }}
                                              noWrap
                                            >
                                              {catName}
                                            </Typography>
                                          )}
                                        </Box>

                                        <Tooltip title="Remove hazard" arrow>
                                          <IconButton
                                            onClick={() =>
                                              void removeHazardAssessment(
                                                String(a.id),
                                              )
                                            }
                                            sx={{
                                              borderRadius: `${RADIUS}px`,
                                              border: `1px solid ${alpha('#000', 0.1)}`,
                                              bgcolor: alpha('#fff', 0.55),
                                            }}
                                          >
                                            <DeleteOutlineIcon />
                                          </IconButton>
                                        </Tooltip>
                                      </Stack>
                                    </Stack>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </Box>
                        )}
                      </Stack>
                    )}

                    {stage !== 0 && (
                      <Stack spacing={1.2} sx={{ mb: 1.2 }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          gap={1}
                        >
                          <Typography
                            sx={{ fontWeight: 900, color: 'text.secondary' }}
                          >
                            Selected hazards
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={openPicker}
                            sx={{
                              borderRadius: `${RADIUS}px`,
                              fontWeight: 900,
                            }}
                          >
                            Add
                          </Button>
                        </Stack>

                        {assessments.length === 0 ? (
                          <Alert
                            severity="warning"
                            sx={{ borderRadius: `${RADIUS}px` }}
                          >
                            No hazards selected. Go back and add hazards.
                          </Alert>
                        ) : (
                          <Stack direction="row" gap={0.8} flexWrap="wrap">
                            {assessments.map((a) => {
                              const hz = hazardById.get(String(a.hazardId));
                              const label = hz?.code
                                ? `${hz.code}`
                                : `Hazard ${a.hazardId}`;
                              return (
                                <Chip
                                  key={String(a.id)}
                                  label={label}
                                  onDelete={() =>
                                    void removeHazardAssessment(String(a.id))
                                  }
                                  sx={{ fontWeight: 900, borderRadius: 999 }}
                                  variant="outlined"
                                />
                              );
                            })}
                          </Stack>
                        )}
                      </Stack>
                    )}

                    {stage === 1 && (
                      <Stack spacing={1.2}>
                        <TextField
                          label="Unsafe conditions (step-level)"
                          value={stepAssessment?.unsafeConditions ?? ''}
                          onChange={(e) =>
                            updateAllAssessmentsLocal({
                              unsafeConditions: e.target.value,
                            })
                          }
                          multiline
                          minRows={2}
                          maxRows={10}
                          sx={inputSx}
                          disabled={!hazardsSelected}
                        />
                        <TextField
                          label="Unsafe acts (step-level)"
                          value={stepAssessment?.unsafeActs ?? ''}
                          onChange={(e) =>
                            updateAllAssessmentsLocal({
                              unsafeActs: e.target.value,
                            })
                          }
                          multiline
                          minRows={2}
                          maxRows={10}
                          sx={inputSx}
                          disabled={!hazardsSelected}
                        />
                        <TextField
                          label="Potential harm / consequence (step-level)"
                          value={stepAssessment?.potentialHarm ?? ''}
                          onChange={(e) =>
                            updateAllAssessmentsLocal({
                              potentialHarm: e.target.value,
                            })
                          }
                          multiline
                          minRows={2}
                          maxRows={10}
                          sx={inputSx}
                          disabled={!hazardsSelected}
                        />
                      </Stack>
                    )}

                    {stage === 2 && (
                      <ControlsStage
                        phase="EXISTING"
                        loading={controlsLoading}
                        controls={existingControls}
                        drafts={draftControls.filter(
                          (d) => d.phase === 'EXISTING',
                        )}
                        onAddDraft={() => {
                          const nextDraft: DraftControl = {
                            clientId: makeId(),
                            phase: 'EXISTING',
                            type: 'ADMIN' as ControlType,
                            description: '',
                          };
                          const next = [...draftControls, nextDraft];
                          setDraftControls(next);
                          if (controlAnchorId)
                            setControlsCacheDraft(controlAnchorId, next);
                        }}
                        onUpdateDraft={(id, patch) => {
                          const next = draftControls.map((d) =>
                            d.clientId === id ? { ...d, ...patch } : d,
                          );
                          setDraftControls(next);
                          if (controlAnchorId)
                            setControlsCacheDraft(controlAnchorId, next);
                        }}
                        onRemoveDraft={(id) => {
                          const next = draftControls.filter(
                            (d) => d.clientId !== id,
                          );
                          setDraftControls(next);
                          if (controlAnchorId)
                            setControlsCacheDraft(controlAnchorId, next);
                        }}
                        onCreateDraft={createNewControl}
                        onAutosaveControl={saveControl}
                        onDeleteControl={removeControl}
                        categoryOptions={[]}
                      />
                    )}

                    {stage === 3 && (
                      <RiskStage
                        title="Current risk"
                        severity={n(stepAssessment?.existingSeverity)}
                        probability={n(stepAssessment?.existingProbability)}
                        onChange={(sev, prob) => {
                          updateAllAssessmentsLocal({
                            existingSeverity: sev ?? null,
                            existingProbability: prob ?? null,
                          });
                          scheduleAutoSaveRisk('EXISTING', sev, prob);
                        }}
                        theme={theme}
                      />
                    )}

                    {stage === 4 && (
                      <Stack spacing={1.2}>
                        <ControlsStage
                          phase="ADDITIONAL"
                          loading={controlsLoading}
                          controls={additionalControls as any}
                          drafts={draftControls.filter(
                            (d) => d.phase === 'ADDITIONAL',
                          )}
                          onAddDraft={() => {
                            const nextDraft: DraftControl = {
                              clientId: makeId(),
                              phase: 'ADDITIONAL',
                              type: 'ADMIN' as ControlType,
                              description: '',
                              categoryId: 'Training',
                            };
                            const next = [...draftControls, nextDraft];
                            setDraftControls(next);
                            if (controlAnchorId)
                              setControlsCacheDraft(controlAnchorId, next);
                          }}
                          onUpdateDraft={(id, patch) => {
                            const next = draftControls.map((d) =>
                              d.clientId === id ? { ...d, ...patch } : d,
                            );
                            setDraftControls(next);
                            if (controlAnchorId)
                              setControlsCacheDraft(controlAnchorId, next);
                          }}
                          onRemoveDraft={(id) => {
                            const next = draftControls.filter(
                              (d) => d.clientId !== id,
                            );
                            setDraftControls(next);
                            if (controlAnchorId)
                              setControlsCacheDraft(controlAnchorId, next);
                          }}
                          onCreateDraft={createNewControl}
                          onAutosaveControl={saveControl}
                          onDeleteControl={removeControl}
                          categoryOptions={additionalCategoryOptions}
                        />
                      </Stack>
                    )}

                    {stage === 5 && (
                      <RiskStage
                        title="Predicted risk after additional controls"
                        severity={n(stepAssessment?.newSeverity)}
                        probability={n(stepAssessment?.newProbability)}
                        onChange={(sev, prob) => {
                          updateAllAssessmentsLocal({
                            newSeverity: sev ?? null,
                            newProbability: prob ?? null,
                          });
                          scheduleAutoSaveRisk('AFTER', sev, prob);
                        }}
                        theme={theme}
                      />
                    )}

                    {/* Bottom nav */}
                    <Divider
                      sx={{ my: 1.6, borderColor: alpha('#000', 0.08) }}
                    />

                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={1}
                    >
                      <Button
                        variant="outlined"
                        onClick={backClicked}
                        disabled={stage === 0 || savingStep}
                        sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
                      >
                        Back
                      </Button>

                      <Stack direction="row" gap={1}>
                        <Button
                          variant="outlined"
                          startIcon={<SaveIcon />}
                          onClick={() =>
                            void saveStepAssessment().catch(() => {
                              /* empty */
                            })
                          }
                          disabled={savingStep || !hazardsSelected}
                          sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
                        >
                          Save
                        </Button>

                        <Button
                          variant="contained"
                          endIcon={<ArrowForwardIcon />}
                          onClick={() => void continueClicked()}
                          disabled={savingStep}
                          sx={{
                            borderRadius: `${RADIUS}px`,
                            fontWeight: 950,
                            boxShadow: 'none',
                          }}
                        >
                          {stage === 5 ? moveOnLabel : 'Continue'}
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Edit Step Dialog */}
        <Dialog
          open={editStepOpen}
          onClose={() => {
            if (editStepSaving) return;
            setEditStepOpen(false);
          }}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: { borderRadius: `${RADIUS}px` } }}
        >
          <DialogTitle sx={{ fontWeight: 950 }}>Edit step</DialogTitle>

          <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={1.2} sx={{ mt: 1 }}>
              <TextField
                label="Step title"
                value={editStepTitle}
                onChange={(e) => setEditStepTitle(e.target.value)}
                fullWidth
                autoFocus
                sx={inputSx}
              />

              <TextField
                label="Training link (optional)"
                value={editStepTrainingLink}
                onChange={(e) => setEditStepTrainingLink(e.target.value)}
                fullWidth
                sx={inputSx}
                placeholder="https://..."
                helperText="Paste a URL (leave blank to remove)."
              />

              {cleanText(editStepTrainingLink) && (
                <Box>
                  <Button
                    component="a"
                    href={cleanText(editStepTrainingLink)}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<LinkIcon />}
                    variant="outlined"
                    sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
                  >
                    Preview link
                  </Button>
                </Box>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.2 }}>
            <Button
              onClick={() => setEditStepOpen(false)}
              variant="outlined"
              disabled={editStepSaving}
              sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
            >
              Cancel
            </Button>

            <Button
              onClick={() => void saveStepEdits()}
              variant="contained"
              startIcon={
                editStepSaving ? <CircularProgress size={16} /> : <SaveIcon />
              }
              disabled={editStepSaving || !cleanText(editStepTitle)}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                boxShadow: 'none',
              }}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Step Dialog */}
        <Dialog
          open={deleteStepOpen}
          onClose={() => {
            if (deleteStepLoading) return;
            setDeleteStepOpen(false);
          }}
          fullWidth
          maxWidth="xs"
          PaperProps={{ sx: { borderRadius: `${RADIUS}px` } }}
        >
          <DialogTitle sx={{ fontWeight: 950 }}>Delete step?</DialogTitle>

          <DialogContent sx={{ pt: 1 }}>
            <Typography sx={{ fontWeight: 650 }}>
              This will permanently delete{' '}
              <b>
                {selectedStep ? `Step ${selectedStep.stepNo}` : 'this step'}
              </b>
              .
            </Typography>

            <Typography
              sx={{ mt: 1, color: 'text.secondary', fontWeight: 650 }}
            >
              If there are hazards/assessments under this step, they may be
              removed as well depending on your backend cascade rules.
            </Typography>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.2 }}>
            <Button
              onClick={() => setDeleteStepOpen(false)}
              variant="outlined"
              disabled={deleteStepLoading}
              sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
            >
              Cancel
            </Button>

            <Button
              onClick={() => void confirmDeleteStep()}
              variant="contained"
              color="error"
              startIcon={
                deleteStepLoading ? (
                  <CircularProgress size={16} />
                ) : (
                  <DeleteOutlineIcon />
                )
              }
              disabled={deleteStepLoading}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                boxShadow: 'none',
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

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
              sx={{
                mt: 1,
                mb: 1,
                ...glassCard,
                p: 1.2,
                bgcolor: alpha('#fff', 0.58),
              }}
            >
              <TextField
                label="Search"
                value={pickerQ}
                onChange={(e) => setPickerQ(e.target.value)}
                fullWidth
                sx={inputSx}
              />

              <TextField
                label="Category"
                select
                value={pickerCat}
                onChange={(e) => setPickerCat(e.target.value)}
                sx={{ minWidth: { xs: '100%', md: 280 }, ...inputSx }}
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
                sx={{
                  borderRadius: 12,
                  fontWeight: 950,
                  boxShadow: 'none',
                  height: 44,
                  px: 2.2,
                  alignSelf: { xs: 'stretch', md: 'center' },
                }}
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
              <Stack direction="row" gap={1} alignItems="center">
                <Checkbox
                  checked={pickerShowSelectedOnly}
                  onChange={(e) => setPickerShowSelectedOnly(e.target.checked)}
                />
                <Typography sx={{ fontWeight: 700 }}>
                  Show selected only
                </Typography>
              </Stack>

              <Button
                variant="outlined"
                onClick={() => setSelectedHazardIds(new Set())}
                sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
              >
                Clear selected
              </Button>
            </Stack>

            {pickerLoading ? (
              <Stack alignItems="center" sx={{ py: 3 }}>
                <CircularProgress size={22} />
              </Stack>
            ) : (
              <Box
                sx={{
                  mt: 1,
                  maxHeight: 520,
                  overflow: 'auto',
                  pr: 0.5,
                  display: 'grid',
                  gap: 1.2,
                }}
              >
                {hazCats
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((cat) => {
                    const list = hazardsByCategory.get(String(cat.id)) ?? [];
                    if (list.length === 0) return null;

                    const selectedInCat = list.reduce(
                      (acc, h) =>
                        acc + (selectedHazardIds.has(String(h.id)) ? 1 : 0),
                      0,
                    );

                    return (
                      <Box
                        key={String(cat.id)}
                        sx={{
                          border: `1px solid ${alpha('#000', 0.1)}`,
                          borderRadius: 1,
                          bgcolor: alpha('#fff', 0.62),
                          backdropFilter: 'blur(10px)',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            px: 1.6,
                            py: 1.15,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            borderBottom: `1px solid ${alpha('#000', 0.08)}`,
                            bgcolor: alpha(theme.palette.primary.main, 0.075),
                            borderLeft: `6px solid ${alpha(brand.caramel, 0.75)}`,
                            borderTopLeftRadius: 10,
                            borderTopRightRadius: 10,
                          }}
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
                              variant="outlined"
                              sx={{
                                borderRadius: 2,
                                fontWeight: 950,
                                bgcolor: alpha('#fff', 0.4),
                              }}
                            />
                          </Stack>
                        </Box>

                        <Box sx={{ display: 'grid' }}>
                          {list.map((h, idx) => {
                            const id = String(h.id);
                            const checked = selectedHazardIds.has(id);

                            return (
                              <Box
                                key={id}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleHazardRow(id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ')
                                    toggleHazardRow(id);
                                }}
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: '44px 1fr',
                                  alignItems: 'center',
                                  minHeight: 64,
                                  px: 0.8,
                                  py: 0.6,
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  borderRadius: '0px !important',
                                  borderBottom:
                                    idx === list.length - 1
                                      ? 'none'
                                      : `1px solid ${alpha('#000', 0.07)}`,
                                  bgcolor: checked
                                    ? alpha(brand.caramel, 0.1)
                                    : alpha('#fff', 0.52),
                                  transition: 'background-color 140ms ease',
                                  '&:hover': {
                                    bgcolor: checked
                                      ? alpha(brand.caramel, 0.14)
                                      : alpha('#fff', 0.62),
                                  },
                                  '&:active': { transform: 'none' },
                                  outline: 'none',
                                }}
                              >
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                  }}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      setHazardChecked(id, e.target.checked)
                                    }
                                  />
                                </Box>

                                <Box sx={{ minWidth: 0, pr: 1 }}>
                                  <Typography sx={{ fontWeight: 850 }} noWrap>
                                    {h.code ? `${h.code} — ` : ''}
                                    {h.name}
                                  </Typography>

                                  {!!h.description && (
                                    <Typography
                                      sx={{
                                        mt: 0.2,
                                        color: 'text.secondary',
                                        fontWeight: 650,
                                        fontSize: 13,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                      }}
                                    >
                                      {h.description}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}

                {filteredPicker.length === 0 && (
                  <Alert severity="info" sx={{ borderRadius: 12 }}>
                    No hazards found.
                  </Alert>
                )}
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.2 }}>
            <Button
              onClick={() => setPickerOpen(false)}
              variant="outlined"
              sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
            >
              Cancel
            </Button>
            <Button
              onClick={addSelectedHazards}
              variant="contained"
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                boxShadow: 'none',
              }}
              disabled={pickerLoading || selectedHazardIds.size === 0}
            >
              Add selected ({selectedHazardIds.size})
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

/* ============================ Components ============================ */

function optionsForControlType(
  phase: 'EXISTING' | 'ADDITIONAL',
  type: ControlType,
): { descOptions: string[] } {
  if (type !== 'ENGINEERING' && type !== 'ADMIN') {
    return { descOptions: [] };
  }

  if (phase === 'EXISTING')
    return { descOptions: EXISTING_SUGGESTIONS[type] ?? [] };

  return {
    descOptions: (ADDITIONAL_SUGGESTIONS[type] ?? []).map((x) => x.text),
  };
}

function bestCategoryForAdditional(
  type: ControlType,
  desc: string,
): string | undefined {
  if (type !== 'ENGINEERING' && type !== 'ADMIN') return undefined;
  const arr = ADDITIONAL_SUGGESTIONS[type] ?? [];
  const hit = arr.find((x) => x.text === desc);
  return hit?.categoryId;
}

function ControlsStage({
  phase,
  loading,
  controls,
  drafts,
  onAddDraft,
  onUpdateDraft,
  onRemoveDraft,
  onCreateDraft,
  onAutosaveControl,
  onDeleteControl,
  categoryOptions,
}: {
  phase: 'EXISTING' | 'ADDITIONAL';
  loading: boolean;
  controls: Control[];
  drafts: DraftControl[];
  onAddDraft: () => void;
  onUpdateDraft: (clientId: string, patch: Partial<DraftControl>) => void;
  onRemoveDraft: (clientId: string) => void;
  onCreateDraft: (d: DraftControl) => Promise<void>;
  onAutosaveControl: (id: string, patch: any) => Promise<void>;
  onDeleteControl: (id: string) => Promise<void>;
  categoryOptions: string[];
}) {
  const title =
    phase === 'EXISTING'
      ? 'Existing controls'
      : 'Recommendations (additional controls)';

  return (
    <Stack spacing={1.2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddDraft}
          sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
        >
          Add control
        </Button>
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={20} />
        </Stack>
      ) : (
        <Stack spacing={1}>
          {controls.length === 0 && drafts.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: `${RADIUS}px` }}>
              {phase === 'EXISTING'
                ? 'No existing controls added yet.'
                : 'No recommendations added yet.'}
            </Alert>
          ) : null}

          {drafts.map((d) => (
            <ControlDraftRow
              key={d.clientId}
              d={d}
              phase={phase}
              onChange={(patch) => onUpdateDraft(d.clientId, patch)}
              onRemove={() => onRemoveDraft(d.clientId)}
              onCommit={() => onCreateDraft(d)}
              categoryOptions={categoryOptions}
            />
          ))}

          {controls.map((c: any) => (
            <ControlSavedRow
              key={c.id}
              c={c}
              phase={phase}
              categoryOptions={categoryOptions}
              onAutosave={onAutosaveControl}
              onDelete={onDeleteControl}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ControlDraftRow({
  d,
  phase,
  onChange,
  onRemove,
  onCommit,
  categoryOptions,
}: {
  d: DraftControl;
  phase: 'EXISTING' | 'ADDITIONAL';
  onChange: (patch: Partial<DraftControl>) => void;
  onRemove: () => void;
  onCommit: () => Promise<void>;
  categoryOptions: string[];
}) {
  const { descOptions } = optionsForControlType(phase, d.type);
  const canCommit =
    !!cleanText(d.description) &&
    (phase === 'EXISTING' || !!cleanText(d.categoryId));

  const committingRef = useRef(false);

  async function tryCommit() {
    if (!canCommit) return;
    if (committingRef.current) return;
    committingRef.current = true;
    try {
      await onCommit();
    } finally {
      committingRef.current = false;
    }
  }

  return (
    <Box
      sx={{
        border: `1px dashed ${alpha('#000', 0.18)}`,
        borderRadius: `${RADIUS}px`,
        p: 1.2,
        bgcolor: alpha('#fff', 0.55),
        backdropFilter: 'blur(10px)',
        position: 'relative',
      }}
    >
      <Tooltip title="Remove draft" arrow>
        <IconButton
          onClick={onRemove}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            borderRadius: 999,
            border: `1px solid ${alpha('#000', 0.12)}`,
            bgcolor: alpha('#fff', 0.6),
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField
            label="Type"
            select
            value={d.type}
            onChange={(e) => onChange({ type: e.target.value as ControlType })}
            sx={{ minWidth: { xs: '100%', md: 220 }, ...inputSx }}
            size="small"
          >
            <MenuItem value="ENGINEERING">Engineering</MenuItem>
            <MenuItem value="ADMIN">Administrative</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </TextField>

          {phase === 'ADDITIONAL' && (
            <Autocomplete
              freeSolo
              options={categoryOptions}
              value={d.categoryId ?? ''}
              onChange={(_, v) => onChange({ categoryId: String(v ?? '') })}
              onInputChange={(_, v) => onChange({ categoryId: v })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Recommendation category"
                  helperText="Select an existing category or type to create a new one."
                  size="small"
                  sx={{ minWidth: { xs: '100%', md: 340 }, ...inputSx }}
                  onBlur={() => void tryCommit()}
                />
              )}
              openOnFocus={false}
              autoHighlight
            />
          )}
        </Stack>

        <Autocomplete
          freeSolo
          options={descOptions}
          value={d.description}
          onChange={(_, v) => {
            const desc = String(v ?? '');
            const patch: Partial<DraftControl> = { description: desc };

            if (phase === 'ADDITIONAL') {
              const cat = bestCategoryForAdditional(d.type, desc);
              if (cat && !cleanText(d.categoryId)) patch.categoryId = cat;
            }

            onChange(patch);
          }}
          onInputChange={(_, v) => onChange({ description: v })}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Description"
              placeholder={
                d.type === 'OTHER'
                  ? 'Type your own…'
                  : 'Start typing… (filtered suggestions)'
              }
              size="small"
              multiline
              minRows={2}
              maxRows={8}
              sx={inputSx}
              onBlur={() => void tryCommit()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void tryCommit();
                }
              }}
            />
          )}
          openOnFocus={false}
          autoHighlight
        />

        <Typography
          sx={{ fontSize: 12, fontWeight: 700, color: alpha('#000', 0.55) }}
        >
          {canCommit
            ? 'Auto-saves on blur / Enter.'
            : phase === 'ADDITIONAL'
              ? 'Add category + description.'
              : 'Add a description.'}
        </Typography>
      </Stack>
    </Box>
  );
}

function ControlSavedRow({
  c,
  phase,
  categoryOptions,
  onAutosave,
  onDelete,
}: {
  c: any;
  phase: 'EXISTING' | 'ADDITIONAL';
  categoryOptions: string[];
  onAutosave: (id: string, patch: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [localType, setLocalType] = useState<ControlType>(c.type);
  const [localDesc, setLocalDesc] = useState<string>(c.description ?? '');
  const [localCat, setLocalCat] = useState<string>(c.categoryId ?? '');
  const [saving, setSaving] = useState(false);

  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalType(c.type);
    setLocalDesc(c.description ?? '');
    setLocalCat(c.categoryId ?? '');
  }, [c.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  const { descOptions } = optionsForControlType(phase, localType);

  function scheduleAutosave() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const patch: any = {
        type: localType,
        description: cleanText(localDesc),
      };

      if (phase === 'ADDITIONAL') {
        patch.categoryId = cleanText(localCat) ?? null;
        if (!patch.description || !patch.categoryId) return;
      }

      setSaving(true);
      try {
        await onAutosave(String(c.id), patch);
      } finally {
        setSaving(false);
      }
    }, 550);
  }

  useEffect(() => {
    scheduleAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localType, localDesc, localCat]);

  return (
    <Box
      sx={{
        border: `1px solid ${alpha('#000', 0.08)}`,
        borderRadius: `${RADIUS}px`,
        p: 1.2,
        bgcolor: alpha('#fff', 0.55),
        backdropFilter: 'blur(10px)',
        position: 'relative',
      }}
    >
      <Tooltip title="Delete" arrow>
        <span>
          <IconButton
            onClick={() => onDelete(String(c.id))}
            disabled={saving}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              borderRadius: 999,
              border: `1px solid ${alpha('#000', 0.12)}`,
              bgcolor: alpha('#fff', 0.6),
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField
            label="Type"
            select
            value={localType}
            onChange={(e) => setLocalType(e.target.value as ControlType)}
            sx={{ minWidth: { xs: '100%', md: 220 }, ...inputSx }}
            size="small"
          >
            <MenuItem value="ENGINEERING">Engineering</MenuItem>
            <MenuItem value="ADMIN">Administrative</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </TextField>

          {phase === 'ADDITIONAL' && (
            <Autocomplete
              freeSolo
              options={categoryOptions}
              value={localCat}
              onChange={(_, v) => setLocalCat(String(v ?? ''))}
              onInputChange={(_, v) => setLocalCat(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Recommendation category"
                  helperText="Select an existing category or type to create a new one."
                  size="small"
                  sx={{ minWidth: { xs: '100%', md: 340 }, ...inputSx }}
                />
              )}
              openOnFocus={false}
              autoHighlight
            />
          )}
        </Stack>

        <Autocomplete
          freeSolo
          options={descOptions}
          value={localDesc}
          onChange={(_, v) => {
            const desc = String(v ?? '');
            setLocalDesc(desc);

            if (phase === 'ADDITIONAL') {
              const cat = bestCategoryForAdditional(localType, desc);
              if (cat && !cleanText(localCat)) setLocalCat(cat);
            }
          }}
          onInputChange={(_, v) => setLocalDesc(v)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Description"
              placeholder={
                localType === 'OTHER'
                  ? 'Type your own…'
                  : 'Start typing… (filtered suggestions)'
              }
              size="small"
              multiline
              minRows={2}
              maxRows={8}
              sx={inputSx}
            />
          )}
          openOnFocus={false}
          autoHighlight
        />

        {saving && (
          <Typography
            sx={{ color: 'text.secondary', fontWeight: 700, fontSize: 12 }}
          >
            Saving…
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function RiskStage({
  title,
  severity,
  probability,
  onChange,
  theme,
}: {
  title: string;
  severity?: number;
  probability?: number;
  onChange: (severity?: number, probability?: number) => void;
  theme: any;
}) {
  const band = unileverBand(severity, probability);
  const rating = unileverRating(severity, probability);

  const bandKey = bandKeyFromBand(band);
  const bandGuide =
    bandKey !== 'UNASSESSED' ? RISK_BAND_GUIDANCE[bandKey] : undefined;

  const [bandDialogOpen, setBandDialogOpen] = useState(false);
  const [scoreGuideOpen, setScoreGuideOpen] = useState(false);

  const canClear = severity != null || probability != null;

  return (
    <Stack spacing={1.2}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
      >
        <Typography sx={{ fontWeight: 950 }}>{title}</Typography>

        <Stack direction="row" gap={1} alignItems="center">
          <Chip
            size="small"
            label={band ? `Band: ${shortRiskBand(band)}` : 'Band: —'}
            color={band ? (bandChipColor(band) as ChipColor) : 'default'}
            variant={band ? 'filled' : 'outlined'}
            sx={{ fontWeight: 900, borderRadius: 999 }}
          />
          <Chip
            size="small"
            label={rating != null ? `Score: ${rating}` : 'Score: —'}
            sx={{ fontWeight: 900, borderRadius: 999 }}
            variant="outlined"
          />

          <Tooltip title="Scoring guide (Severity & Probability)" arrow>
            <IconButton
              onClick={() => setScoreGuideOpen(true)}
              sx={{
                borderRadius: 999,
                border: `1px solid ${alpha('#000', 0.12)}`,
                bgcolor: alpha('#fff', 0.6),
              }}
            >
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Risk band guidance" arrow>
            <IconButton
              onClick={() => setBandDialogOpen(true)}
              sx={{
                borderRadius: 999,
                border: `1px solid ${alpha('#000', 0.12)}`,
                bgcolor: alpha('#fff', 0.6),
              }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear rating" arrow>
            <span>
              <IconButton
                onClick={() => onChange(undefined, undefined)}
                disabled={!canClear}
                sx={{
                  borderRadius: 999,
                  border: `1px solid ${alpha('#000', 0.12)}`,
                  bgcolor: alpha('#fff', 0.6),
                  opacity: canClear ? 1 : 0.5,
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Dropdowns */}
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
          value={severity ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            const v = raw === '' ? undefined : Number(raw);
            onChange(v, probability);
          }}
          sx={inputSx}
          SelectProps={
            {
              displayEmpty: true,
              MenuProps: selectMenuProps,
              renderValue: (val) => renderScoreValue(val, SEVERITY_DESC),
            } satisfies Partial<SelectProps>
          }
          helperText={
            severity != null
              ? (SEVERITY_DESC[severity] ?? '')
              : 'Select a severity score.'
          }
        >
          <MenuItem value="">
            <Typography sx={{ color: 'text.disabled', fontWeight: 750 }}>
              —
            </Typography>
          </MenuItem>

          {/* example options */}
          {UNILEVER_SEVERITIES.map((s) => (
            <MenuItem key={s} value={s}>
              <Chip
                size="small"
                label={s}
                sx={{
                  height: 22,
                  fontWeight: 950,
                  borderRadius: 999,
                  bgcolor: alpha('#000', 0.06),
                }}
              />
              <Typography sx={{ fontWeight: 850, color: 'text.secondary' }}>
                {SEVERITY_DESC[s] ?? ''}
              </Typography>
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Probability"
          select
          value={probability ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            const v = raw === '' ? undefined : Number(raw);
            onChange(severity, v);
          }}
          sx={inputSx}
          SelectProps={
            {
              displayEmpty: true,
              MenuProps: selectMenuProps,
              renderValue: (val) => renderScoreValue(val, PROB_DESC),
            } satisfies Partial<SelectProps>
          }
          helperText={
            probability != null
              ? (PROB_DESC[probability] ?? '')
              : 'Select a probability score.'
          }
        >
          <MenuItem value="">
            <Typography sx={{ color: 'text.disabled', fontWeight: 750 }}>
              —
            </Typography>
          </MenuItem>

          {UNILEVER_PROBABILITIES.map((v) => (
            <MenuItem
              key={v}
              value={v}
              sx={{
                py: 1,
                mx: 0.8,
                my: 0.3,
                borderRadius: 1.5,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ width: '100%', minWidth: 0 }}
              >
                <Chip
                  size="small"
                  label={v}
                  sx={{
                    height: 22,
                    fontWeight: 950,
                    borderRadius: 999,
                    bgcolor: alpha('#000', 0.06),
                    flex: '0 0 auto',
                  }}
                />

                <Typography
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 800,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {PROB_DESC[v] ?? ''}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Matrix + guidance side panel */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' },
          gap: 1.2,
          alignItems: 'start',
        }}
      >
        <RiskMatrix
          severity={severity}
          probability={probability}
          theme={theme}
          onPick={(s, p) => onChange(s, p)}
        />

        <Card
          sx={{
            ...glassCard,
            borderRadius: `${RADIUS}px`,
            border: `1px solid ${alpha('#000', 0.08)}`,
            overflow: 'hidden',
            bgcolor:
              bandKey !== 'UNASSESSED'
                ? alpha(bandAccent(bandKey), 0.06)
                : alpha('#fff', 0.62),
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 1.6,
              py: 1.25,
              borderLeft: `6px solid ${bandAccent(bandKey)}`,
              borderBottom: `1px solid ${alpha('#000', 0.06)}`,
              bgcolor:
                bandKey !== 'UNASSESSED'
                  ? alpha(bandAccent(bandKey), 0.12)
                  : alpha('#000', 0.03),
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Box>
                <Typography sx={{ fontWeight: 1000, lineHeight: 1.1 }}>
                  Risk band guidance
                </Typography>
                <Typography
                  sx={{
                    mt: 0.2,
                    fontWeight: 700,
                    color: 'text.secondary',
                    fontSize: 12.5,
                  }}
                >
                  Based on your selected severity and probability.
                </Typography>
              </Box>

              {bandGuide ? (
                <Chip
                  size="small"
                  label={bandGuide.title}
                  sx={{
                    fontWeight: 950,
                    borderRadius: 999,
                    bgcolor: alpha(bandAccent(bandKey), 0.18),
                    color: bandAccent(bandKey),
                    border: `1px solid ${alpha(bandAccent(bandKey), 0.35)}`,
                  }}
                />
              ) : (
                <Chip
                  size="small"
                  label="Unassessed"
                  variant="outlined"
                  sx={{ fontWeight: 900, borderRadius: 999 }}
                />
              )}
            </Stack>
          </Box>

          <CardContent sx={{ p: 1.6 }}>
            {bandGuide ? (
              <>
                {/* Bullet guidance */}
                <Stack spacing={1} sx={{ mt: 0.2 }}>
                  {bandGuide.body.map((t, idx) => (
                    <Stack
                      key={idx}
                      direction="row"
                      spacing={1.2}
                      alignItems="flex-start"
                    >
                      <Box
                        sx={{
                          width: 9,
                          height: 9,
                          borderRadius: 999,
                          bgcolor: bandAccent(bandKey),
                          mt: '6.5px',
                          flex: '0 0 auto',
                          boxShadow: `0 0 0 3px ${alpha(bandAccent(bandKey), 0.14)}`,
                        }}
                      />
                      <Typography
                        sx={{
                          fontWeight: 750,
                          color: 'text.secondary',
                          lineHeight: 1.45,
                        }}
                      >
                        {t}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                {/* Actions */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ mt: 1.6 }}
                >
                  <Button
                    onClick={() => setBandDialogOpen(true)}
                    variant="contained"
                    sx={{
                      borderRadius: `${RADIUS}px`,
                      fontWeight: 950,
                      boxShadow: 'none',
                      bgcolor: bandAccent(bandKey),
                      '&:hover': { bgcolor: bandAccent(bandKey) },
                    }}
                    startIcon={<InfoOutlinedIcon />}
                    fullWidth
                  >
                    View full guidance
                  </Button>

                  <Button
                    onClick={() => setScoreGuideOpen(true)}
                    variant="outlined"
                    sx={{
                      borderRadius: `${RADIUS}px`,
                      fontWeight: 950,
                      color: 'text.secondary',
                      borderColor: alpha('#000', 0.14),
                      '&:hover': { bgcolor: alpha('#000', 0.03) },
                    }}
                    startIcon={<HelpOutlineIcon />}
                    fullWidth
                  >
                    Scoring guide
                  </Button>
                </Stack>
              </>
            ) : (
              <Alert
                severity="info"
                sx={{
                  borderRadius: `${RADIUS}px`,
                  '& .MuiAlert-message': { fontWeight: 750 },
                }}
              >
                Pick Severity + Probability to see guidance for the selected
                band.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Risk band guidance dialog (full text) */}
      <Dialog
        open={bandDialogOpen}
        onClose={() => setBandDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: `${RADIUS}px` } }}
      >
        <DialogTitle sx={{ fontWeight: 950 }}>Risk band guidance</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.6} sx={{ mt: 1 }}>
            {(
              Object.keys(RISK_BAND_GUIDANCE) as Array<
                Exclude<RiskBandKey, 'UNASSESSED'>
              >
            ).map((k) => {
              const g = RISK_BAND_GUIDANCE[k];
              const accent = bandAccent(k);

              return (
                <Box
                  key={k}
                  sx={{
                    borderRadius: `${RADIUS}px`,
                    border: `1px solid ${alpha(accent, 0.25)}`,
                    bgcolor: alpha(accent, 0.06),
                    overflow: 'hidden',
                  }}
                >
                  {/* Card header */}
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1.15,
                      bgcolor: alpha(accent, 0.12),
                      borderBottom: `1px solid ${alpha(accent, 0.18)}`,
                      borderLeft: `6px solid ${accent}`,
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography sx={{ fontWeight: 1000 }}>
                        {g.title}
                      </Typography>
                      <Chip
                        size="small"
                        label={g.title}
                        sx={{
                          fontWeight: 950,
                          borderRadius: 999,
                          bgcolor: alpha(accent, 0.16),
                          color: accent,
                          border: `1px solid ${alpha(accent, 0.3)}`,
                        }}
                      />
                    </Stack>
                  </Box>

                  {/* Body bullets */}
                  <Box sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      {g.body.map((t, idx) => (
                        <Stack
                          key={idx}
                          direction="row"
                          spacing={1.2}
                          alignItems="flex-start"
                        >
                          <Box
                            sx={{
                              width: 9,
                              height: 9,
                              borderRadius: 999,
                              bgcolor: accent,
                              mt: '6.5px',
                              flex: '0 0 auto',
                              boxShadow: `0 0 0 3px ${alpha(accent, 0.14)}`,
                            }}
                          />
                          <Typography
                            sx={{
                              fontWeight: 750,
                              color: 'text.secondary',
                              lineHeight: 1.45,
                            }}
                          >
                            {t}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.2 }}>
          <Button
            onClick={() => setBandDialogOpen(false)}
            variant="contained"
            sx={{
              borderRadius: `${RADIUS}px`,
              fontWeight: 950,
              boxShadow: 'none',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Severity/Probability scoring guide dialog */}
      <Dialog
        open={scoreGuideOpen}
        onClose={() => setScoreGuideOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: `${RADIUS}px` } }}
      >
        <DialogTitle sx={{ fontWeight: 950 }}>Scoring guide</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            {/* Severity */}
            <Box>
              <Typography sx={{ fontWeight: 1000, mb: 1 }}>
                Severity of harm
              </Typography>

              <Stack spacing={0.9}>
                {UNILEVER_SEVERITIES.map((s) => {
                  const accent = scoreAccent(s);
                  return (
                    <Box
                      key={s}
                      sx={{
                        borderRadius: `${RADIUS}px`,
                        border: `1px solid ${alpha(accent, 0.22)}`,
                        bgcolor: alpha(accent, 0.05),
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          px: 1.3,
                          py: 1.05,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderLeft: `6px solid ${accent}`,
                          bgcolor: alpha(accent, 0.1),
                          borderBottom: `1px solid ${alpha(accent, 0.16)}`,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="small"
                            label={`Score ${s}`}
                            sx={{
                              fontWeight: 950,
                              borderRadius: 999,
                              bgcolor: alpha(accent, 0.16),
                              color: accent,
                              border: `1px solid ${alpha(accent, 0.3)}`,
                            }}
                          />
                          <Typography sx={{ fontWeight: 950 }}>
                            {SEVERITY_DESC[s] ?? ''}
                          </Typography>
                        </Stack>
                      </Box>

                      <Box sx={{ p: 1.2 }}>
                        <Typography
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 700,
                            lineHeight: 1.45,
                          }}
                        >
                          {SEVERITY_DESC[s] ?? ''}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            {/* Probability */}
            <Box>
              <Typography sx={{ fontWeight: 1000, mb: 1 }}>
                Likelihood of harm
              </Typography>

              <Box
                sx={{
                  borderRadius: `${RADIUS}px`,
                  border: `1px solid ${alpha('#000', 0.08)}`,
                  bgcolor: alpha('#fff', 0.6),
                  overflow: 'hidden',
                }}
              >
                {/* Make it scroll-safe */}
                <Box sx={{ overflowX: 'auto' }}>
                  <Box sx={{ minWidth: 920 }}>
                    {/* Header (sticky) */}
                    <Box
                      sx={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        display: 'grid',
                        gridTemplateColumns: '140px 140px 1.3fr 1fr 1fr',
                        gap: 1,
                        p: 1.2,
                        borderBottom: `1px solid ${alpha('#000', 0.08)}`,
                        bgcolor: alpha('#000', 0.04),
                      }}
                    >
                      <Typography sx={{ fontWeight: 1000 }}>Score</Typography>
                      <Typography sx={{ fontWeight: 1000 }}>
                        Exposure
                      </Typography>
                      <Typography sx={{ fontWeight: 1000 }}>
                        Existing control
                      </Typography>
                      <Typography sx={{ fontWeight: 1000 }}>
                        Site experience
                      </Typography>
                      <Typography sx={{ fontWeight: 1000 }}>
                        Unilever experience
                      </Typography>
                    </Box>

                    {[10, 8, 6, 4, 2, 1].map((p, idx) => {
                      const g = PROB_GUIDE[p];
                      const accent = scoreAccent(p);

                      return (
                        <Box
                          key={p}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '140px 140px 1.3fr 1fr 1fr',
                            gap: 1,
                            p: 1.2,
                            borderBottom: `1px solid ${alpha('#000', 0.06)}`,
                            bgcolor:
                              idx % 2 === 0
                                ? alpha('#000', 0.015)
                                : 'transparent',
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ minWidth: 0 }}
                          >
                            <Chip
                              size="small"
                              label={p}
                              sx={{
                                fontWeight: 1000,
                                borderRadius: 999,
                                bgcolor: alpha(accent, 0.16),
                                color: accent,
                                border: `1px solid ${alpha(accent, 0.3)}`,
                              }}
                            />
                            <Typography
                              sx={{ fontWeight: 900, color: 'text.secondary' }}
                            >
                              {PROB_DESC[p]}
                            </Typography>
                          </Stack>

                          <Typography
                            sx={{ fontWeight: 700, color: 'text.secondary' }}
                          >
                            {g.exposure}
                          </Typography>
                          <Typography
                            sx={{ fontWeight: 700, color: 'text.secondary' }}
                          >
                            {g.existingControl}
                          </Typography>
                          <Typography
                            sx={{ fontWeight: 700, color: 'text.secondary' }}
                          >
                            {g.siteExperience}
                          </Typography>
                          <Typography
                            sx={{ fontWeight: 700, color: 'text.secondary' }}
                          >
                            {g.unileverExperience}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.2 }}>
          <Button
            onClick={() => setScoreGuideOpen(false)}
            variant="contained"
            sx={{
              borderRadius: `${RADIUS}px`,
              fontWeight: 950,
              boxShadow: 'none',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function RiskMatrix({
  severity,
  probability,
  theme,
  onPick,
}: {
  severity?: number;
  probability?: number;
  theme: any;
  onPick: (severity: number, probability: number) => void;
}) {
  const CELL = 44;
  const GAP = 4;
  const LEFT_W = 180;
  const RIGHT_W = 110;

  const sevIdx =
    severity != null ? UNILEVER_SEVERITIES.indexOf(severity as any) : -1;
  const probIdx =
    probability != null
      ? UNILEVER_PROBABILITIES.indexOf(probability as any)
      : -1;

  function colorMain(c: ChipColor) {
    const p: any = theme.palette;
    const map: Record<string, string> = {
      error: p.error.main,
      warning: p.warning.main,
      info: p.info.main,
      success: p.success.main,
      default: p.grey[600],
      primary: p.primary.main,
      secondary: p.secondary.main,
    };
    return map[c] ?? p.grey[600];
  }

  function cellBg(band: RiskBand) {
    const tone = bandChipColor(band) as ChipColor;
    return alpha(colorMain(tone), 0.16);
  }

  function cellBorder(band: RiskBand) {
    const tone = bandChipColor(band) as ChipColor;
    return alpha(colorMain(tone), 0.28);
  }

  const showPointer = sevIdx >= 0 && probIdx >= 0;

  const gridW = CELL * 6 + GAP * 5;
  const gridH = CELL * 6 + GAP * 5;

  return (
    <Box
      sx={{
        borderRadius: `${RADIUS}px`,
        border: `1px solid ${alpha('#000', 0.08)}`,
        bgcolor: alpha('#fff', 0.55),
        backdropFilter: 'blur(10px)',
        p: 1.2,
        overflowX: 'auto',
        msOverflowStyle: 'none', // IE and Edge
        scrollbarWidth: 'none', // Firefox
        '&::-webkit-scrollbar': {
          display: 'none', // Chrome, Safari, and Opera
        },
      }}
    >
      <Typography sx={{ fontWeight: 900, mb: 1 }}>Risk matrix</Typography>

      <Box sx={{ minWidth: LEFT_W + gridW + RIGHT_W + 24 }}>
        {/* Axis titles (top) */}
        <Stack direction="row" alignItems="center" sx={{ mb: 0.6 }}>
          <Box sx={{ width: LEFT_W }}>
            <Typography sx={{ fontWeight: 900, color: 'text.secondary' }}>
              Probability ↓
            </Typography>
          </Box>

          <Box sx={{ width: gridW, display: 'flex', justifyContent: 'center' }}>
            <Typography sx={{ fontWeight: 900, color: 'text.secondary' }}>
              Severity →
            </Typography>
          </Box>

          <Box sx={{ width: RIGHT_W }} />
        </Stack>

        {/* Severity numbers (top) */}
        <Stack direction="row" alignItems="center" sx={{ mb: 0.6 }}>
          <Box sx={{ width: LEFT_W }} />
          {UNILEVER_SEVERITIES.map((s) => (
            <Box
              key={`top-${s}`}
              sx={{
                width: CELL,
                textAlign: 'center',
                color: 'text.secondary',
                fontWeight: 850,
                fontSize: 12,
                mr:
                  s === UNILEVER_SEVERITIES[UNILEVER_SEVERITIES.length - 1]
                    ? 0
                    : `${GAP}px`,
              }}
              title={SEVERITY_DESC[s] ?? ''}
            >
              {s}
            </Box>
          ))}
          <Box sx={{ width: RIGHT_W }} />
        </Stack>

        <Stack direction="row" alignItems="flex-start">
          {/* Probability labels (left) */}
          <Box sx={{ width: LEFT_W }}>
            {UNILEVER_PROBABILITIES.map((p) => (
              <Box
                key={`left-${p}`}
                sx={{
                  height: CELL,
                  display: 'flex',
                  alignItems: 'center',
                  pr: 1,
                  mb: `${GAP}px`,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: 11,
                    color: 'text.secondary',
                    whiteSpace: 'normal',
                    lineHeight: 1.1,
                  }}
                >
                  {p} — {PROB_DESC[p]}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Grid */}
          <Box sx={{ position: 'relative', width: gridW, height: gridH }}>
            {/* row/col focus overlays */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: gridW,
                height: CELL,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderRadius: 12,
                transform: showPointer
                  ? `translate(0px, ${probIdx * (CELL + GAP)}px)`
                  : 'translate(0px,0px)',
                opacity: showPointer ? 1 : 0,
                transition:
                  'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 160ms ease',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: CELL,
                height: gridH,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderRadius: 12,
                transform: showPointer
                  ? `translate(${sevIdx * (CELL + GAP)}px, 0px)`
                  : 'translate(0px,0px)',
                opacity: showPointer ? 1 : 0,
                transition:
                  'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 160ms ease',
                pointerEvents: 'none',
              }}
            />

            <Box
              sx={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: `repeat(6, ${CELL}px)`,
                gridTemplateRows: `repeat(6, ${CELL}px)`,
                gap: `${GAP}px`,
              }}
            >
              {UNILEVER_PROBABILITIES.map((p) =>
                UNILEVER_SEVERITIES.map((s) => {
                  const band = unileverBand(s, p);
                  if (!band) return null;

                  const isRow =
                    showPointer &&
                    probIdx === UNILEVER_PROBABILITIES.indexOf(p);
                  const isCol =
                    showPointer && sevIdx === UNILEVER_SEVERITIES.indexOf(s);
                  const active = showPointer && isRow && isCol;

                  return (
                    <Box
                      key={`${p}-${s}`}
                      onClick={() => onPick(s, p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onPick(s, p);
                      }}
                      sx={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 10,
                        border: `1px solid ${cellBorder(band)}`,
                        bgcolor: cellBg(band),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        color: alpha('#000', 0.65),
                        outline: active
                          ? `2px solid ${alpha(theme.palette.text.primary, 0.55)}`
                          : 'none',
                        boxShadow: active
                          ? '0 10px 20px rgba(0,0,0,0.10)'
                          : 'none',
                        transform: active ? 'scale(1.03)' : 'scale(1)',
                        transition:
                          'transform 180ms ease, box-shadow 180ms ease, outline 180ms ease',
                        userSelect: 'none',
                        cursor: 'pointer',
                      }}
                      title={`Click to set: Severity ${s}, Probability ${p} (${bandAbbrev(band as any)}, ${unileverRating(s, p)})`}
                    >
                      {band === 'MEDIUM_PLUS'
                        ? 'M+'
                        : band === 'VERY_HIGH'
                          ? 'VH'
                          : band === 'VERY_LOW'
                            ? 'VL'
                            : band[0]}
                    </Box>
                  );
                }),
              )}
            </Box>

            {/* pointer border */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: CELL,
                height: CELL,
                borderRadius: 12,
                border: `2px solid ${alpha(theme.palette.text.primary, 0.65)}`,
                transform: showPointer
                  ? `translate(${sevIdx * (CELL + GAP)}px, ${probIdx * (CELL + GAP)}px)`
                  : 'translate(0px,0px)',
                opacity: showPointer ? 1 : 0,
                transition:
                  'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 160ms ease',
                pointerEvents: 'none',
              }}
            />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
