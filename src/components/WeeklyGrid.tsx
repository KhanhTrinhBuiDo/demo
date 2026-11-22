import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Lock,
  RotateCcw,
  StickyNote,
  UserCheck,
  X,
} from 'lucide-react';
import {
  MEMBERS,
  SESSIONS,
  SESSION_META,
  makeSlotKey,
  type AvailabilityStatus,
  type MemberName,
  type SessionKey,
  type SlotVote,
} from '../types/schedule';
import type { WeekDayInfo } from '../utils/date';

interface WeeklyGridProps {
  weekDays: WeekDayInfo[];
  activeMember: MemberName;
  onSelectMember: (member: MemberName) => void;
  slots: Record<string, SlotVote>;
  pendingKeys: Set<string>;
  onVote: (params: {
    date: string;
    sessions: SessionKey[];
    status: AvailabilityStatus;
    note?: string;
    preserveNote?: boolean;
  }) => Promise<void>;
  onPastDateAttempt: () => void;
}

interface ActiveMenuState {
  member: MemberName;
  date: string;
  dayName: string;
  displayDate: string;
  session: SessionKey;
  isPast: boolean;
  top: number;
  left: number;
  draftNote: string;
}

const MENU_WIDTH = 256;

export function WeeklyGrid({
  weekDays,
  activeMember,
  onSelectMember,
  slots,
  pendingKeys,
  onVote,
  onPastDateAttempt,
}: WeeklyGridProps) {
  const [openMenu, setOpenMenu] = useState<ActiveMenuState | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    const handleResize = () => setOpenMenu(null);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [openMenu]);

  const handleOpenMemberMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    member: MemberName,
    day: WeekDayInfo,
    session: SessionKey,
  ) => {
    e.stopPropagation();
    const isSame =
      openMenu?.member === member &&
      openMenu?.date === day.dateStr &&
      openMenu?.session === session;

    if (isSame) {
      setOpenMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedHeight = day.isPast ? 140 : 255;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - MENU_WIDTH - 8,
    );
    const fitsBelow = rect.bottom + estimatedHeight <= window.innerHeight - 8;
    const top = fitsBelow
      ? rect.bottom + 4
      : Math.max(8, rect.top - estimatedHeight - 4);

    const vote: SlotVote | undefined =
      slots[makeSlotKey(day.dateStr, session, member)];

    setOpenMenu({
      member,
      date: day.dateStr,
      dayName: day.dayName,
      displayDate: day.fullDisplayDate,
      session,
      isPast: day.isPast,
      top,
      left,
      draftNote: vote?.note ?? '',
    });
  };

  const currentMenuVote: SlotVote | undefined = openMenu
    ? slots[makeSlotKey(openMenu.date, openMenu.session, openMenu.member)]
    : undefined;
  const currentMenuStatus: AvailabilityStatus = currentMenuVote
    ? currentMenuVote.status
    : 'unset';

  const handleSelectStatusFromMenu = async (status: AvailabilityStatus) => {
    if (!openMenu) return;
    const { date, session } = openMenu;
    setOpenMenu(null);
    await onVote({
      date,
      sessions: [session],
      status,
      preserveNote: true,
    });
  };

  const handleSaveNoteFromMenu = async () => {
    if (!openMenu) return;
    const { date, session, draftNote } = openMenu;
    const clean = draftNote.trim();
    const nextStatus: AvailabilityStatus =
      currentMenuStatus === 'unset' ? 'free' : currentMenuStatus;
    setOpenMenu(null);
    await onVote({
      date,
      sessions: [session],
      status: nextStatus,
      note: clean,
      preserveNote: false,
    });
  };

  return (
    <div id="lich-tuan" className="space-y-3">
      {/* Timetable: 7 Day Columns (Thứ Hai -> Chủ Nhật) x 4 Time Rows (Sáng, Trưa, Chiều, Tối) */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="min-w-[920px]">
          {/* Header Row */}
          <div className="grid grid-cols-[92px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50/70">
            <div className="sticky left-0 z-10 flex flex-col justify-center border-r border-slate-200 bg-slate-50 px-3 py-3">
              <span className="text-xs font-bold text-slate-700">Thời gian</span>
              <span className="mt-0.5 text-[11px] text-slate-500">4 buổi / ngày</span>
            </div>

            {weekDays.map((day) => {
              const isDayPending = SESSIONS.some((s) =>
                pendingKeys.has(`${day.dateStr}__${s}`),
              );

              return (
                <div
                  key={day.dateStr}
                  id={`day-${day.dateStr}`}
                  className={`flex flex-col justify-between gap-2 border-r border-slate-200 last:border-r-0 px-2.5 py-2.5 ${
                    day.isToday
                      ? 'bg-blue-50/70'
                      : day.isPast
                        ? 'bg-slate-100/80'
                        : 'bg-slate-50/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <h3
                        className={`text-xs font-bold truncate ${
                          day.isToday
                            ? 'text-blue-700'
                            : day.isPast
                              ? 'text-slate-500'
                              : 'text-slate-900'
                        }`}
                      >
                        {day.dayName}
                      </h3>
                      {day.isToday && (
                        <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">
                          Hôm nay
                        </span>
                      )}
                      {day.isPast && (
                        <Lock
                          className="h-3 w-3 shrink-0 text-slate-400"
                          aria-label="Chỉ xem"
                        />
                      )}
                    </div>
                    <p
                      className={`mt-0.5 font-mono-tabular text-[11px] ${
                        day.isPast ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {day.displayDate}
                    </p>
                  </div>

                  {day.isPast ? (
                    <span className="text-[10px] font-medium text-slate-400">
                      Đã qua · Chỉ xem
                    </span>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        disabled={isDayPending}
                        onClick={() =>
                          onVote({
                            date: day.dateStr,
                            sessions: [...SESSIONS],
                            status: 'free',
                            preserveNote: true,
                          })
                        }
                        title={`Đánh dấu ${activeMember} rảnh cả ngày ${day.dayName}`}
                        className="rounded border border-emerald-200 bg-white px-1 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Rảnh hết
                      </button>
                      <button
                        type="button"
                        disabled={isDayPending}
                        onClick={() =>
                          onVote({
                            date: day.dateStr,
                            sessions: [...SESSIONS],
                            status: 'busy',
                            preserveNote: true,
                          })
                        }
                        title={`Đánh dấu ${activeMember} bận cả ngày ${day.dayName}`}
                        className="rounded border border-rose-200 bg-white px-1 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Bận hết
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 4 Time Rows */}
          <div className="divide-y divide-slate-200">
            {SESSIONS.map((sessionKey) => {
              const meta = SESSION_META[sessionKey];

              return (
                <div
                  key={sessionKey}
                  className="grid grid-cols-[92px_repeat(7,minmax(0,1fr))]"
                >
                  {/* Sticky Time Label Column */}
                  <div className="sticky left-0 z-10 flex flex-col justify-start border-r border-slate-200 bg-white px-3 py-3">
                    <span className="text-sm font-bold text-slate-900">
                      {meta.label}
                    </span>
                    <span className="mt-1 font-mono-tabular text-[11px] leading-tight text-slate-500">
                      {meta.timeRange}
                    </span>
                  </div>

                  {/* 7 Day Cells */}
                  {weekDays.map((day) => {
                    const cellKey = `${day.dateStr}__${sessionKey}`;
                    const isCellPending = pendingKeys.has(cellKey);

                    let freeCount = 0;
                    for (const m of MEMBERS) {
                      const st: AvailabilityStatus =
                        slots[makeSlotKey(day.dateStr, sessionKey, m)]?.status ?? 'unset';
                      if (st === 'free') freeCount++;
                    }

                    return (
                      <div
                        key={cellKey}
                        onClick={() => {
                          if (day.isPast) {
                            onPastDateAttempt();
                          }
                        }}
                        className={`flex flex-col gap-1 border-r border-slate-200 last:border-r-0 p-1.5 ${
                          day.isPast
                            ? 'bg-slate-100/60 cursor-not-allowed'
                            : day.isToday
                              ? 'bg-blue-50/20'
                              : 'bg-white'
                        }`}
                      >
                        {/* Cell Free Summary */}
                        <div className="flex items-center justify-between px-1 pb-0.5 text-[10px] font-semibold tabular-nums">
                          <span
                            className={
                              freeCount === 5
                                ? 'text-emerald-700'
                                : freeCount >= 3
                                  ? 'text-emerald-700'
                                  : 'text-slate-400 font-medium'
                            }
                          >
                            {freeCount === 5 ? '5/5 Đủ nhóm' : `${freeCount}/5 rảnh`}
                          </span>
                        </div>

                        {/* Uniform Compact Member Menubar Triggers */}
                        <ul
                          role="menubar"
                          aria-label={`Trạng thái 5 thành viên ${meta.label} ${day.dayName}`}
                          className="space-y-0.5"
                        >
                          {MEMBERS.map((member) => {
                            const vote: SlotVote | undefined =
                              slots[makeSlotKey(day.dateStr, sessionKey, member)];
                            const status: AvailabilityStatus = vote
                              ? vote.status
                              : 'unset';
                            const isCurrentMember = member === activeMember;
                            const isMenuOpen =
                              openMenu?.member === member &&
                              openMenu?.date === day.dateStr &&
                              openMenu?.session === sessionKey;

                            const rowBg =
                              status === 'free'
                                ? 'bg-emerald-50/85 hover:bg-emerald-100/75'
                                : status === 'busy'
                                  ? 'bg-rose-50/85 hover:bg-rose-100/75'
                                  : 'hover:bg-slate-100/80';

                            return (
                              <li key={member} role="none">
                                <button
                                  type="button"
                                  role="menuitem"
                                  aria-haspopup="menu"
                                  aria-expanded={isMenuOpen}
                                  disabled={isCellPending}
                                  onClick={(e) => {
                                    if (day.isPast && !vote?.note) {
                                      e.stopPropagation();
                                      onPastDateAttempt();
                                      return;
                                    }
                                    handleOpenMemberMenu(e, member, day, sessionKey);
                                  }}
                                  className={`group w-full rounded px-1.5 py-1 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${rowBg} ${
                                    isMenuOpen
                                      ? 'ring-1 ring-blue-500'
                                      : isCurrentMember && !day.isPast
                                        ? 'ring-1 ring-blue-500/25'
                                        : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`flex items-center gap-1 text-[11px] truncate ${
                                        isCurrentMember
                                          ? 'font-bold text-slate-900'
                                          : 'font-medium text-slate-700'
                                      }`}
                                    >
                                      <span className="truncate">{member}</span>
                                      {!day.isPast && isCurrentMember && (
                                        <ChevronDown
                                          className="h-3 w-3 shrink-0 text-blue-600 opacity-75 group-hover:opacity-100"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </span>

                                    <span
                                      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold whitespace-nowrap shrink-0 ${
                                        status === 'free'
                                          ? 'text-emerald-700'
                                          : status === 'busy'
                                            ? 'text-rose-700'
                                            : 'text-slate-400 font-normal'
                                      }`}
                                    >
                                      {status === 'free' ? (
                                        <>
                                          <Check
                                            className="h-2.5 w-2.5"
                                            aria-hidden="true"
                                          />
                                          <span>Rảnh</span>
                                        </>
                                      ) : status === 'busy' ? (
                                        <>
                                          <X
                                            className="h-2.5 w-2.5"
                                            aria-hidden="true"
                                          />
                                          <span>Bận</span>
                                        </>
                                      ) : (
                                        <span>—</span>
                                      )}
                                    </span>
                                  </div>

                                  {vote?.note && (
                                    <p
                                      title={vote.note}
                                      className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-slate-600"
                                    >
                                      <StickyNote
                                        className="h-2.5 w-2.5 shrink-0 text-slate-400"
                                        aria-hidden="true"
                                      />
                                      <span className="truncate">{vote.note}</span>
                                    </p>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Anchored Menubar Popover at the Clicked Name Position */}
      {openMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenMenu(null)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label={`Tuỳ chọn cho ${openMenu.member}`}
            style={{ top: openMenu.top, left: openMenu.left, width: MENU_WIDTH }}
            className="fixed z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Menu Header */}
            <div className="border-b border-slate-100 px-1.5 pb-1.5 mb-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {openMenu.member}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {SESSION_META[openMenu.session].label} · {openMenu.dayName}
                </span>
              </div>
              <p className="font-mono-tabular text-[10px] text-slate-400">
                {openMenu.displayDate} · {SESSION_META[openMenu.session].timeRange}
              </p>
            </div>

            {openMenu.isPast ? (
              <div className="space-y-1.5 px-1.5 py-1 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ngày đã qua · Chỉ xem</span>
                </div>
                {currentMenuVote?.note && (
                  <p className="rounded bg-slate-50 p-2 text-xs text-slate-700 break-words">
                    “{currentMenuVote.note}”
                  </p>
                )}
              </div>
            ) : openMenu.member !== activeMember ? (
              <div className="space-y-2 px-1.5 py-1">
                {currentMenuVote?.note && (
                  <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-700 break-words">
                    <span className="font-semibold text-slate-600">Ghi chú: </span>
                    {currentMenuVote.note}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Bạn đang chọn tên <strong className="text-slate-800">{activeMember}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectMember(openMenu.member)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Chuyển sang {openMenu.member} để sửa</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentMenuStatus === 'free'}
                  onClick={() => handleSelectStatusFromMenu('free')}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    currentMenuStatus === 'free'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-800 hover:bg-emerald-50 hover:text-emerald-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Đánh dấu Rảnh</span>
                  </span>
                  {currentMenuStatus === 'free' && (
                    <span className="text-[10px] opacity-90">Đang chọn</span>
                  )}
                </button>

                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentMenuStatus === 'busy'}
                  onClick={() => handleSelectStatusFromMenu('busy')}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    currentMenuStatus === 'busy'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-800 hover:bg-rose-50 hover:text-rose-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Đánh dấu Bận</span>
                  </span>
                  {currentMenuStatus === 'busy' && (
                    <span className="text-[10px] opacity-90">Đang chọn</span>
                  )}
                </button>

                {currentMenuStatus !== 'unset' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectStatusFromMenu('unset')}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Xoá trạng thái</span>
                  </button>
                )}

                <div className="my-1.5 border-t border-slate-100 pt-1.5 space-y-1.5 px-0.5">
                  <label
                    htmlFor="menubar-note-input"
                    className="block text-[11px] font-semibold text-slate-600"
                  >
                    Ghi chú (tối đa 200 ký tự)
                  </label>
                  <input
                    id="menubar-note-input"
                    type="text"
                    maxLength={200}
                    value={openMenu.draftNote}
                    onChange={(e) =>
                      setOpenMenu({ ...openMenu, draftNote: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNoteFromMenu();
                      }
                    }}
                    placeholder="Ví dụ: Rảnh từ 9h..."
                    className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {currentMenuVote?.note ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const { date, session } = openMenu;
                          const nextStatus: AvailabilityStatus =
                            currentMenuStatus === 'unset'
                              ? 'free'
                              : currentMenuStatus;
                          setOpenMenu(null);
                          await onVote({
                            date,
                            sessions: [session],
                            status: nextStatus,
                            note: '',
                            preserveNote: false,
                          });
                        }}
                        className="text-[11px] font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        Xoá ghi chú
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={handleSaveNoteFromMenu}
                      className="rounded-md bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      Lưu ghi chú
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
