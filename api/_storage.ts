import fs from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';

export const MEMBERS = ['Ngọc', 'Trình', 'Đang', 'Tài', 'Khoa'] as const;
export type MemberName = (typeof MEMBERS)[number];

export const SESSIONS = ['morning', 'noon', 'afternoon', 'evening'] as const;
export type SessionKey = (typeof SESSIONS)[number];

export type AvailabilityStatus = 'free' | 'busy' | 'unset';
export type StorageMode = 'local-json' | 'vercel-json';

export interface SlotVote {
  status: 'free' | 'busy';
  note?: string;
  updatedAt: string;
}

export type LogActionType = 'set_free' | 'set_busy' | 'clear' | 'update_note';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  member: MemberName;
  date: string;
  session: SessionKey;
  action: LogActionType;
  previousStatus: AvailabilityStatus;
  newStatus: AvailabilityStatus;
  note?: string;
  previousNote?: string;
}

export interface TeamScheduleData {
  version: number;
  updatedAt: string;
  slots: Record<string, SlotVote>;
  logs: ActivityLogEntry[];
}

export interface ScheduleApiResponse extends TeamScheduleData {
  storageMode: StorageMode;
}

const MAX_LOGS = 300;
const BUNDLED_JSON_FILE = path.resolve(process.cwd(), 'data', 'schedule.json');
const VERCEL_TMP_FILE = '/tmp/team-schedule-v1.json';

let writeQueue: Promise<unknown> = Promise.resolve();

function createEmptySchedule(): TeamScheduleData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    slots: {},
    logs: [],
  };
}

export function getStorageMode(): StorageMode {
  return process.env.VERCEL === '1' ? 'vercel-json' : 'local-json';
}

function normalizeSchedule(raw: unknown): TeamScheduleData {
  if (!raw || typeof raw !== 'object') {
    return createEmptySchedule();
  }
  const obj = raw as Partial<TeamScheduleData>;
  const slots: Record<string, SlotVote> = {};
  if (obj.slots && typeof obj.slots === 'object') {
    for (const [k, v] of Object.entries(obj.slots)) {
      if (!v || typeof v !== 'object') continue;
      const parts = k.split('__');
      if (parts.length !== 3) continue;
      const [date, session, member] = parts;
      if (!isValidDateStr(date)) continue;
      if (!SESSIONS.includes(session as SessionKey)) continue;
      if (!MEMBERS.includes(member as MemberName)) continue;
      const vote = v as Partial<SlotVote>;
      if (vote.status !== 'free' && vote.status !== 'busy') continue;
      const note = typeof vote.note === 'string' ? vote.note.trim().slice(0, 200) : undefined;
      slots[k] = {
        status: vote.status,
        ...(note ? { note } : {}),
        updatedAt: typeof vote.updatedAt === 'string' ? vote.updatedAt : new Date().toISOString(),
      };
    }
  }

  const logs: ActivityLogEntry[] = Array.isArray(obj.logs)
    ? obj.logs
        .filter((item): item is ActivityLogEntry => {
          if (!item || typeof item !== 'object') return false;
          const l = item as Partial<ActivityLogEntry>;
          return (
            typeof l.id === 'string' &&
            typeof l.timestamp === 'string' &&
            MEMBERS.includes(l.member as MemberName) &&
            typeof l.date === 'string' &&
            isValidDateStr(l.date) &&
            SESSIONS.includes(l.session as SessionKey)
          );
        })
        .slice(0, MAX_LOGS)
    : [];

  return {
    version: typeof obj.version === 'number' && obj.version >= 1 ? obj.version : 1,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    slots,
    logs,
  };
}

async function readJsonFileSafe(filePath: string): Promise<TeamScheduleData | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return normalizeSchedule(JSON.parse(content));
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function readSchedule(): Promise<ScheduleApiResponse> {
  const mode = getStorageMode();

  if (mode === 'vercel-json') {
    const tmpData = await readJsonFileSafe(VERCEL_TMP_FILE);
    if (tmpData) {
      return { ...tmpData, storageMode: mode };
    }
    const seededData = (await readJsonFileSafe(BUNDLED_JSON_FILE)) ?? createEmptySchedule();
    return { ...seededData, storageMode: mode };
  }

  const localData = (await readJsonFileSafe(BUNDLED_JSON_FILE)) ?? createEmptySchedule();
  return { ...localData, storageMode: mode };
}

async function writeSchedule(data: TeamScheduleData): Promise<ScheduleApiResponse> {
  const mode = getStorageMode();
  const filePath = mode === 'vercel-json' ? VERCEL_TMP_FILE : BUNDLED_JSON_FILE;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
  return { ...data, storageMode: mode };
}

function enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function computeUserToday(tzOffsetMinutes?: number): string {
  const fallbackOffset = -420;
  const raw =
    typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)
      ? Math.trunc(tzOffsetMinutes)
      : fallbackOffset;
  const clamped = Math.max(-840, Math.min(720, raw));
  const localMs = Date.now() - clamped * 60_000;
  const local = new Date(localMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface VoteInput {
  member: MemberName;
  date: string;
  sessions: SessionKey[];
  status: AvailabilityStatus;
  note?: string;
  preserveNote?: boolean;
  tzOffsetMinutes?: number;
}

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function applyVote(input: VoteInput): Promise<ScheduleApiResponse> {
  if (!MEMBERS.includes(input.member)) {
    throw new ValidationError('Tên thành viên không hợp lệ.');
  }
  if (!isValidDateStr(input.date)) {
    throw new ValidationError('Ngày không hợp lệ.');
  }
  if (!Array.isArray(input.sessions) || input.sessions.length === 0) {
    throw new ValidationError('Vui lòng chọn ít nhất một buổi.');
  }
  for (const s of input.sessions) {
    if (!SESSIONS.includes(s)) {
      throw new ValidationError('Buổi không hợp lệ.');
    }
  }
  if (input.status !== 'free' && input.status !== 'busy' && input.status !== 'unset') {
    throw new ValidationError('Trạng thái không hợp lệ.');
  }

  const todayStr = computeUserToday(input.tzOffsetMinutes);
  if (input.date < todayStr) {
    throw new ValidationError('Ngày trong quá khứ chỉ được xem, không thể chỉnh sửa.', 403);
  }

  const cleanNote =
    typeof input.note === 'string' ? input.note.trim().slice(0, 200) : undefined;

  return enqueueMutation(async () => {
    const current = await readSchedule();
    const nowIso = new Date().toISOString();
    const nextSlots = { ...current.slots };
    const newLogs: ActivityLogEntry[] = [];

    for (const session of input.sessions) {
      const key = `${input.date}__${session}__${input.member}`;
      const existing = nextSlots[key];
      const prevStatus: AvailabilityStatus = existing ? existing.status : 'unset';
      const prevNote = existing?.note;

      let effectiveNote: string | undefined;
      if (input.status === 'unset') {
        effectiveNote = undefined;
      } else if (input.preserveNote) {
        effectiveNote = prevNote;
      } else {
        effectiveNote = cleanNote || undefined;
      }

      const statusChanged = prevStatus !== input.status;
      const noteChanged = (prevNote ?? '') !== (effectiveNote ?? '');

      if (!statusChanged && !noteChanged) {
        continue;
      }

      if (input.status === 'unset') {
        delete nextSlots[key];
      } else {
        nextSlots[key] = {
          status: input.status,
          ...(effectiveNote ? { note: effectiveNote } : {}),
          updatedAt: nowIso,
        };
      }

      let action: LogActionType;
      if (input.status === 'unset') {
        action = 'clear';
      } else if (!statusChanged && noteChanged) {
        action = 'update_note';
      } else if (input.status === 'free') {
        action = 'set_free';
      } else {
        action = 'set_busy';
      }

      newLogs.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: nowIso,
        member: input.member,
        date: input.date,
        session,
        action,
        previousStatus: prevStatus,
        newStatus: input.status,
        ...(effectiveNote ? { note: effectiveNote } : {}),
        ...(prevNote ? { previousNote: prevNote } : {}),
      });
    }

    if (newLogs.length === 0) {
      return current;
    }

    const updated: TeamScheduleData = {
      version: current.version + 1,
      updatedAt: nowIso,
      slots: nextSlots,
      logs: [...newLogs, ...current.logs].slice(0, MAX_LOGS),
    };

    return writeSchedule(updated);
  });
}

export async function importScheduleSnapshot(raw: unknown): Promise<ScheduleApiResponse> {
  return enqueueMutation(async () => {
    const normalized = normalizeSchedule(raw);
    const current = await readSchedule();
    const updated: TeamScheduleData = {
      version: Math.max(current.version + 1, normalized.version),
      updatedAt: new Date().toISOString(),
      slots: normalized.slots,
      logs: normalized.logs,
    };
    return writeSchedule(updated);
  });
}

export async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return JSON.parse(req.body);
    }
    return req.body;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > 2_000_000) {
        reject(new ValidationError('Dữ liệu gửi lên quá lớn.', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError('JSON không hợp lệ.'));
      }
    });
    req.on('error', reject);
  });
}
