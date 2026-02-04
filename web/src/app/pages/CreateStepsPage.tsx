// src/app/pages/CreateStepsPage.tsx
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DoneIcon from '@mui/icons-material/Done';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';

import { api } from '../api/client';
import { listStepsForTask, type Step } from '../api/steps';
import { brand } from '../theme';

const RADIUS = 10;

type StepPatch = {
  title?: string;
  trainingLink?: string | null;
  stepNo?: number;
};

async function bulkCreateSteps(
  taskId: string,
  steps: Array<{ title: string; trainingLink?: string }>,
) {
  return api<void>(`/tasks/${taskId}/steps/bulk`, {
    method: 'POST',
    body: { steps },
  });
}

/**
 * NOTE: If your backend uses different routes for steps, update ONLY these two fns.
 * Common patterns:
 *  - PATCH /steps/:id
 *  - DELETE /steps/:id
 */
async function patchStep(stepId: string, body: StepPatch) {
  return api<Step>(`/steps/${stepId}`, { method: 'PATCH', body });
}
async function removeStep(stepId: string) {
  return api<void>(`/steps/${stepId}`, { method: 'DELETE' });
}

type NewRow = {
  key: string;
  desc: string;
  trainingLink: string;
};

function newKey() {
  return (
    globalThis?.crypto?.randomUUID?.() ?? `k_${Date.now()}_${Math.random()}`
  );
}

function makeBlankRow(): NewRow {
  return { key: newKey(), desc: '', trainingLink: '' };
}

