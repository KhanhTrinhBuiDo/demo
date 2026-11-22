export const MEMBERS = ['Ngọc', 'Trình', 'Đang', 'Tài', 'Khoa'] as const;
export type MemberName = (typeof MEMBERS)[number];

export const SESSIONS = ['morning', 'noon', 'afternoon', 'evening'] as const;
export type SessionKey = (typeof SESSIONS)[number];

export type AvailabilityStatus = 'free' | 'busy' | 'unset';

export type StorageMode = 'local-json' | 'vercel-json';

export interface SessionMeta {
  key: SessionKey;
  label: string;
  timeRange: string;
}

export const SESSION_META: Record<SessionKey, SessionMeta> = {
  morning: { key: 'morning', label: 'Sáng', timeRange: '07:00 – 11:30' },
  noon: { key: 'noon', label: 'Trưa', timeRange: '11:30 – 13:30' },
  afternoon: { key: 'afternoon', label: 'Chiều', timeRange: '13:30 – 18:00' },
  evening: { key: 'evening', label: 'Tối', timeRange: '18:00 – 22:30' },
};

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
  date: string; // YYYY-MM-DD
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

export function makeSlotKey(date: string, session: SessionKey, member: MemberName): string {
  return `${date}__${session}__${member}`;
}
