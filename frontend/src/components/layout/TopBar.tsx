interface TopBarProps {
  points: number;
}

export function TopBar({ points }: TopBarProps) {
  return (
    <header className="flex items-center justify-between py-2">
      {/* Logo — radio ikonka + 3 rangli gradient (Stitch) */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined fill text-[#38e1ff]" style={{ fontSize: 22 }}>
          radio
        </span>
        <span className="text-[17px] font-extrabold tracking-[1.5px] uppercase logo-gradient">
          INTRA GROUP
        </span>
      </div>

      {/* Points badge — JetBrains Mono */}
      <div
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
        style={{
          background: 'rgba(37,42,53,0.6)',
          border: '1px solid rgba(56,225,255,0.2)',
          boxShadow: '0 0 15px rgba(39,217,247,0.1)',
        }}
      >
        <span className="material-symbols-outlined text-[#27d9f7]" style={{ fontSize: 16 }}>
          bolt
        </span>
        <span className="font-mono text-sm font-bold text-[#27d9f7] tabular-nums">
          {Number(points).toFixed(3)}
        </span>
      </div>
    </header>
  );
}
