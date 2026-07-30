interface LiveDotProps {
  color?: string;
  pulse?: boolean;
  size?: number;
}

// Pulsing status dot — used for "live"/"pending"/"idle" indicators across
// AnonsScreen, SlotsScreen and Admin. One implementation instead of the
// ping+dot pair being hand-duplicated per screen.
export function LiveDot({ color = 'var(--live)', pulse = true, size = 8 }: LiveDotProps) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, background: color }}
      />
    </span>
  );
}
