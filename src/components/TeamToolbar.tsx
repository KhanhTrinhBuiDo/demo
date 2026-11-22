import { CalendarDays, ChevronLeft, ChevronRight, Sparkles, UserCheck } from 'lucide-react';
import {
  MEMBERS,
  SESSIONS,
  SESSION_META,
  makeSlotKey,
  type MemberName,
  type SessionKey,
  type SlotVote,
} from '../types/schedule';
import { getISOWeekNumber, type WeekDayInfo } from '../utils/date';

interface TeamToolbarProps {
  activeMember: MemberName;
  onSelectMember: (member: MemberName) => void;
  weekStart: Date;
  weekDays: WeekDayInfo[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  slots: Record<string, SlotVote>;
  onJumpToDay: (dateStr: string) => void;
}

interface BestSlotMatch {
  dateStr: string;
  dayLabel: string;
  displayDate: string;
  session: SessionKey;
  sessionLabel: string;
  freeCount: number;
}

export function TeamToolbar({
  activeMember,
  onSelectMember,
  weekStart,
  weekDays,
  onPrevWeek,
  onNextWeek,
  onCurrentWeek,
  slots,
  onJumpToDay,
}: TeamToolbarProps) {
  const weekNum = getISOWeekNumber(weekStart);
  const firstDay = weekDays[0];
  const lastDay = weekDays[6];

  // Compute upcoming sessions in this week with >= 4/5 or highest free count (minimum 3)
  const upcomingMatches: BestSlotMatch[] = [];
  for (const day of weekDays) {
    if (day.isPast) continue;
    for (const session of SESSIONS) {
      let freeCount = 0;
      for (const member of MEMBERS) {
        if (slots[makeSlotKey(day.dateStr, session, member)]?.status === 'free') {
          freeCount++;
        }
      }
      if (freeCount >= 3) {
        upcomingMatches.push({
          dateStr: day.dateStr,
          dayLabel: day.shortDayName,
          displayDate: day.displayDate,
          session,
          sessionLabel: SESSION_META[session].label,
          freeCount,
        });
      }
    }
  }

  upcomingMatches.sort((a, b) => {
    if (b.freeCount !== a.freeCount) return b.freeCount - a.freeCount;
    return a.dateStr.localeCompare(b.dateStr);
  });
  const topMatches = upcomingMatches.slice(0, 5);

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Active Member Identity Picker */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 whitespace-nowrap shrink-0">
              <UserCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>Chọn tên của bạn:</span>
            </div>

            <div
              role="radiogroup"
              aria-label="Chọn thành viên đang thao tác"
              className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
            >
              {MEMBERS.map((member) => {
                const isActive = activeMember === member;
                return (
                  <button
                    key={member}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => onSelectMember(member)}
                    className={`min-h-[36px] rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {member}
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-slate-500">
              Đang chỉnh sửa với tư cách{' '}
              <strong className="font-semibold text-slate-900">{activeMember}</strong>
            </span>
          </div>

          {/* Weekly Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 xl:justify-end">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CalendarDays className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                Tuần {weekNum}
              </span>
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="font-mono-tabular text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                {firstDay.fullDisplayDate} – {lastDay.fullDisplayDate}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onPrevWeek}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tuần trước</span>
              </button>
              <button
                type="button"
                onClick={onCurrentWeek}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={onNextWeek}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Tuần sau</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Best Match Summary Strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium text-slate-700 whitespace-nowrap">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            <span>Khung giờ hợp nhóm từ hôm nay:</span>
          </div>

          {topMatches.length === 0 ? (
            <span className="text-slate-500">
              Chưa có khung giờ nào từ 3/5 thành viên cùng rảnh trong tuần này.
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {topMatches.map((m) => (
                <button
                  key={`${m.dateStr}-${m.session}`}
                  type="button"
                  onClick={() => onJumpToDay(m.dateStr)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    m.freeCount === 5
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-semibold">
                    {m.dayLabel} {m.displayDate} · {m.sessionLabel}
                  </span>
                  <span className="text-slate-400" aria-hidden="true">
                    ·
                  </span>
                  <span className="tabular-nums font-semibold">
                    {m.freeCount}/5 rảnh
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
