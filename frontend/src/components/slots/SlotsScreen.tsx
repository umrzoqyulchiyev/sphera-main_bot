import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, Radio, Share2, Loader } from 'lucide-react';
import { getUpcomingSlots, type BroadcastSlot } from '../../lib/api';
import { getLang } from '../../lib/i18n';
import { StatusBadge } from '../ui/StatusBadge';
import type { User } from '../../types';

interface Props {
  user: User | null;
}

const L: Record<string, Record<string, string>> = {
  ru: {
    title: 'Расписание эфиров',
    subtitle: 'Предстоящие прямые эфиры',
    no_slots: 'Нет запланированных эфиров',
    no_slots_sub: 'Следите за анонсами в боте',
    live_now: 'СЕЙЧАС В ЭФИРЕ',
    soon: 'Скоро',
    scheduled: 'Запланирован',
    host: 'Ведущий',
    duration: 'мин',
    share: 'Поделиться',
    countdown: 'До эфира',
    days: 'д',
    hours: 'ч',
    minutes: 'м',
    seconds: 'с',
  },
  en: {
    title: 'Broadcast schedule',
    subtitle: 'Upcoming live broadcasts',
    no_slots: 'No scheduled broadcasts',
    no_slots_sub: 'Follow announcements in the bot',
    live_now: 'LIVE NOW',
    soon: 'Soon',
    scheduled: 'Scheduled',
    host: 'Host',
    duration: 'min',
    share: 'Share',
    countdown: 'Until broadcast',
    days: 'd',
    hours: 'h',
    minutes: 'm',
    seconds: 's',
  },
  lt: {
    title: 'Etero tvarkaraštis',
    subtitle: 'Artėjantys tiesioginiai eterai',
    no_slots: 'Nėra suplanuotų eterų',
    no_slots_sub: 'Sekite pranešimus bote',
    live_now: 'DABAR ETERYJE',
    soon: 'Netrukus',
    scheduled: 'Suplanuota',
    host: 'Vedėjas',
    duration: 'min',
    share: 'Dalintis',
    countdown: 'Iki eterio',
    days: 'd',
    hours: 'v',
    minutes: 'm',
    seconds: 's',
  },
};

function useCountdown(targetSec: number) {
  const [remaining, setRemaining] = useState(targetSec);
  const ref = useRef(targetSec);
  ref.current = targetSec;

  useEffect(() => {
    setRemaining(targetSec);
    if (targetSec <= 0) return;
    const iv = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [targetSec]);

  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return { d, h, m, s, total: remaining };
}

function SlotCard({ slot, lang }: { slot: BroadcastSlot; lang: string }) {
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const { d, h, m, s, total } = useCountdown(slot.countdown_sec);

  const hostName = slot.display_name || slot.username || `@${slot.host_telegram_id}`;

  const shareSlot = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink && slot.share_url) {
      tg.openTelegramLink(slot.share_url);
    } else if (slot.share_url) {
      window.open(slot.share_url, '_blank');
    }
  };

  return (
    <div className="stitch-card p-4"
      style={slot.is_live_now ? { border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.05)' } : {}}>

      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        {slot.is_live_now ? (
          <StatusBadge label={tx('live_now')} tone="danger" dot />
        ) : slot.is_soon ? (
          <StatusBadge label={tx('soon')} tone="warning" dot />
        ) : (
          <StatusBadge label={tx('scheduled')} tone="muted" icon={<Calendar className="w-3 h-3" />} />
        )}
        <span className="text-[10px] text-[#94A3B8]">{slot.duration_min} {tx('duration')}</span>
      </div>

      {/* Title */}
      <div className="text-[15px] font-black text-[#F8FAFC] mb-1 leading-tight">{slot.title}</div>
      {slot.description && (
        <div className="text-[12px] text-[#94A3B8] mb-2 leading-relaxed">{slot.description}</div>
      )}

      {/* Host */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(249,115,22,0.1)' }}>
          <Radio className="w-3 h-3 text-[#F97316]" />
        </div>
        <span className="text-[11px] text-[#94A3B8]">{tx('host')}: </span>
        <span className="text-[11px] font-semibold text-[#F8FAFC]">{hostName}</span>
      </div>

      {/* Countdown (agar live emas va vaqt qolgan bo'lsa) */}
      {!slot.is_live_now && total > 0 && (
        <div className="rounded-xl px-3 py-2.5 mb-3"
          style={{ background: 'rgba(15,15,35,0.5)', border: '1px solid rgba(249,115,22,0.1)' }}>
          <div className="text-[9px] text-[#94A3B8] uppercase tracking-wide mb-1.5">{tx('countdown')}</div>
          <div className="flex items-baseline gap-3">
            {d > 0 && (
              <div className="text-center">
                <div className="text-xl font-black text-[#F97316] tabular-nums"
                  style={{ textShadow: '0 0 15px rgba(249,115,22,0.5)' }}>{d}</div>
                <div className="text-[8px] text-[#94A3B8] uppercase">{tx('days')}</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-xl font-black text-[#F97316] tabular-nums"
                style={{ textShadow: '0 0 15px rgba(249,115,22,0.5)' }}>
                {String(h).padStart(2, '0')}
              </div>
              <div className="text-[8px] text-[#94A3B8] uppercase">{tx('hours')}</div>
            </div>
            <div className="text-[#94A3B8] font-bold mb-2">:</div>
            <div className="text-center">
              <div className="text-xl font-black text-[#F97316] tabular-nums"
                style={{ textShadow: '0 0 15px rgba(249,115,22,0.5)' }}>
                {String(m).padStart(2, '0')}
              </div>
              <div className="text-[8px] text-[#94A3B8] uppercase">{tx('minutes')}</div>
            </div>
            <div className="text-[#94A3B8] font-bold mb-2">:</div>
            <div className="text-center">
              <div className="text-xl font-black text-[#F97316] tabular-nums"
                style={{ textShadow: '0 0 15px rgba(249,115,22,0.5)' }}>
                {String(s).padStart(2, '0')}
              </div>
              <div className="text-[8px] text-[#94A3B8] uppercase">{tx('seconds')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Share */}
      {slot.share_url && (
        <button onClick={shareSlot}
          className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold active:scale-95 transition-transform"
          style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)', color: '#F97316' }}>
          <Share2 className="w-4 h-4" />
          {tx('share')}
        </button>
      )}
    </div>
  );
}

export function SlotsScreen({}: Props) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const [slots, setSlots] = useState<BroadcastSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getUpcomingSlots();
      setSlots(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000); // har 30s yangilash
    return () => clearInterval(iv);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader className="w-8 h-8 text-[#F97316] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="stitch-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Clock className="w-5 h-5 text-[#F97316]" />
          </div>
          <div>
            <div className="text-base font-black text-[#F8FAFC]">{tx('title')}</div>
            <div className="text-[11px] text-[#94A3B8]">{tx('subtitle')}</div>
          </div>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="stitch-card p-10 text-center">
          <Clock className="w-12 h-12 text-[#94A3B8] mx-auto mb-4" />
          <div className="text-sm font-bold text-[#F8FAFC] mb-1">{tx('no_slots')}</div>
          <div className="text-[11px] text-[#94A3B8]">{tx('no_slots_sub')}</div>
        </div>
      ) : (
        slots.map(slot => <SlotCard key={slot.id} slot={slot} lang={lang} />)
      )}
    </div>
  );
}
