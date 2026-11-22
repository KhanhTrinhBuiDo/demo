import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Calendar, History } from 'lucide-react';
import { ActivityLogSidebar } from './components/ActivityLogSidebar';
import { StorageModal } from './components/StorageModal';
import { TeamToolbar } from './components/TeamToolbar';
import { TopHeader } from './components/TopHeader';
import { WeeklyGrid } from './components/WeeklyGrid';
import {
  MEMBERS,
  type AvailabilityStatus,
  type MemberName,
  type ScheduleApiResponse,
  type SessionKey,
} from './types/schedule';
import {
  addDays,
  getMondayOfWeek,
  getTodayDateStr,
  getWeekDays,
  parseLocalDate,
} from './utils/date';

const MEMBER_STORAGE_KEY = 'lich_nhom_5_active_member_v1';
const SNAPSHOT_STORAGE_KEY = 'lich_nhom_5_snapshot_v1';

function loadSavedMember(): MemberName {
  try {
    const saved = localStorage.getItem(MEMBER_STORAGE_KEY);
    if (saved && MEMBERS.includes(saved as MemberName)) {
      return saved as MemberName;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'Ngọc';
}

function createInitialState(): ScheduleApiResponse {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    slots: {},
    logs: [],
    storageMode: 'local-json',
  };
}

export default function App() {
  const [activeMember, setActiveMember] = useState<MemberName>(loadSavedMember);
  const [todayStr, setTodayStr] = useState<string>(() => getTodayDateStr());
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [schedule, setSchedule] = useState<ScheduleApiResponse>(createInitialState);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ type: 'error' | 'info'; text: string } | null>(
    null,
  );
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'grid' | 'logs'>('grid');

  const noticeTimeoutRef = useRef<number | null>(null);
  const hasRestoredTmpRef = useRef(false);

  const showNotice = useCallback((type: 'error' | 'info', text: string) => {
    setNotice({ type, text });
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
    }, 3500);
  }, []);

  const handleSelectMember = (member: MemberName) => {
    setActiveMember(member);
    try {
      localStorage.setItem(MEMBER_STORAGE_KEY, member);
    } catch {
      // Ignore
    }
  };

  // Persist local snapshot backup when in vercel-tmp mode
  const saveSnapshotLocally = useCallback((data: ScheduleApiResponse) => {
    try {
      localStorage.setItem(
        SNAPSHOT_STORAGE_KEY,
        JSON.stringify({
          version: data.version,
          updatedAt: data.updatedAt,
          slots: data.slots,
          logs: data.logs,
        }),
      );
    } catch {
      // Ignore quota errors
    }
  }, []);

  const applyServerState = useCallback(
    async (incoming: ScheduleApiResponse) => {
      // If running on Vercel /tmp seed and container cold-started empty,
      // re-hydrate once from localStorage backup if it has data.
      if (
        incoming.storageMode === 'vercel-json' &&
        !hasRestoredTmpRef.current &&
        Object.keys(incoming.slots).length === 0 &&
        incoming.logs.length === 0
      ) {
        hasRestoredTmpRef.current = true;
        try {
          const cachedRaw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw) as {
              slots?: Record<string, unknown>;
              logs?: unknown[];
            };
            if (
              (parsed.slots && Object.keys(parsed.slots).length > 0) ||
              (parsed.logs && parsed.logs.length > 0)
            ) {
              const res = await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
              });
              if (res.ok) {
                const rehydrated = (await res.json()) as ScheduleApiResponse;
                setSchedule(rehydrated);
                saveSnapshotLocally(rehydrated);
                return;
              }
            }
          }
        } catch {
          // Ignore hydration errors
        }
      }

      hasRestoredTmpRef.current = true;
      setSchedule((prev) => {
        if (
          incoming.version < prev.version &&
          incoming.storageMode === prev.storageMode &&
          Object.keys(incoming.slots).length === 0 &&
          Object.keys(prev.slots).length > 0
        ) {
          return prev;
        }
        return incoming;
      });
      saveSnapshotLocally(incoming);
    },
    [saveSnapshotLocally],
  );

  const fetchLatestState = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as ScheduleApiResponse;
      await applyServerState(data);
    } catch {
      // Network hiccup; retry on next poll
    } finally {
      setIsLoading(false);
    }
  }, [applyServerState]);

  // Initial load + SSE (when running Express server.ts) + polling fallback (for Vercel serverless)
  useEffect(() => {
    fetchLatestState();

    let eventSource: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(evt.data) as ScheduleApiResponse;
            if (parsed && parsed.slots) {
              applyServerState(parsed);
              setIsLoading(false);
            }
          } catch {
            // Ignore malformed SSE payload
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
        };
      } catch {
        eventSource = null;
      }
    }

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLatestState();
      }
    }, 4000);

    // Refresh local today boundary every minute in case midnight passes
    const dayTimer = window.setInterval(() => {
      setTodayStr(getTodayDateStr());
    }, 60000);

    return () => {
      eventSource?.close();
      window.clearInterval(pollInterval);
      window.clearInterval(dayTimer);
    };
  }, [applyServerState, fetchLatestState]);

  const weekDays = useMemo(
    () => getWeekDays(weekStart, todayStr),
    [weekStart, todayStr],
  );

  const handleVote = async (params: {
    date: string;
    sessions: SessionKey[];
    status: AvailabilityStatus;
    note?: string;
    preserveNote?: boolean;
  }) => {
    if (params.date < todayStr) {
      showNotice('info', 'Ngày trong quá khứ chỉ được xem, không thể chỉnh sửa.');
      return;
    }

    const keys = params.sessions.map((s) => `${params.date}__${s}`);
    setPendingKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member: activeMember,
          date: params.date,
          sessions: params.sessions,
          status: params.status,
          note: params.note,
          preserveNote: params.preserveNote,
          tzOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        showNotice('error', payload.error || 'Không thể lưu trạng thái.');
        return;
      }

      const updated = payload as ScheduleApiResponse;
      setSchedule(updated);
      saveSnapshotLocally(updated);
    } catch {
      showNotice('error', 'Mất kết nối máy chủ, vui lòng thử lại.');
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.delete(k);
        return next;
      });
    }
  };

  const handleImportData = async (rawJson: unknown) => {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawJson),
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error || 'Khôi phục thất bại.');
    }
    const updated = payload as ScheduleApiResponse;
    setSchedule(updated);
    saveSnapshotLocally(updated);
  };

  const jumpToDate = (dateStr: string) => {
    const targetDate = parseLocalDate(dateStr);
    setWeekStart(getMondayOfWeek(targetDate));
    setMobileTab('grid');
    window.setTimeout(() => {
      document
        .getElementById(`day-${dateStr}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopHeader onFocusGridMobile={() => setMobileTab('grid')} />

      <TeamToolbar
        activeMember={activeMember}
        onSelectMember={handleSelectMember}
        weekStart={weekStart}
        weekDays={weekDays}
        onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
        onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
        onCurrentWeek={() => setWeekStart(getMondayOfWeek(new Date()))}
        slots={schedule.slots}
        onJumpToDay={jumpToDate}
      />

      {/* Mobile Tab Switcher (hidden on desktop lg+) */}
      <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMobileTab('grid')}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'grid'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Lịch tuần</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('logs')}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mobileTab === 'logs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Nhật ký ({schedule.logs.length})</span>
          </button>
        </div>
      </div>

      {/* Inline Toast Notice */}
      {notice && (
        <div className="mx-auto max-w-[1600px] px-4 pt-3 sm:px-6">
          <div
            role="status"
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
              notice.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{notice.text}</span>
          </div>
        </div>
      )}

      {/* Main Workspace: Weekly Grid + Live Activity Log Sidebar */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div
            className={`min-w-0 flex-1 ${
              mobileTab === 'grid' ? 'block' : 'hidden lg:block'
            }`}
          >
            {isLoading ? (
              <div className="space-y-3" aria-label="Đang tải dữ liệu lịch">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-40 rounded-xl border border-slate-200 bg-white p-4 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <WeeklyGrid
                weekDays={weekDays}
                activeMember={activeMember}
                onSelectMember={handleSelectMember}
                slots={schedule.slots}
                pendingKeys={pendingKeys}
                onVote={handleVote}
                onPastDateAttempt={() =>
                  showNotice(
                    'info',
                    'Ngày trong quá khứ chỉ được xem, không thể chỉnh sửa.',
                  )
                }
              />
            )}
          </div>

          <div className={mobileTab === 'logs' ? 'block' : 'hidden lg:block'}>
            <ActivityLogSidebar
              logs={schedule.logs}
              onJumpToDate={jumpToDate}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-500 sm:px-6">
          <span>Lịch Nhóm · Ngọc, Trình, Đang, Tài, Khoa</span>
          <button
            type="button"
            onClick={() => setIsStorageModalOpen(true)}
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-4 cursor-pointer"
          >
            File JSON &amp; Sao lưu
          </button>
        </div>
      </footer>

      <StorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        scheduleState={schedule}
        onImportData={handleImportData}
      />
    </div>
  );
}
