import { Zap } from 'lucide-react';

interface TopBarProps {
  points: number;
}

export function TopBar({ points }: TopBarProps) {
  return (
    <header className="flex items-center justify-between py-2">
      {/* Logo */}
      <div className="leading-none">
        <div className="text-[18px] font-black tracking-[2px]">
          <span className="text-[#2ea8ff]">INT</span>
          <span className="text-[#38e1ff]">RA</span>
          <span className="text-[#7c5cff]"> GROUP</span>
        </div>
      </div>

      {/* Points badge */}
      <div className="glass px-3 py-1.5 rounded-xl flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-[#38e1ff]" strokeWidth={2.5} />
        <div className="text-sm font-bold text-[#38e1ff] tabular-nums">
          {Number(points).toFixed(3)}
        </div>
      </div>
    </header>
  );
}
