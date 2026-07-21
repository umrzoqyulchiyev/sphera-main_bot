import type { ReactNode } from 'react';
import { LiveDot } from './LiveDot';

export type BadgeTone = 'live' | 'warning' | 'danger' | 'muted' | 'accent' | 'ai';

const TONE_STYLES: Record<BadgeTone, { bg: string; border: string; text: string }> = {
  live: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#22C55E' },
  warning: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', text: '#EAB308' },
  danger: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#EF4444' },
  muted: { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', text: '#94A3B8' },
  accent: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', text: '#F97316' },
  ai: { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', text: '#A78BFA' },
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
