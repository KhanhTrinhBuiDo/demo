import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import {
  MEMBERS,
  SESSION_META,
  type ActivityLogEntry,
  type AvailabilityStatus,
  type MemberName,
} from '../types/schedule';
import {
  formatDayLabelShort,
  formatRelativeTimeVi,
  formatTimeHMS,
} from '../utils/date';

interface ActivityLogSidebarProps {
  logs: ActivityLogEntry[];
  onJumpToDate: (dateStr: string) => void;
}

function statusLabel(status: AvailabilityStatus): string {
  if (status === 'free') return 'Rảnh';
  if (status === 'busy') return 'Bận';
  return 'Chưa chọn';
}

function actionSentence(entry: ActivityLogEntry): string {
  switch (entry.action) {
    case 'set_free':
      return 'đã đánh dấu Rảnh';
    case 'set_busy':
      return 'đã đánh dấu Bận';
    case 'clear':
      return 'đã xoá trạng thái';
    case 'update_note':
      return 'đã cập nhật ghi chú';
  }
}

export function ActivityLogSidebar({
  logs,
  onJumpToDate,
}: ActivityLogSidebarProps) {
  const [filterMember, setFilterMember] = useState<'ALL' | MemberName>('ALL');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredLogs =
    filterMember === 'ALL'
      ? logs
      : logs.filter((entry) => entry.member === filterMember);

  return (
    <aside
      id="nhat-ky"
      aria-label="Nhật ký chỉnh sửa trực tiếp"
      className="w-full lg:w-[300px] xl:w-[320px] shrink-0"
    >
      <div className="lg:sticky lg:top-[73px] flex flex-col rounded-xl border border-slate-200 bg-white lg:max-h-[calc(100vh-96px)]">
        {/* Header */}
        <div className="border-b border-slate-200 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-600" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900">
                Nhật ký chỉnh sửa
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {filteredLogs.length} thay đổi
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Hiển thị trực tiếp ai vừa chỉnh sửa lịch và ghi chú.
          </p>

          {/* Filter tabs */}
          <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFilterMember('ALL')}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                filterMember === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            {MEMBERS.map((member) => (
              <button
                key={member}
                type="button"
                onClick={() => setFilterMember(member)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  filterMember === member
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {member}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-xs font-medium text-slate-600">
                Chưa có chỉnh sửa nào được ghi nhận.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Chọn tên của bạn ở thanh trên rồi nhấn Rảnh hoặc Bận vào một
                buổi từ hôm nay trở đi.
              </p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const sessionLabel = SESSION_META[entry.session]?.label ?? entry.session;
              const dayLabel = formatDayLabelShort(entry.date);
              const relative = formatRelativeTimeVi(entry.timestamp, nowMs);
              const timeStr = formatTimeHMS(entry.timestamp);

              return (
                <div
                  key={entry.id}
                  className="px-4 py-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-relaxed text-slate-800">
                      <strong className="font-bold text-slate-900">
                        {entry.member}
                      </strong>{' '}
                      <span
                        className={
                          entry.action === 'set_free'
                            ? 'font-semibold text-emerald-700'
                            : entry.action === 'set_busy'
                              ? 'font-semibold text-rose-700'
                              : 'font-medium text-slate-700'
                        }
                      >
                        {actionSentence(entry)}
                      </span>
                    </p>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                    <button
                      type="button"
                      onClick={() => onJumpToDate(entry.date)}
                      className="font-medium text-blue-700 hover:underline underline-offset-2 cursor-pointer"
                    >
                      Buổi {sessionLabel} · {dayLabel}
                    </button>
                    <span className="text-slate-300" aria-hidden="true">
                      /
                    </span>
                    <span className="text-slate-500">
                      {statusLabel(entry.previousStatus)} →{' '}
                      <strong className="font-semibold text-slate-700">
                        {statusLabel(entry.newStatus)}
                      </strong>
                    </span>
                  </div>

                  {(entry.note || entry.previousNote) && (
                    <div className="mt-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 break-words">
                      {entry.note ? (
                        <span>
                          <span className="font-semibold text-slate-600">
                            Ghi chú:
                          </span>{' '}
                          “{entry.note}”
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Đã xoá ghi chú cũ (“{entry.previousNote}”)
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center gap-1.5 font-mono-tabular text-[11px] text-slate-400">
                    <span>{timeStr}</span>
                    {relative && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{relative}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
