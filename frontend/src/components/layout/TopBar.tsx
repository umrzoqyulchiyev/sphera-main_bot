import { Radio, Zap } from 'lucide-react';
import { GlitchText } from '../ui/GlitchText';

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
          background: 'rgba(13,13,16,0.8)',
          border: '1px solid rgba(0,240,192,0.16)',
        }}
      >
        <Zap size={16} className="text-[#9a9a9a]" />
        <GlitchText
          tag="span"
          text={Number(points).toFixed(3)}
          className="font-mono text-sm font-bold text-[#EDEDED] tabular-nums"
        />
      </div>
    </header>
  );
}
