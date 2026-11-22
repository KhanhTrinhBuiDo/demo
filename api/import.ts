import type { IncomingMessage, ServerResponse } from 'node:http';
import { importScheduleSnapshot, readJsonBody, ValidationError } from './_storage.js';

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const updated = await importScheduleSnapshot(body);
    sendJson(res, 200, updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      sendJson(res, err.statusCode, { error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Không thể nhập dữ liệu lịch.';
    sendJson(res, 500, { error: message });
  }
}
