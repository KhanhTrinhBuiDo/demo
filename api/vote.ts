import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  applyVote,
  readJsonBody,
  ValidationError,
  type AvailabilityStatus,
  type MemberName,
  type SessionKey,
} from './_storage.js';

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
    const body = (await readJsonBody(req)) as Record<string, unknown>;
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

    sendJson(res, 200, updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      sendJson(res, err.statusCode, { error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái.';
    sendJson(res, 500, { error: message });
  }
}
