import type { IncomingMessage, ServerResponse } from 'node:http';
import { readSchedule } from './_storage.js';

interface VercelRes extends ServerResponse {
  status?: (code: number) => VercelRes;
  json?: (data: unknown) => void;
}

function sendJson(res: VercelRes, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: VercelRes) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const state = await readSchedule();
    sendJson(res, 200, state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể đọc dữ liệu lịch.';
    sendJson(res, 500, { error: message });
  }
}
