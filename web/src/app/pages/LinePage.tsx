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

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import {
  getMachinesDashboard,
  type MachineDashboardItem,
} from '../api/dashboard';
import { createMachine, deleteMachine, updateMachine } from '../api/machines';
import { apiJson } from '../api/http';
import { brand } from '../theme';

const RADIUS = 10;

type EditState = { id: string; name: string } | null;
type ConfirmDelete = { id: string; name: string } | null;

function statusFromCounts(c: any) {
  const total = Math.max(0, c.total ?? 0);
  const unassessed = Math.max(0, c.unassessed ?? 0);
  const assessed = Math.max(0, total - unassessed);

  if (total === 0)
    return { label: 'EMPTY', accent: alpha('#000', 0.22), fg: '#111' };
  if ((c.veryHigh ?? 0) > 0)
    return { label: 'VERY HIGH', accent: brand.heartRed, fg: '#fff' };
  if ((c.high ?? 0) > 0)
    return { label: 'HIGH', accent: brand.caramel, fg: '#111' };

  const med = (c.mediumPlus ?? 0) + (c.medium ?? 0);
  if (med > 0) return { label: 'MEDIUM', accent: brand.lemon, fg: '#111' };

  const incompleteRatio = total > 0 ? unassessed / total : 1;
  if (assessed === 0 || incompleteRatio >= 0.5)
    return { label: 'INCOMPLETE', accent: alpha('#000', 0.22), fg: '#111' };

  const veryLow = c.veryLow ?? 0;
  const safe = (c.low ?? 0) + veryLow;
  const safeRatio = assessed > 0 ? safe / assessed : 0;

  if (safeRatio >= 0.6) return { label: 'LOW', accent: brand.mint, fg: '#111' };
  return { label: 'MIXED', accent: alpha('#000', 0.22), fg: '#111' };
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
  keepSpace = false,
}: {
  label: string;
  value: number;
  accent: string;
  keepSpace?: boolean;
}) {
  if (!value && !keepSpace) return null;
  const hidden = !value;

  return (
    <Chip
      size="small"
      label={`${label}: ${value || 0}`}
      sx={{
        height: 26,
        borderRadius: `${RADIUS}px`,
        bgcolor: alpha(accent, 0.12),
        border: `1px solid ${alpha(accent, 0.22)}`,
        color: brand.corporateBlack,
        fontWeight: 850,
        '& .MuiChip-label': { px: 1.0 },
        visibility: hidden ? 'hidden' : 'visible',
      }}
    />
  );
}

function MiniStackBar({ c }: { c: any }) {
  const veryLow = c.veryLow ?? 0;
  const total = Math.max(1, c.total ?? 0);

  const segs = [
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
      {segs.map((s, i) => (
        <Box
          key={i}
          sx={{
            width: `${(Math.max(0, s.v) / total) * 100}%`,
            bgcolor: s.color,
          }}
        />
      ))}
    </Box>
  );
}

