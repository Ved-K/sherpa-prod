import { useEffect, useMemo, useRef, useState } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fade,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { brand } from '../theme';
import { getLinesDashboard, type LineDashboardItem } from '../api/dashboard';
import { apiJson } from '../api/http';

// served from /public
const LICK_LINE_ANIM_SRC = '/lick-line-solid.json';
const RADIUS = 10;

// Local type to avoid TS “two types with same name” conflicts
type CreateLineResult = {
  id: string; // normalized to string
  name: string;
};

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFirstNameFallback(): string | null {
  const candidates: Array<string | null> = [
    localStorage.getItem('tmicc_first_name'),
    sessionStorage.getItem('tmicc_first_name'),
    localStorage.getItem('firstName'),
    sessionStorage.getItem('firstName'),
    localStorage.getItem('displayName'),
    sessionStorage.getItem('displayName'),
    localStorage.getItem('user'),
    sessionStorage.getItem('user'),
  ];

  for (const v of candidates) {
    if (!v) continue;

    try {
      const obj = JSON.parse(v);
      const name =
        obj?.firstName ??
        obj?.given_name ??
        obj?.givenName ??
        obj?.displayName ??
        obj?.name ??
        null;

      if (typeof name === 'string' && name.trim()) {
        return name.trim().split(/\s+/)[0] ?? null;
      }
    } catch {
      const s = v.trim();
      if (s) return s.split(/\s+/)[0] ?? null;
    }
  }

  return null;
}

/** weights for sorting attention */
function scoreLine(c: LineDashboardItem['counts']) {
  const veryLow = (c as any).veryLow ?? 0;
  return (
    (c.veryHigh ?? 0) * 10 +
    (c.high ?? 0) * 6 +
    (c.mediumPlus ?? 0) * 4 +
    (c.medium ?? 0) * 2 +
    (c.unassessed ?? 0) * 5 +
    (c.low ?? 0) * 1 +
    veryLow * 0.5
  );
}

/**
 * Status rules:
 * - Red/Orange/Yellow if any exist in those bands (even if incomplete).
 * - Grey if empty OR mostly unassessed OR mixed-but-not-majority-safe.
 * - Green only if assessed steps are majority Low/VeryLow and no Medium+ above.
 */
function statusFromCounts(c: LineDashboardItem['counts']) {
  const veryLow = (c as any).veryLow ?? 0;

  const total = Math.max(0, c.total ?? 0);
  const unassessed = Math.max(0, c.unassessed ?? 0);
  const assessed = Math.max(0, total - unassessed);

  const hasVeryHigh = (c.veryHigh ?? 0) > 0;
  const hasHigh = (c.high ?? 0) > 0;
  const hasMed = (c.mediumPlus ?? 0) + (c.medium ?? 0) > 0;

  if (total === 0) {
    return {
      label: 'EMPTY',
      accent: alpha('#000', 0.22),
      fg: '#111',
      tone: 'neutral' as const,
    };
  }

  // Urgent bands always win (even if lots unassessed)
  if (hasVeryHigh) {
    return {
      label: 'VERY HIGH',
      accent: brand.heartRed,
      fg: '#fff',
      tone: 'bad' as const,
    };
  }
  if (hasHigh) {
    return {
      label: 'HIGH',
      accent: brand.caramel,
      fg: '#111',
      tone: 'warn' as const,
    };
  }
  if (hasMed) {
    return {
      label: 'MEDIUM',
      accent: brand.lemon,
      fg: '#111',
      tone: 'mid' as const,
    };
  }

  // No VH/H/M left. Now decide if incomplete vs safe.
  const incompleteRatio = total > 0 ? unassessed / total : 1;
  if (assessed === 0 || incompleteRatio >= 0.5) {
    return {
      label: 'INCOMPLETE',
      accent: alpha('#000', 0.22),
      fg: '#111',
      tone: 'neutral' as const,
    };
  }

  const safe = (c.low ?? 0) + veryLow;
  const safeRatio = assessed > 0 ? safe / assessed : 0;

  // Green only if majority safe
  if (safeRatio >= 0.6) {
    return {
      label: 'LOW',
      accent: brand.mint,
      fg: '#111',
      tone: 'good' as const,
    };
  }

  return {
    label: 'MIXED',
    accent: alpha('#000', 0.22),
    fg: '#111',
    tone: 'neutral' as const,
  };
}

