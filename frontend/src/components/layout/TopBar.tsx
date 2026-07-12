import { Radio, Zap } from 'lucide-react';

interface TopBarProps {
  points: number;
}

export function TopBar({ points }: TopBarProps) {
  return (
    <header className="flex items-center justify-between py-2">
      {/* Logo — radio ikonka + 3 rangli gradient (Stitch) */}
      <div className="flex items-center gap-2">
        <Radio size={22} fill="currentColor" strokeWidth={1.5} className="text-[#5e6ad2]" />
        <span className="text-[17px] font-extrabold tracking-[1.5px] uppercase logo-gradient">
          INTRA GROUP
        </span>
      </div>

      {/* Points badge — JetBrains Mono */}
      <div
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
        style={{
          background: 'rgba(37,42,53,0.6)',
          border: '1px solid rgba(94,106,210,0.2)',
          boxShadow: '0 0 15px rgba(110,120,225,0.1)',
        }}
      >
        <Zap size={16} className="text-[#6e78e1]" />
        <span className="font-mono text-sm font-bold text-[#6e78e1] tabular-nums">
          {Number(points).toFixed(3)}
        </span>
      </div>
    </header>
  );
}