export default function LinePage() {
  const { lineId } = useParams<{ lineId: string }>();
  const nav = useNavigate();

  const [lineName, setLineName] = useState<string>('Line');
  const [machines, setMachines] = useState<MachineDashboardItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);

  const [edit, setEdit] = useState<EditState>(null);
  const [editErr, setEditErr] = useState<string | null>(null);

  const [confirmDel, setConfirmDel] = useState<ConfirmDelete>(null);

  const [busy, setBusy] = useState(false);

  const [toast, setToast] = useState<{
    open: boolean;
    msg: string;
    sev: 'success' | 'error';
  }>({
    open: false,
    msg: '',
    sev: 'success',
  });

  const glassCard = {
    borderRadius: `${RADIUS}px`,
    border: `1px solid ${alpha('#000', 0.08)}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    bgcolor: alpha('#fff', 0.74),
    backdropFilter: 'blur(10px)',
  } as const;

  async function reload(activeLineId: string) {
    setErr(null);
    try {
      const data = await getMachinesDashboard(activeLineId);
      setMachines(data);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load machines');
      setMachines([]);
    }
  }

  useEffect(() => {
    if (!lineId) return;

    let alive = true;
    setMachines(null);

    (async () => {
      setErr(null);
      try {
        try {
          const line = await apiJson<any>(
            `/lines/${encodeURIComponent(lineId)}`,
            {
              method: 'GET',
            },
          );
          if (alive && line?.name) setLineName(String(line.name));
        } catch {
          // ignore
        }

        const data = await getMachinesDashboard(lineId);
        if (!alive) return;
        setMachines(data ?? []);
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

  const filtered = useMemo(() => {
    if (!machines) return [];
    const s = q.trim().toLowerCase();
    if (!s) return machines;
    return machines.filter((m) => m.name.toLowerCase().includes(s));
  }, [machines, q]);

  if (!lineId) return null;

  return (
    <Box
      sx={{
        maxWidth: 1220,
        width: '100%',
        mr: 'auto',
        ml: 0,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1.25}
        sx={{ mb: 2 }}
      >
        {/* Left: back + title */}
        <Stack direction="row" gap={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => nav('/')}
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
            Dashboard
          </Button>

          <Typography
            sx={{
              fontWeight: 950,
              fontSize: { xs: 24, md: 32 },
              lineHeight: 1.05,
              letterSpacing: -0.4,
            }}
            noWrap
            title={lineName}
          >
            {lineName}
          </Typography>
        </Stack>

        {/* Right: search + count + add */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1}
          justifyContent="flex-end"
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            sx={{
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <TextField
              size="small"
              placeholder="Search machines…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{
                width: { xs: '100%', sm: 360 },
                '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS}px` },
                bgcolor: alpha('#fff', 0.55),
                backdropFilter: 'blur(10px)',
              }}
            />

            {/* ✅ count pill lives next to search (subtle) */}
            <Chip
              size="small"
              label={
                machines
                  ? q.trim()
                    ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
                    : `${machines.length} total`
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
            startIcon={<AddIcon />}
            onClick={() => {
              setAddErr(null);
              setNewName('');
              setOpenAdd(true);
            }}
            sx={{
              fontWeight: 950,
              height: 40,
              borderRadius: `${RADIUS}px`,
              boxShadow: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Add machine
          </Button>
        </Stack>
      </Stack>
      {!!err && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS}px` }}>
          {err}
        </Alert>
      )}
      {/* Content */}
      {!machines ? (
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
                <Skeleton width="65%" />
                <Skeleton width="45%" />
                <Skeleton
                  variant="rounded"
                  height={10}
                  sx={{ mt: 2, borderRadius: `${RADIUS}px` }}
                />
                <Skeleton
                  variant="rounded"
                  height={26}
                  sx={{ mt: 2, borderRadius: `${RADIUS}px` }}
                />
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={glassCard}>
          <CardContent sx={{ p: 2.2 }}>
            <Typography sx={{ fontWeight: 950 }}>No machines</Typography>
            <Typography
              sx={{ color: 'text.secondary', fontWeight: 700, mt: 0.6 }}
            >
              {q.trim()
                ? 'Try a different search.'
                : 'Add a machine to continue.'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenAdd(true)}
              sx={{
                mt: 1.4,
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                boxShadow: 'none',
              }}
            >
              Add machine
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
            alignItems: 'stretch',
          }}
        >
          {filtered.map((m) => {
            const c: any = m.counts;
            const st = statusFromCounts(c);
            const openMachine = () => nav(`/machines/${m.id}`);

            return (
              <Card
                key={m.id}
                sx={{
                  ...glassCard,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
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
                  onClick={openMachine}
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
                          title={m.name}
                        >
                          {m.name}
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.35,
                            color: 'text.secondary',
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          Steps <b>{c.total}</b> • Unassessed{' '}
                          <b>{c.unassessed}</b>
                        </Typography>
                      </Box>

                      <Stack direction="row" gap={0.8} alignItems="center">
                        <StatusPill
                          label={st.label}
                          accent={st.accent}
                          fg={st.fg}
                        />
                        <IconButton
                          size="small"
                          title="Open"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openMachine();
                          }}
                          sx={{ borderRadius: `${RADIUS}px` }}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Box sx={{ mt: 1.35 }}>
                      <MiniStackBar c={c} />
                    </Box>

                    <Divider
                      sx={{ my: 1.35, borderColor: alpha('#000', 0.08) }}
                    />

                    <Stack
                      direction="row"
                      gap={0.8}
                      flexWrap="wrap"
                      sx={{ minHeight: 26 * 2 + 8 }}
                    >
                      <MetricPill
                        label="Unassessed"
                        value={c.unassessed ?? 0}
                        accent={alpha('#000', 0.25)}
                        keepSpace
                      />
                      <MetricPill
                        label="Very high"
                        value={c.veryHigh ?? 0}
                        accent={brand.heartRed}
                      />
                      <MetricPill
                        label="High"
                        value={c.high ?? 0}
                        accent={brand.caramel}
                      />
                      <MetricPill
                        label="Medium"
                        value={(c.mediumPlus ?? 0) + (c.medium ?? 0)}
                        accent={brand.lemon}
                      />
                      <MetricPill
                        label="Low"
                        value={c.low ?? 0}
                        accent={brand.mint}
                      />
                      <MetricPill
                        label="Very low"
                        value={c.veryLow ?? 0}
                        accent={alpha(brand.mint, 0.6)}
                      />
                    </Stack>

                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      gap={0.5}
                      sx={{ mt: 'auto', pt: 1.25 }}
                    >
                      <IconButton
                        size="small"
                        title="Rename"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditErr(null);
                          setEdit({ id: m.id, name: m.name });
                        }}
                        sx={{ borderRadius: `${RADIUS}px` }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        title="Delete"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDel({ id: m.id, name: m.name });
                        }}
                        disabled={busy}
                        sx={{ borderRadius: `${RADIUS}px` }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}
      {/* Add machine dialog */}
      <Dialog
        open={openAdd}
        onClose={() => (!busy ? setOpenAdd(false) : undefined)}
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
        <DialogTitle sx={{ fontWeight: 950, pb: 1.1 }}>Add machine</DialogTitle>
        <DialogContent sx={{ pt: 0.25 }}>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (
                  document.getElementById(
                    'add-machine-confirm',
                  ) as HTMLButtonElement | null
                )?.click();
              }
            }}
            sx={{
              mt: 0.6,
              '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS}px` },
            }}
          />

          {addErr && (
            <Alert
              severity="error"
              sx={{ mt: 1.2, borderRadius: `${RADIUS}px` }}
            >
              {addErr}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.2 }}>
          <Button
            onClick={() => setOpenAdd(false)}
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
            id="add-machine-confirm"
            variant="contained"
            sx={{
              fontWeight: 950,
              borderRadius: `${RADIUS}px`,
              boxShadow: 'none',
            }}
            disabled={busy || !newName.trim()}
            onClick={async () => {
              const name = newName.trim();
              if (!name) return;

              setBusy(true);
              setAddErr(null);
              try {
                await createMachine(lineId, name);
                setNewName('');
                setOpenAdd(false);
                setToast({
                  open: true,
                  msg: `Machine created: ${name}`,
                  sev: 'success',
                });
                await reload(lineId);
              } catch (e: any) {
                setAddErr(e?.message ?? 'Failed to create machine');
                setToast({
                  open: true,
                  msg: e?.message ?? 'Failed to create machine',
                  sev: 'error',
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
      {/* Rename dialog */}
      <Dialog
        open={!!edit}
        onClose={() => (!busy ? setEdit(null) : undefined)}
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
        <DialogTitle sx={{ fontWeight: 950, pb: 1.1 }}>
          Rename machine
        </DialogTitle>
        <DialogContent sx={{ pt: 0.25 }}>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            value={edit?.name ?? ''}
            onChange={(e) =>
              setEdit((v) => (v ? { ...v, name: e.target.value } : v))
            }
            sx={{
              mt: 0.6,
              '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS}px` },
            }}
          />

          {editErr && (
            <Alert
              severity="error"
              sx={{ mt: 1.2, borderRadius: `${RADIUS}px` }}
            >
              {editErr}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.2 }}>
          <Button
            onClick={() => setEdit(null)}
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
            sx={{
              fontWeight: 950,
              borderRadius: `${RADIUS}px`,
              boxShadow: 'none',
            }}
            disabled={busy || !(edit?.name ?? '').trim()}
            onClick={async () => {
              if (!edit) return;
              const name = edit.name.trim();
              if (!name) return;

              setBusy(true);
              setEditErr(null);
              try {
                await updateMachine(edit.id, name);
                setEdit(null);
                setToast({
                  open: true,
                  msg: 'Machine renamed',
                  sev: 'success',
                });
                await reload(lineId);
              } catch (e: any) {
                setEditErr(e?.message ?? 'Failed to rename machine');
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
      {/* Delete confirm */}
      <Dialog
        open={!!confirmDel}
        onClose={() => (!busy ? setConfirmDel(null) : undefined)}
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
        <DialogTitle sx={{ fontWeight: 950, pb: 1.1 }}>
          Delete machine
        </DialogTitle>
        <DialogContent sx={{ pt: 0.25 }}>
          <Typography sx={{ fontWeight: 750 }}>
            Delete <b>{confirmDel?.name}</b>? This can’t be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.2 }}>
          <Button
            onClick={() => setConfirmDel(null)}
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
            color="error"
            sx={{
              fontWeight: 950,
              borderRadius: `${RADIUS}px`,
              boxShadow: 'none',
            }}
            disabled={busy}
            onClick={async () => {
              if (!confirmDel) return;
              setBusy(true);
              try {
                await deleteMachine(confirmDel.id);
                setConfirmDel(null);
                setToast({
                  open: true,
                  msg: 'Machine deleted',
                  sev: 'success',
                });
                await reload(lineId);
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