function moveItem<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export default function CreateStepsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const taskIdStr = taskId ?? '';
  const nav = useNavigate();

  const [err, setErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);

  // current list order
  const [ordered, setOrdered] = useState<Step[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const orderChanged = useMemo(() => {
    if (!steps.length || !ordered.length) return false;
    if (steps.length !== ordered.length) return true;
    const a = steps.map((s) => String(s.id)).join('|');
    const b = ordered.map((s) => String(s.id)).join('|');
    return a !== b;
  }, [steps, ordered]);

  // edit current step
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editTraining, setEditTraining] = useState('');

  // delete current step
  const [confirmDel, setConfirmDel] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // new rows builder (append)
  const [rows, setRows] = useState<NewRow[]>([makeBlankRow()]);
  const validNew = useMemo(() => {
    return rows
      .map((r) => ({
        title: r.desc.trim(),
        trainingLink: r.trainingLink.trim(),
      }))
      .filter((r) => r.title.length > 0)
      .map((r) => ({
        title: r.title,
        trainingLink: r.trainingLink || undefined,
      }));
  }, [rows]);

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

  async function refresh() {
    const s = await listStepsForTask(taskIdStr);
    const sorted = (s ?? [])
      .slice()
      .sort((a, b) => (a.stepNo ?? 0) - (b.stepNo ?? 0));
    setSteps(sorted);
    setOrdered(sorted);
  }

  useEffect(() => {
    if (!taskIdStr) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const s = await listStepsForTask(taskIdStr);
        if (!alive) return;
        const sorted = (s ?? [])
          .slice()
          .sort((a, b) => (a.stepNo ?? 0) - (b.stepNo ?? 0));
        setSteps(sorted);
        setOrdered(sorted);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load steps');
        setSteps([]);
        setOrdered([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [taskIdStr]);

  if (!taskIdStr) {
    return (
      <Alert severity="error" sx={{ borderRadius: `${RADIUS}px` }}>
        Missing taskId in URL. Route should be <b>/tasks/:taskId/steps/new</b>
      </Alert>
    );
  }

  // --- drag & drop current list ---
  function onDragStart(e: DragEvent, id: string) {
    if (busy) return;
    setDragId(id);
    setOverId(null);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', id);
    } catch {
      // ignore
    }
  }

  function onDragOver(e: DragEvent, id: string) {
    if (!dragId || busy) return;
    e.preventDefault();
    if (id !== dragId) setOverId(id);
  }

  function onDrop(e: DragEvent, id: string) {
    if (!dragId || busy) return;
    e.preventDefault();

    const from = (() => {
      try {
        return e.dataTransfer.getData('text/plain') || dragId;
      } catch {
        return dragId;
      }
    })();

    if (!from || from === id) return;

    setOrdered((prev) => {
      const a = prev.findIndex((s) => String(s.id) === String(from));
      const b = prev.findIndex((s) => String(s.id) === String(id));
      if (a < 0 || b < 0) return prev;
      return moveItem(prev, a, b);
    });

    setOverId(null);
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  async function saveOrder() {
    if (!orderChanged) return;

    setBusy(true);
    setErr(null);
    try {
      for (let i = 0; i < ordered.length; i++) {
        const s = ordered[i];
        const desired = i + 1;
        if ((s.stepNo ?? 0) === desired) continue;
        await patchStep(String(s.id), { stepNo: desired });
      }
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save order');
    } finally {
      setBusy(false);
    }
  }

  // --- edit/delete current steps ---
  function beginEdit(s: Step) {
    setErr(null);
    setEditId(String(s.id));
    setEditDesc(String(s.title ?? ''));
    setEditTraining(String(s.trainingLink ?? ''));
  }

  async function saveEdit() {
    if (!editId) return;
    const title = editDesc.trim();
    if (!title) {
      setErr('Description is required.');
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      await patchStep(editId, {
        title,
        trainingLink: editTraining.trim() || null,
      });
      setEditId(null);
      setEditDesc('');
      setEditTraining('');
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update step');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteNow() {
    if (!confirmDel) return;
    setBusy(true);
    setErr(null);
    try {
      await removeStep(confirmDel.id);
      setConfirmDel(null);
      if (editId === confirmDel.id) {
        setEditId(null);
        setEditDesc('');
        setEditTraining('');
      }
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete step');
    } finally {
      setBusy(false);
    }
  }

  // --- new rows builder ---
  function addRow() {
    setRows((p) => [...p, makeBlankRow()]);
  }
  function removeRow(key: string) {
    setRows((p) => {
      const next = p.filter((r) => r.key !== key);
      return next.length ? next : [makeBlankRow()];
    });
  }
  function setRow(key: string, patch: Partial<NewRow>) {
    setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function saveNewRows() {
    if (validNew.length === 0) return;

    setBusy(true);
    setErr(null);
    try {
      await bulkCreateSteps(taskIdStr, validNew);
      setRows([makeBlankRow()]);
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to add steps');
    } finally {
      setBusy(false);
    }
  }

  async function startAssessment() {
    if (validNew.length > 0) {
      await saveNewRows();
    }
    const hasAny = steps.length > 0 || validNew.length > 0;
    if (!hasAny) return;
    nav(`/tasks/${taskIdStr}/assess`);
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
      <Box sx={{ px: { xs: 2, md: 3.5 }, py: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
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
                  disabled={busy}
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
              Steps
            </Typography>

            <Chip
              size="small"
              label={loading ? '…' : `${ordered.length}`}
              sx={{
                height: 26,
                borderRadius: `${RADIUS}px`,
                bgcolor: alpha('#fff', 0.55),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha('#000', 0.1)}`,
                fontWeight: 900,
              }}
            />
          </Stack>

          <Stack direction="row" gap={1} alignItems="center">
            <Tooltip title="Save order" arrow>
              <span>
                <IconButton
                  onClick={saveOrder}
                  disabled={busy || loading || !orderChanged}
                  sx={{
                    borderRadius: `${RADIUS}px`,
                    border: `1px solid ${alpha('#000', 0.1)}`,
                    bgcolor: alpha('#fff', 0.52),
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <SaveIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={<DoneIcon />}
              onClick={startAssessment}
              disabled={busy || (steps.length === 0 && validNew.length === 0)}
              sx={{
                borderRadius: `${RADIUS}px`,
                fontWeight: 950,
                boxShadow: 'none',
                height: 40,
              }}
            >
              Assess
            </Button>
          </Stack>
        </Stack>

        {!!err && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS}px` }}>
            {err}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            // ✅ make the Add/Create column bigger on large screens
            gridTemplateColumns: {
              xs: '1fr',
              lg: 'minmax(0, 1.15fr) minmax(0, 1fr)',
              xl: 'minmax(0, 1.1fr) minmax(0, 1.05fr)',
            },
            alignItems: 'start',
          }}
        >
          {/* Current steps */}
          <Card sx={glassCard}>
            <CardContent sx={{ p: { xs: 2, md: 2.2 } }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography sx={{ fontWeight: 950 }}>Current</Typography>
                <Chip
                  size="small"
                  label={orderChanged ? 'unsaved' : 'saved'}
                  sx={{
                    height: 24,
                    borderRadius: `${RADIUS}px`,
                    bgcolor: alpha(
                      orderChanged ? brand.caramel : brand.mint,
                      0.12,
                    ),
                    border: `1px solid ${alpha(orderChanged ? brand.caramel : brand.mint, 0.22)}`,
                    fontWeight: 850,
                  }}
                />
              </Stack>

              <Divider sx={{ my: 1.4, borderColor: alpha('#000', 0.08) }} />

              {loading ? (
                <Stack spacing={1}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      variant="rounded"
                      height={56}
                      sx={{ borderRadius: `${RADIUS}px` }}
                    />
                  ))}
                </Stack>
              ) : ordered.length === 0 ? (
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
                  No steps yet.
                </Alert>
              ) : (
                <Stack spacing={1}>
                  {ordered.map((s, idx) => {
                    const id = String(s.id);
                    const isEditing = editId === id;
                    const isOver = overId === id && dragId && dragId !== id;

                    return (
                      <Box
                        key={id}
                        onDragOver={(e) => onDragOver(e, id)}
                        onDrop={(e) => onDrop(e, id)}
                        sx={{
                          border: `1px solid ${
                            isOver
                              ? alpha(brand.caramel, 0.55)
                              : alpha('#000', 0.08)
                          }`,
                          borderRadius: `${RADIUS}px`,
                          bgcolor: alpha('#fff', 0.55),
                          backdropFilter: 'blur(10px)',
                          p: 1.1,
                          outline: isOver
                            ? `2px solid ${alpha(brand.caramel, 0.18)}`
                            : 'none',
                        }}
                      >
                        <Stack direction="row" alignItems="flex-start" gap={1}>
                          <Tooltip title="Drag" arrow>
                            <Box
                              draggable={!busy}
                              onDragStart={(e) => onDragStart(e, id)}
                              onDragEnd={onDragEnd}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 34,
                                height: 34,
                                borderRadius: `${RADIUS}px`,
                                border: `1px solid ${alpha('#000', 0.1)}`,
                                bgcolor: alpha('#fff', 0.62),
                                cursor: busy ? 'not-allowed' : 'grab',
                                '&:active': { cursor: 'grabbing' },
                                flex: '0 0 auto',
                              }}
                            >
                              <DragIndicatorIcon fontSize="small" />
                            </Box>
                          </Tooltip>

                          <Chip
                            size="small"
                            label={idx + 1}
                            sx={{
                              height: 26,
                              borderRadius: `${RADIUS}px`,
                              bgcolor: alpha('#000', 0.05),
                              border: `1px solid ${alpha('#000', 0.08)}`,
                              fontWeight: 950,
                              flex: '0 0 auto',
                              mt: 0.25,
                            }}
                          />

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            {!isEditing ? (
                              <>
                                <Typography
                                  sx={{ fontWeight: 900 }}
                                  noWrap
                                  title={s.title}
                                >
                                  {s.title}
                                </Typography>

                                {s.trainingLink ? (
                                  <Stack
                                    direction="row"
                                    gap={0.6}
                                    alignItems="center"
                                    sx={{ mt: 0.35 }}
                                  >
                                    <LinkIcon
                                      sx={{
                                        fontSize: 16,
                                        color: alpha('#000', 0.55),
                                      }}
                                    />
                                    <Typography
                                      sx={{
                                        color: 'text.secondary',
                                        fontWeight: 650,
                                        fontSize: 13,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                      title={String(s.trainingLink)}
                                    >
                                      {String(s.trainingLink)}
                                    </Typography>
                                  </Stack>
                                ) : null}
                              </>
                            ) : (
                              <Stack spacing={1} sx={{ pr: 1 }}>
                                {/* ✅ auto-grow edit description */}
                                <TextField
                                  label="Description"
                                  value={editDesc}
                                  onChange={(e) => setEditDesc(e.target.value)}
                                  fullWidth
                                  disabled={busy}
                                  multiline
                                  minRows={2}
                                  maxRows={10}
                                  sx={inputSx}
                                />
                                <TextField
                                  label="Training link (optional)"
                                  value={editTraining}
                                  onChange={(e) =>
                                    setEditTraining(e.target.value)
                                  }
                                  fullWidth
                                  disabled={busy}
                                  sx={inputSx}
                                />
                              </Stack>
                            )}
                          </Box>

                          <Stack
                            direction="row"
                            gap={0.5}
                            alignItems="center"
                            sx={{ flex: '0 0 auto' }}
                          >
                            {!isEditing ? (
                              <>
                                <Tooltip title="Edit" arrow>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => beginEdit(s)}
                                      disabled={busy}
                                      sx={{
                                        borderRadius: `${RADIUS}px`,
                                        border: `1px solid ${alpha('#000', 0.1)}`,
                                        bgcolor: alpha('#fff', 0.62),
                                      }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Tooltip title="Delete" arrow>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        setConfirmDel({
                                          id,
                                          title: String(s.title ?? 'Step'),
                                        })
                                      }
                                      disabled={busy}
                                      sx={{
                                        borderRadius: `${RADIUS}px`,
                                        border: `1px solid ${alpha('#000', 0.1)}`,
                                        bgcolor: alpha('#fff', 0.62),
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <Tooltip title="Save" arrow>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={saveEdit}
                                      disabled={busy}
                                      sx={{
                                        borderRadius: `${RADIUS}px`,
                                        border: `1px solid ${alpha(brand.mint, 0.35)}`,
                                        bgcolor: alpha(brand.mint, 0.12),
                                      }}
                                    >
                                      <CheckIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Tooltip title="Cancel" arrow>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setEditId(null);
                                        setEditDesc('');
                                        setEditTraining('');
                                      }}
                                      disabled={busy}
                                      sx={{
                                        borderRadius: `${RADIUS}px`,
                                        border: `1px solid ${alpha('#000', 0.1)}`,
                                        bgcolor: alpha('#fff', 0.62),
                                      }}
                                    >
                                      <CloseIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </>
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Add new steps */}
          <Card sx={glassCard}>
            <CardContent sx={{ p: { xs: 2, md: 2.4 } }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography sx={{ fontWeight: 950 }}>Add Step</Typography>

                <Stack direction="row" gap={0.8} alignItems="center">
                  <Tooltip title="Next step" arrow>
                    <span>
                      <IconButton
                        onClick={addRow}
                        disabled={busy}
                        sx={{
                          borderRadius: `${RADIUS}px`,
                          border: `1px solid ${alpha('#000', 0.1)}`,
                          bgcolor: alpha('#fff', 0.52),
                          backdropFilter: 'blur(10px)',
                        }}
                      >
                        <AddIcon />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip title="Save new steps" arrow>
                    <span>
                      <IconButton
                        onClick={saveNewRows}
                        disabled={busy || validNew.length === 0}
                        sx={{
                          borderRadius: `${RADIUS}px`,
                          border: `1px solid ${alpha('#000', 0.1)}`,
                          bgcolor: alpha('#fff', 0.52),
                          backdropFilter: 'blur(10px)',
                        }}
                      >
                        <SaveIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              <Divider sx={{ my: 1.4, borderColor: alpha('#000', 0.08) }} />

              <Stack spacing={1}>
                {rows.map((r, idx) => (
                  <Box
                    key={r.key}
                    sx={{
                      border: `1px solid ${alpha('#000', 0.08)}`,
                      borderRadius: `${RADIUS}px`,
                      bgcolor: alpha('#fff', 0.55),
                      backdropFilter: 'blur(10px)',
                      p: 1.1,
                    }}
                  >
                    <Stack direction="row" gap={1} alignItems="flex-start">
                      <Chip
                        size="small"
                        label={idx + 1}
                        sx={{
                          height: 26,
                          borderRadius: `${RADIUS}px`,
                          bgcolor: alpha('#000', 0.05),
                          border: `1px solid ${alpha('#000', 0.08)}`,
                          fontWeight: 950,
                          flex: '0 0 auto',
                          mt: 0.25,
                        }}
                      />

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* ✅ auto-grow description */}
                        <TextField
                          label="Description"
                          fullWidth
                          value={r.desc}
                          onChange={(e) =>
                            setRow(r.key, { desc: e.target.value })
                          }
                          disabled={busy}
                          multiline
                          minRows={2}
                          maxRows={10}
                          sx={inputSx}
                        />
                        <TextField
                          label="Training link (optional)"
                          fullWidth
                          value={r.trainingLink}
                          onChange={(e) =>
                            setRow(r.key, { trainingLink: e.target.value })
                          }
                          disabled={busy}
                          sx={{ mt: 1, ...inputSx }}
                        />
                      </Box>

                      <Tooltip title="Remove row" arrow>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => removeRow(r.key)}
                            disabled={busy}
                            sx={{
                              borderRadius: `${RADIUS}px`,
                              border: `1px solid ${alpha('#000', 0.1)}`,
                              bgcolor: alpha('#fff', 0.62),
                              flex: '0 0 auto',
                              mt: 0.2,
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Box>
                ))}
              </Stack>

              <Stack
                direction="row"
                gap={1}
                justifyContent="flex-end"
                sx={{ mt: 1.5 }}
              >
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={saveNewRows}
                  disabled={busy || validNew.length === 0}
                  sx={{
                    borderRadius: `${RADIUS}px`,
                    fontWeight: 950,
                    boxShadow: 'none',
                    height: 40,
                  }}
                >
                  Save
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Delete confirm */}
        <Dialog
          open={!!confirmDel}
          onClose={() => {
            if (!busy) setConfirmDel(null);
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ fontWeight: 950 }}>Delete step</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontWeight: 750 }}>
              Delete <b>{confirmDel?.title}</b>? This can’t be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.2 }}>
            <Button
              onClick={() => setConfirmDel(null)}
              disabled={busy}
              variant="outlined"
              sx={{ borderRadius: `${RADIUS}px`, fontWeight: 900 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy}
              onClick={confirmDeleteNow}
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
      </Box>
    </Box>
  );
}
