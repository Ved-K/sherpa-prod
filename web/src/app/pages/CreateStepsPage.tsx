// src/app/pages/CreateStepsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
  Skeleton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DoneIcon from '@mui/icons-material/Done';

import { api } from '../api/client';
import { listStepsForTask, type Step } from '../api/steps';

type CreateStepBody = {
  stepNo?: number;
  title: string;
  method?: string;
  trainingLink?: string;
};

async function createStep(taskId: string, body: CreateStepBody) {
  return api<Step>(`/tasks/${taskId}/steps`, { method: 'POST', body });
}

async function bulkCreateSteps(
  taskId: string,
  steps: Array<{ title: string; method?: string; trainingLink?: string }>,
) {
  return api<void>(`/tasks/${taskId}/steps/bulk`, {
    method: 'POST',
    body: { steps },
  });
}

export default function CreateStepsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const taskIdStr = taskId ?? '';
  const nav = useNavigate();

  const [err, setErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);

  // single step form
  const [title, setTitle] = useState('');
  const [method, setMethod] = useState('');
  const [trainingLink, setTrainingLink] = useState('');
  const [savingOne, setSavingOne] = useState(false);

  // bulk
  const [bulkText, setBulkText] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);

  const canAddOne = title.trim().length > 0;
  const parsedBulk = useMemo(() => {
    // one step title per line
    return bulkText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((t) => ({ title: t }));
  }, [bulkText]);

  useEffect(() => {
    if (!taskIdStr) return;
    let alive = true;

    (async () => {
      setLoadingList(true);
      setErr(null);
      try {
        const s = await listStepsForTask(taskIdStr);
        if (!alive) return;
        setSteps((s ?? []).slice().sort((a, b) => a.stepNo - b.stepNo));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load steps');
        setSteps([]);
      } finally {
        if (alive) setLoadingList(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [taskIdStr]);

  if (!taskIdStr) {
    return (
      <Alert severity="error">
        Missing taskId in URL. Route should be <b>/tasks/:taskId/steps/new</b>
      </Alert>
    );
  }

  async function refresh() {
    const s = await listStepsForTask(taskIdStr);
    setSteps((s ?? []).slice().sort((a, b) => a.stepNo - b.stepNo));
  }

  async function onAddOne() {
    if (!canAddOne) return;

    setSavingOne(true);
    setErr(null);
    try {
      await createStep(taskIdStr, {
        title: title.trim(),
        method: method.trim() || undefined,
        trainingLink: trainingLink.trim() || undefined,
      });
      setTitle('');
      setMethod('');
      setTrainingLink('');
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to add step');
    } finally {
      setSavingOne(false);
    }
  }

  async function onAddBulk() {
    if (parsedBulk.length === 0) return;

    setSavingBulk(true);
    setErr(null);
    try {
      await bulkCreateSteps(taskIdStr, parsedBulk);
      setBulkText('');
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to add bulk steps');
    } finally {
      setSavingBulk(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        gap={2}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => nav(-1)}
              sx={{ borderRadius: 2 }}
            >
              Back
            </Button>

            <Typography
              sx={{
                fontWeight: 950,
                fontSize: { xs: 24, md: 32 },
                lineHeight: 1.05,
              }}
            >
              Add steps
            </Typography>
          </Stack>

          <Typography
            sx={{ mt: 0.8, color: 'text.secondary', fontWeight: 650 }}
          >
            Create the step list for this task. Then jump straight into
            assessment.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<DoneIcon />}
          onClick={() => nav(`/tasks/${taskIdStr}/assess`)}
          disabled={steps.length === 0}
          sx={{ borderRadius: 2, fontWeight: 900 }}
        >
          Start assessment
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
          gridTemplateColumns: { xs: '1fr', md: '1fr 420px' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* Left: existing steps */}
        <Card
          variant="outlined"
          sx={{ borderRadius: 3, boxShadow: 'none', borderColor: 'divider' }}
        >
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography sx={{ fontWeight: 950 }}>Current steps</Typography>
              <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>
                {loadingList ? '…' : `${steps.length} total`}
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {loadingList ? (
              <Stack spacing={1}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rounded"
                    height={64}
                    sx={{ borderRadius: 2 }}
                  />
                ))}
              </Stack>
            ) : steps.length === 0 ? (
              <Alert severity="info">
                No steps yet. Add at least one step to start assessing.
              </Alert>
            ) : (
              <Stack spacing={1}>
                {steps.map((s) => (
                  <Box
                    key={String(s.id)}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2.25,
                      p: 1.25,
                    }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      Step {s.stepNo}: {s.title}
                    </Typography>
                    {(s.method || s.trainingLink) && (
                      <Typography
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 650,
                          mt: 0.4,
                        }}
                      >
                        {s.method ? `Method: ${s.method}` : null}
                        {s.method && s.trainingLink ? ' • ' : null}
                        {s.trainingLink ? `Training: ${s.trainingLink}` : null}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Right: add forms */}
        <Stack spacing={2}>
          <Card
            variant="outlined"
            sx={{ borderRadius: 3, boxShadow: 'none', borderColor: 'divider' }}
          >
            <CardContent>
              <Typography sx={{ fontWeight: 950, mb: 1 }}>
                Add a step
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={1.2}>
                <TextField
                  label="Step title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Isolate energy and lockout"
                  autoFocus
                />
                <TextField
                  label="Method (optional)"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  multiline
                  minRows={2}
                />
                <TextField
                  label="Training link (optional)"
                  value={trainingLink}
                  onChange={(e) => setTrainingLink(e.target.value)}
                  placeholder="https://…"
                />

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={onAddOne}
                  disabled={savingOne || !canAddOne}
                  sx={{ borderRadius: 2, fontWeight: 900 }}
                >
                  {savingOne ? 'Adding…' : 'Add step'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card
            variant="outlined"
            sx={{ borderRadius: 3, boxShadow: 'none', borderColor: 'divider' }}
          >
            <CardContent>
              <Typography sx={{ fontWeight: 950, mb: 0.8 }}>
                Bulk add
              </Typography>
              <Typography
                sx={{ color: 'text.secondary', fontWeight: 650, mb: 1.5 }}
              >
                Paste one step title per line (we’ll auto-number them).
              </Typography>

              <Stack spacing={1.2}>
                <TextField
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Step title 1\nStep title 2\nStep title 3`}
                  multiline
                  minRows={6}
                />

                <Button
                  variant="outlined"
                  onClick={onAddBulk}
                  disabled={savingBulk || parsedBulk.length === 0}
                  sx={{ borderRadius: 2, fontWeight: 900 }}
                >
                  {savingBulk ? 'Adding…' : `Add ${parsedBulk.length} steps`}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}
