const DAY_NAMES_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

const SHORT_DAY_NAMES_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export interface WeekDayInfo {
  dateStr: string; // YYYY-MM-DD
  dayName: string; // Thứ 2 ... Chủ nhật
  shortDayName: string; // T2 ... CN
  displayDate: string; // DD/MM
  fullDisplayDate: string; // DD/MM/YYYY
  isToday: boolean;
  isPast: boolean;
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getTodayDateStr(): string {
  return formatLocalDate(new Date());
}

export function getMondayOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay(); // 0 = Sunday, 1 = Monday ...
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function getISOWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function getWeekDays(weekStartMonday: Date, todayStr: string): WeekDayInfo[] {
  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = addDays(weekStartMonday, i);
    const dateStr = formatLocalDate(dt);
    const dow = dt.getDay();
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    days.push({
      dateStr,
      dayName: DAY_NAMES_VI[dow],
      shortDayName: SHORT_DAY_NAMES_VI[dow],
      displayDate: `${dd}/${mm}`,
      fullDisplayDate: `${dd}/${mm}/${yyyy}`,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }
  return days;
}

export function formatDayLabelShort(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const dow = dt.getDay();
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${DAY_NAMES_VI[dow]} (${dd}/${mm})`;
}

export function formatTimeHMS(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '--:--:--';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatRelativeTimeVi(iso: string, nowMs: number = Date.now()): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 15) return 'vừa xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}
