import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyVote,
  importScheduleSnapshot,
  readSchedule,
  ValidationError,
  type AvailabilityStatus,
  type MemberName,
  type ScheduleApiResponse,
  type SessionKey,
} from './api/_storage.js';

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.use(express.json({ limit: '2mb' }));

const sseClients = new Set<express.Response>();

function broadcastState(state: ScheduleApiResponse) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

app.get('/api/state', async (_req, res) => {
  try {
    const state = await readSchedule();
    res.setHeader('Cache-Control', 'no-store');
    res.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể đọc dữ liệu lịch.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);

  try {
    const initial = await readSchedule();
    res.write(`data: ${JSON.stringify(initial)}\n\n`);
  } catch {
    // Ignore initial write error
  }

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

app.post('/api/vote', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessions = Array.isArray(body.sessions)
      ? (body.sessions as SessionKey[])
      : body.session
        ? [body.session as SessionKey]
        : [];

    const updated = await applyVote({
      member: body.member as MemberName,
      date: String(body.date ?? ''),
      sessions,
      status: body.status as AvailabilityStatus,
      note: typeof body.note === 'string' ? body.note : undefined,
      preserveNote: Boolean(body.preserveNote),
      tzOffsetMinutes:
        typeof body.tzOffsetMinutes === 'number' ? body.tzOffsetMinutes : undefined,
    });

    broadcastState(updated);
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/import', async (req, res) => {
  try {
    const updated = await importScheduleSnapshot(req.body);
    broadcastState(updated);
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Không thể nhập dữ liệu lịch.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
