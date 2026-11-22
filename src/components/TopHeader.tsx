interface TopHeaderProps {
  onFocusGridMobile: () => void;
}

export function TopHeader({ onFocusGridMobile }: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] items-center px-4 py-3 sm:px-6">
        <a
          href="#lich-tuan"
          onClick={(e) => {
            e.preventDefault();
            onFocusGridMobile();
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Lịch Nhóm
        </a>
      </div>
    </header>
  );
}