function StatusPill({
  label,
  accent,
  fg,
}: {
  label: string;
  accent: string;
  fg: string;
}) {
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        height: 26,
        borderRadius: `${RADIUS}px`,
        bgcolor: alpha(accent, 0.18),
        border: `1px solid ${alpha(accent, 0.35)}`,
        color: fg,
        fontWeight: 950,
        letterSpacing: 0.25,
        '& .MuiChip-label': { px: 1.0 },
      }}
    />
  );
}

function MetricPill({
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
        bgcolor: alpha(accent, 0.12),
        borderColor: alpha(accent, 0.28),
        color: brand.corporateBlack,
        fontWeight: 850,
        '& .MuiChip-label': { px: 1.0 },
      }}
    />
  );
}

function MiniStackBar({ c }: { c: LineDashboardItem['counts'] }) {
  const veryLow = (c as any).veryLow ?? 0;
  const total = Math.max(1, c.total ?? 0);

  // Unassessed must be grey.
  const segments = [
    { v: c.unassessed ?? 0, color: alpha('#000', 0.22) },
    { v: c.veryHigh ?? 0, color: brand.heartRed },
    { v: c.high ?? 0, color: brand.caramel },
    { v: c.mediumPlus ?? 0, color: brand.lemon },
    { v: c.medium ?? 0, color: brand.wafer },
    { v: c.low ?? 0, color: brand.mint },
    { v: veryLow, color: alpha(brand.mint, 0.55) },
  ];

  return (
    <Box
      sx={{
        height: 10,
        borderRadius: `${RADIUS}px`,
        overflow: 'hidden',
        bgcolor: alpha('#000', 0.03),
        border: `1px solid ${alpha('#000', 0.08)}`,
        display: 'flex',
      }}
      aria-hidden
    >
      {segments.map((s, idx) => (
        <Box
          key={idx}
          sx={{
            width: `${(Math.max(0, s.v) / total) * 100}%`,
            bgcolor: s.color,
          }}
        />
      ))}
    </Box>
  );
}

async function createLineApi(name: string): Promise<CreateLineResult> {
  const raw = await apiJson<any>('/lines', { method: 'POST', body: { name } });

  return {
    id: String(raw?.id ?? raw?.lineId ?? ''),
    name: String(raw?.name ?? name),
  };
}

function CreateLineDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: CreateLineResult) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSaving(false);
    setError(null);
  }, [open]);

  const canSubmit = name.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      setSaving(true);
      setError(null);
      const created = await createLineApi(name.trim());
      if (!created.id) throw new Error('Create line returned no id');
      onCreated(created);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create line');
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => (!saving ? onClose() : undefined)}
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
      <DialogTitle sx={{ fontWeight: 950, pb: 1.1 }}>Create line</DialogTitle>

      <DialogContent sx={{ pt: 0.25 }}>
        <TextField
          autoFocus
          fullWidth
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lick Line 1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          disabled={saving}
          sx={{
            mt: 0.6,
            '& .MuiOutlinedInput-root': {
              borderRadius: `${RADIUS}px`,
            },
          }}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 1.2, borderRadius: `${RADIUS}px` }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.2 }}>
        <Button
          onClick={onClose}
          disabled={saving}
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
          onClick={submit}
          disabled={!canSubmit}
          variant="contained"
          sx={{
            borderRadius: `${RADIUS}px`,
            fontWeight: 950,
            boxShadow: 'none',
          }}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DashboardPage() {
  const nav = useNavigate();

  // Intro
  const [introVisible, setIntroVisible] = useState(true);
  const [introFinished, setIntroFinished] = useState(false);
  const [lickAnimData, setLickAnimData] = useState<any>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  // Data
  const [lines, setLines] = useState<LineDashboardItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Create line
  const [createLineOpen, setCreateLineOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    open: boolean;
    msg: string;
    sev: 'success' | 'error';
  }>({
    open: false,
    msg: '',
    sev: 'success',
  });

  // Load intro lottie
  useEffect(() => {
    let alive = true;
    fetch(LICK_LINE_ANIM_SRC)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load intro animation');
        return r.json();
      })
      .then((json) => {
        if (alive) setLickAnimData(json);
      })
      .catch(() => {
        if (!alive) return;
        setIntroVisible(false);
        setIntroFinished(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Lottie completion
  useEffect(() => {
    if (!lickAnimData) return;
    if (!introVisible) return;

    let cancelled = false;
    let tries = 0;
    let cleanup: (() => void) | undefined;
    let t: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      if (cancelled) return;

      const item = lottieRef.current?.animationItem;
      if (!item) {
        tries += 1;
        if (tries < 40) t = setTimeout(attach, 40);
        else {
          setIntroVisible(false);
          setIntroFinished(true);
        }
        return;
      }

      const onComplete = () => {
        setIntroVisible(false);
        setIntroFinished(true);
      };

      item.addEventListener('complete', onComplete);
      cleanup = () => item.removeEventListener('complete', onComplete);
    };

    attach();

    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
      cleanup?.();
    };
  }, [lickAnimData, introVisible]);

  // Fetch after intro
  useEffect(() => {
    if (!introFinished) return;

    let alive = true;
    (async () => {
      try {
        setErr(null);
        setLines(null);
        const data = await getLinesDashboard();
        if (alive) setLines(data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load dashboard');
        setLines([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [introFinished]);

  const sorted = useMemo(() => {
    if (!lines) return [];
    return [...lines].sort((a, b) => scoreLine(b.counts) - scoreLine(a.counts));
  }, [lines]);

  const totals = useMemo(() => {
    if (!lines) return null;

    return lines.reduce(
      (acc, l) => {
        const c = l.counts as any;
        acc.lines += 1;
        acc.total += l.counts.total ?? 0;
        acc.unassessed += l.counts.unassessed ?? 0;
        acc.veryHigh += l.counts.veryHigh ?? 0;
        acc.high += l.counts.high ?? 0;
        acc.mediumPlus += l.counts.mediumPlus ?? 0;
        acc.medium += l.counts.medium ?? 0;
        acc.low += l.counts.low ?? 0;
        acc.veryLow += c.veryLow ?? 0;
        return acc;
      },
      {
        lines: 0,
        total: 0,
        unassessed: 0,
        veryHigh: 0,
        high: 0,
        mediumPlus: 0,
        medium: 0,
        low: 0,
        veryLow: 0,
      },
    );
  }, [lines]);

  const greeting = getTimeGreeting();
  const firstName = useMemo(() => getFirstNameFallback(), []);
  const title = firstName ? `${greeting}, ${firstName}` : greeting;

  const overallStatus = useMemo(() => {
    if (!totals) return null;
    const c: any = {
      total: totals.total,
      unassessed: totals.unassessed,
      veryHigh: totals.veryHigh,
      high: totals.high,
      mediumPlus: totals.mediumPlus,
      medium: totals.medium,
      low: totals.low,
      veryLow: totals.veryLow,
    };
    return statusFromCounts(c);
  }, [totals]);

  const glassCard = {
    borderRadius: `${RADIUS}px`,
    border: `1px solid ${alpha('#000', 0.08)}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    bgcolor: alpha('#fff', 0.74),
    backdropFilter: 'blur(10px)',
  } as const;

  const handleCreatedLine = (created: CreateLineResult) => {
    const newItem: LineDashboardItem = {
      id: created.id as any,
      name: created.name,
      counts: {
        total: 0,
        unassessed: 0,
        veryHigh: 0,
        high: 0,
        mediumPlus: 0,
        medium: 0,
        low: 0,
        // veryLow may exist in your backend counts; dashboard API will fill it later
        ...({ veryLow: 0 } as any),
      } as any,
    };

    setLines((prev) => (prev ? [newItem, ...prev] : [newItem]));
    setCreateLineOpen(false);
    setToast({
      open: true,
      msg: `Line created: ${created.name}`,
      sev: 'success',
    });
    nav(`/lines/${created.id}`);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        // subtle “premium” background
        bgcolor: alpha('#0b1220', 0.03),
        backgroundImage: `
          radial-gradient(900px 420px at 12% 6%, ${alpha(brand.mint, 0.14)} 0%, transparent 60%),
          radial-gradient(780px 360px at 92% 10%, ${alpha(brand.lemon, 0.14)} 0%, transparent 62%),
          radial-gradient(860px 420px at 86% 88%, ${alpha(brand.caramel, 0.14)} 0%, transparent 62%)
        `,
      }}
    >
      {/* Intro overlay */}
      <Fade in={introVisible} timeout={360} appear unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'background.default',
          }}
        >
          <Box
            sx={{
              width: 'min(860px, 92vw)',
              display: 'grid',
              placeItems: 'center',
              gap: 1.2,
            }}
          >
            <Box sx={{ width: 'min(760px, 92vw)', height: 220 }}>
              {lickAnimData ? (
                <Lottie
                  lottieRef={lottieRef}
                  animationData={lickAnimData}
                  loop={false}
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Skeleton
                  variant="rounded"
                  width="100%"
                  height="100%"
                  sx={{ borderRadius: `${RADIUS}px` }}
                />
              )}
            </Box>

            <Typography
              sx={{
                fontWeight: 750,
                color: 'text.secondary',
                letterSpacing: 0.2,
              }}
            >
              Loading…
            </Typography>
          </Box>
        </Box>
      </Fade>

      {/* Main */}
      <Box
        sx={{
          px: { xs: 2, md: 3.5 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 3, md: 4 },
        }}
      >
        <Box sx={{ maxWidth: 1220, mx: 'auto' }}>
          {/* Header */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            gap={1.4}
            sx={{ mb: 2 }}
          >
            <Typography
              sx={{
                fontWeight: 950,
                letterSpacing: -0.6,
                fontSize: { xs: 30, md: 40 },
                lineHeight: 1.12,
              }}
            >
              {title}
            </Typography>

            <Stack
              direction="row"
              gap={1}
              justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
            >
              <Button
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={() => nav('/start')}
                sx={{
                  borderRadius: `${RADIUS}px`,
                  fontWeight: 900,
                  borderColor: alpha('#000', 0.18),
                  bgcolor: alpha('#fff', 0.55),
                  backdropFilter: 'blur(10px)',
                }}
              >
                Start
              </Button>

              <Button
                variant="contained"
                onClick={() => nav('/tasks/new')}
                sx={{
                  borderRadius: `${RADIUS}px`,
                  fontWeight: 950,
                  boxShadow: 'none',
                }}
              >
                New task
              </Button>

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setCreateLineOpen(true)}
                sx={{
                  borderRadius: `${RADIUS}px`,
                  fontWeight: 950,
                  borderColor: alpha('#000', 0.18),
                  bgcolor: alpha('#fff', 0.55),
                  backdropFilter: 'blur(10px)',
                }}
              >
                New line
              </Button>
            </Stack>
          </Stack>

          {!!err && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS}px` }}>
              {err}
            </Alert>
          )}

          {/* Overview */}
          {lines && totals && overallStatus && (
            <Card sx={{ ...glassCard, mb: 2 }}>
              <CardContent sx={{ py: 1.35 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  gap={1.2}
                >
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <StatusPill
                      label={overallStatus.label}
                      accent={overallStatus.accent}
                      fg={overallStatus.fg}
                    />
                    <Typography sx={{ fontWeight: 950 }}>
                      {totals.lines} lines • {totals.total} steps •{' '}
                      {totals.unassessed} unassessed
                    </Typography>
                  </Stack>

                  <Stack
                    direction="row"
                    gap={0.8}
                    flexWrap="wrap"
                    justifyContent="flex-end"
                  >
                    <MetricPill
                      label="Unassessed"
                      value={totals.unassessed}
                      accent={alpha('#000', 0.25)}
                    />
                    <MetricPill
                      label="Very high"
                      value={totals.veryHigh}
                      accent={brand.heartRed}
                    />
                    <MetricPill
                      label="High"
                      value={totals.high}
                      accent={brand.caramel}
                    />
                    <MetricPill
                      label="Medium"
                      value={totals.mediumPlus + totals.medium}
                      accent={brand.lemon}
                    />
                    <MetricPill
                      label="Low"
                      value={totals.low}
                      accent={brand.mint}
                    />
                    <MetricPill
                      label="Very low"
                      value={totals.veryLow}
                      accent={alpha(brand.mint, 0.6)}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {!lines && (
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
                <Card key={i} sx={glassCard}>
                  <CardContent sx={{ p: 2 }}>
                    <Skeleton variant="text" width="62%" />
                    <Skeleton variant="text" width="42%" />
                    <Skeleton
                      variant="rounded"
                      height={10}
                      sx={{ mt: 2, borderRadius: `${RADIUS}px` }}
                    />
                    <Skeleton
                      variant="rounded"
                      height={34}
                      sx={{ mt: 2, borderRadius: `${RADIUS}px` }}
                    />
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}

          {/* Empty */}
          {lines && lines.length === 0 && (
            <Card sx={glassCard}>
              <CardContent sx={{ p: 2.2 }}>
                <Typography sx={{ fontWeight: 950 }}>No lines</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{
                    mt: 1.4,
                    borderRadius: `${RADIUS}px`,
                    fontWeight: 950,
                    boxShadow: 'none',
                  }}
                  onClick={() => setCreateLineOpen(true)}
                >
                  New line
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tiles */}
          {lines && lines.length > 0 && (
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
              {sorted.map((line) => {
                const c: any = line.counts;
                const veryLow = c.veryLow ?? 0;

                const score = scoreLine(line.counts);
                const st = statusFromCounts(line.counts);

                return (
                  <Card
                    key={line.id}
                    sx={{
                      ...glassCard,
                      position: 'relative',
                      transition:
                        'transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        borderColor: alpha(st.accent, 0.42),
                        boxShadow: '0 12px 30px rgba(0,0,0,0.10)',
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
                        bgcolor: st.accent,
                        opacity: 0.95,
                      }}
                    />

                    <CardActionArea
                      onClick={() => nav(`/lines/${line.id}`)}
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
                              title={line.name}
                            >
                              {line.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                mt: 0.45,
                                color: 'text.secondary',
                                fontWeight: 650,
                              }}
                            >
                              Score <b>{score}</b> • Steps{' '}
                              <b>{line.counts.total}</b> • Unassessed{' '}
                              <b>{line.counts.unassessed}</b>
                            </Typography>
                          </Box>

                          <StatusPill
                            label={st.label}
                            accent={st.accent}
                            fg={st.fg}
                          />
                        </Stack>

                        <Box sx={{ mt: 1.35 }}>
                          <MiniStackBar c={line.counts} />
                        </Box>

                        <Divider
                          sx={{ my: 1.35, borderColor: alpha('#000', 0.08) }}
                        />

                        <Stack direction="row" gap={0.8} flexWrap="wrap">
                          <MetricPill
                            label="Unassessed"
                            value={line.counts.unassessed}
                            accent={alpha('#000', 0.25)}
                          />
                          <MetricPill
                            label="Very high"
                            value={line.counts.veryHigh}
                            accent={brand.heartRed}
                          />
                          <MetricPill
                            label="High"
                            value={line.counts.high}
                            accent={brand.caramel}
                          />
                          <MetricPill
                            label="Medium"
                            value={
                              (line.counts.mediumPlus ?? 0) +
                              (line.counts.medium ?? 0)
                            }
                            accent={brand.lemon}
                          />
                          <MetricPill
                            label="Low"
                            value={line.counts.low}
                            accent={brand.mint}
                          />
                          <MetricPill
                            label="Very low"
                            value={veryLow}
                            accent={alpha(brand.mint, 0.6)}
                          />
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

      {/* Create Line modal */}
      <CreateLineDialog
        open={createLineOpen}
        onClose={() => setCreateLineOpen(false)}
        onCreated={handleCreatedLine}
      />

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
