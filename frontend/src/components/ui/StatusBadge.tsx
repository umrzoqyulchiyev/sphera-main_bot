import type { ReactNode } from 'react';
import { LiveDot } from './LiveDot';

export type BadgeTone = 'live' | 'warning' | 'danger' | 'muted' | 'accent' | 'ai';

const TONE_STYLES: Record<BadgeTone, { bg: string; border: string; text: string }> = {
  live: { bg: 'rgba(57,255,106,0.12)', border: 'rgba(57,255,106,0.3)', text: '#39FF6A' },
  warning: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', text: '#00F0C0' },
  danger: { bg: 'rgba(255,59,92,0.12)', border: 'rgba(255,59,92,0.3)', text: '#FF3B5C' },
  muted: { bg: 'rgba(0,240,192,0.1)', border: 'rgba(0,240,192,0.25)', text: '#9a9a9a' },
  accent: { bg: 'rgba(0,240,192,0.12)', border: 'rgba(0,240,192,0.3)', text: '#00F0C0' },
  ai: { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', text: '#B993FF' },
};

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
}

// Color-coded status pill — replaces the per-screen `statusColor` maps
// duplicated across Admin (Topics/Drafts/Slots), CastingScreen and
// SlotsScreen with one shared, tone-driven implementation.
export function StatusBadge({ label, tone, dot = false, icon }: StatusBadgeProps) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide font-display"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {dot && <LiveDot color={s.text} size={6} pulse={tone === 'live'} />}
      {icon}
      {label}
    </span>
  );
}
