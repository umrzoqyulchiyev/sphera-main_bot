import { Radio, Zap } from 'lucide-react';

interface TopBarProps {
  points: number;
}

export function TopBar({ points }: TopBarProps) {
  return (
    <header className="flex items-center justify-between py-2">
      {/* Logo — radio ikonka + warm gradient */}
      <div className="flex items-center gap-2">
        <Radio size={22} fill="currentColor" strokeWidth={1.5} className="text-[var(--accent)]" />
        <span className="text-[17px] font-extrabold tracking-[1.5px] uppercase logo-gradient font-display">
          INTRA GROUP
        </span>
      </div>

      {/* Points badge — JetBrains Mono */}
      <div
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
        style={{
          background: 'rgba(27,27,48,0.8)',
          border: '1px solid rgba(249,115,22,0.25)',
          boxShadow: '0 0 15px rgba(249,115,22,0.12)',
        }}
      >
        <Zap size={16} className="text-[var(--accent-light)]" />
        <span className="font-mono text-sm font-bold text-[var(--accent-light)] tabular-nums">
          {Number(points).toFixed(3)}
        </span>
      </div>
    </header>
  );
}
