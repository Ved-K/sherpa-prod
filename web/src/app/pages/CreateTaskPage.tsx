// src/app/pages/CreateTaskPage.tsx
import { useEffect, useState } from 'react';
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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';

import { api } from '../api/client';

type Machine = {
  id: string;
  name: string;
};

type TaskCreateBody = {
  name: string;
  description?: string | null;
  trainingLink?: string | null;
};

type Task = {
  id: string;
  machineId: string;
  name: string;
};

async function getMachine(machineId: string) {
  return api<Machine>(`/machines/${machineId}`);
}

// ✅ correct endpoint per your note
async function createTask(machineId: string, body: TaskCreateBody) {
  return api<Task>(`/machines/${machineId}/tasks`, { method: 'POST', body });
}

export default function CreateTaskPage() {
  const { machineId } = useParams<{ machineId: string }>();
  const nav = useNavigate();

  // machineId from params is already string | undefined
  const machineIdStr = machineId ?? '';

  const [machine, setMachine] = useState<Machine | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trainingLink, setTrainingLink] = useState('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load machine name (optional)
  useEffect(() => {
    if (!machineIdStr) return;
    let alive = true;

    (async () => {
      try {
        setMachine(null);
        const m = await getMachine(machineIdStr);
        if (!alive) return;
        setMachine(m);
      } catch {
        // non-blocking
        if (!alive) return;
        setMachine(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [machineIdStr]);

  useEffect(() => {
    setErr(null);
  }, [name, description, trainingLink]);

  if (!machineIdStr) {
    return (
      <Alert severity="error">
        Missing machineId in URL. Route should be{' '}
        <b>/machines/:machineId/tasks/new</b>
      </Alert>
    );
  }

  async function onSave() {
    const n = name.trim();
    if (!n) {
      setErr('Task name is required.');
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const created = await createTask(machineIdStr, {
        name: n,
        description: description.trim() || null,
        trainingLink: trainingLink.trim() || null,
      });

      // Go straight to steps creation
      nav(`/tasks/${String(created.id)}/steps/new`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
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

            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 950,
                  fontSize: { xs: 26, md: 34 },
                  lineHeight: 1.05,
                }}
              >
                Create task
              </Typography>
              <Typography
                sx={{ mt: 0.6, color: 'text.secondary', fontWeight: 650 }}
              >
                {machine?.name
                  ? `Machine: ${machine.name}`
                  : 'Add a task to this machine. You’ll add steps next.'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={onSave}
          disabled={saving}
          sx={{ borderRadius: 2, fontWeight: 900 }}
        >
          {saving ? 'Saving…' : 'Create'}
        </Button>
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
          boxShadow: 'none',
          borderColor: 'divider',
        }}
      >
        <CardContent>
          <Typography sx={{ fontWeight: 950, mb: 1 }}>Task details</Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1.4}>
            <TextField
              label="Task name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Changeover – reset guides"
              autoFocus
            />

            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={3}
              placeholder="Short description / scope of the task"
            />

            <TextField
              label="Training link (optional)"
              value={trainingLink}
              onChange={(e) => setTrainingLink(e.target.value)}
              placeholder="https://…"
            />

            <Alert severity="info">
              After creating the task, you’ll be taken to <b>Add steps</b>.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
