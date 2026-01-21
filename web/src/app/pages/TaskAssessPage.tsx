import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Skeleton,
  Stack,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { api } from '../api/client';
import { listStepsForTask, type Step } from '../api/steps';
import { getStepsDashboard, type StepDashboardItem } from '../api/dashboard';

type Task = {
  id: string;
  name: string;
  description?: string | null;
  trainingLink?: string | null;
};

async function getTaskOptional(taskId: string) {
  return api<Task>(`/tasks/${taskId}`);
}

export default function TaskAssessPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const nav = useNavigate();

  const taskIdStr = taskId ?? '';
  const [task, setTask] = useState<Task | null>(null);

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [stepDash, setStepDash] = useState<StepDashboardItem[] | null>(null);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!taskIdStr) return;

    let alive = true;

    (async () => {
      setErr(null);
      setTask(null);
      setSteps(null);
      setStepDash(null);

      try {
        // Steps are required. Task details are optional.
        const [s, dash] = await Promise.all([
          listStepsForTask(taskIdStr),
          getStepsDashboard(taskIdStr),
        ]);

        if (!alive) return;

        const sorted = (s ?? []).slice().sort((a, b) => a.stepNo - b.stepNo);
        setSteps(sorted);
        setStepDash(dash ?? []);

        if (sorted.length === 0) {
          nav(`/tasks/${taskIdStr}/steps/new`, { replace: true });
          return;
        }

        // Optional task details fetch (don’t error the page if this fails)
        try {
          const t = await getTaskOptional(taskIdStr);
          if (alive) setTask(t);
        } catch {
          // ignore
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'Failed to load assessment setup');
        setSteps([]);
        setStepDash([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [taskIdStr, nav]);

  const sortedSteps = useMemo(() => steps ?? [], [steps]);

  // Progress: only show when there is actual assessed data (i.e., at least 1 step not unassessed)
  const total = stepDash?.length ?? 0;
  const unassessed = stepDash
    ? stepDash.filter((x) => x.counts.unassessed > 0).length
    : 0;
  const assessed = total - unassessed;
  const started = total > 0 && assessed > 0;
  const pct = total > 0 ? Math.round((assessed / total) * 100) : 0;

  if (!taskIdStr) {
    return (
      <Alert severity="error">
        Missing taskId in URL. Expected <b>/tasks/:taskId/assess</b>
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 950,
              fontSize: { xs: 26, md: 34 },
              lineHeight: 1.1,
            }}
          >
            {task?.name ?? 'Risk assessment'}
          </Typography>
          <Typography
            sx={{ color: 'text.secondary', fontWeight: 650, mt: 0.6 }}
          >
            Review steps, then start assessing hazards and controls.
          </Typography>
        </Box>

        <Stack
          direction="row"
          gap={1}
          flexWrap="wrap"
          justifyContent="flex-end"
        >
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => nav(-1)}
            sx={{ borderRadius: 2 }}
          >
            Back
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => nav(`/tasks/${taskIdStr}/steps/new`)}
            sx={{ borderRadius: 2 }}
          >
            Edit steps
          </Button>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => nav(`/tasks/${taskIdStr}/assess/run`)}
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            Start assessment
          </Button>
        </Stack>
      </Stack>

      {!!err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Card
        variant="outlined"
        sx={{
          borderRadius: 3,
          borderColor: 'divider',
          boxShadow: 'none',
          mb: 2,
        }}
      >
        <CardContent>
          <Stack spacing={1.2}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1}
            >
              <Typography sx={{ fontWeight: 900 }}>Overview</Typography>
              {steps && (
                <Chip
                  label={`${steps.length} steps`}
                  sx={{ fontWeight: 900, borderRadius: 2 }}
                />
              )}
            </Stack>

            {task ? (
              <>
                <Typography sx={{ color: 'text.secondary', fontWeight: 650 }}>
                  {task.description || 'No description provided.'}
                </Typography>
                {task.trainingLink && (
                  <Typography sx={{ color: 'text.secondary', fontWeight: 650 }}>
                    Training:{' '}
                    <a
                      href={task.trainingLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {task.trainingLink}
                    </a>
                  </Typography>
                )}
              </>
            ) : (
              <Stack spacing={0.6}>
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="text" width="55%" />
              </Stack>
            )}

            {started && (
              <Box sx={{ mt: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mb: 0.8 }}
                >
                  <Typography sx={{ fontWeight: 900 }}>Progress</Typography>
                  <Typography sx={{ color: 'text.secondary', fontWeight: 750 }}>
                    {assessed}/{total} steps started ({pct}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ height: 10, borderRadius: 999 }}
                />
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card
        variant="outlined"
        sx={{ borderRadius: 3, borderColor: 'divider', boxShadow: 'none' }}
      >
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Typography sx={{ fontWeight: 900 }}>Steps</Typography>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {!steps ? (
            <Stack spacing={1}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  variant="rounded"
                  height={72}
                  sx={{ borderRadius: 2 }}
                />
              ))}
            </Stack>
          ) : (
            <Stack spacing={1}>
              {sortedSteps.map((s) => (
                <Box
                  key={String(s.id)}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2.5,
                    p: 1.5,
                  }}
                >
                  <Typography sx={{ fontWeight: 900 }}>
                    Step {s.stepNo}: {s.title}
                  </Typography>

                  {(s.method || s.trainingLink) && (
                    <Typography
                      sx={{ color: 'text.secondary', fontWeight: 650, mt: 0.5 }}
                    >
                      {s.method ? `Method: ${s.method}` : null}
                      {s.method && s.trainingLink ? ' • ' : null}
                      {s.trainingLink ? (
                        <>
                          Training:{' '}
                          <a
                            href={s.trainingLink ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.trainingLink}
                          </a>
                        </>
                      ) : null}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
