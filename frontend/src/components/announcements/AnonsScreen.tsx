import { useEffect, useState, useCallback } from 'react';
import { Headphones, MessageSquare, Mic, Radio, Clock, Share2, ChevronRight } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { AnnouncementBanner } from './AnnouncementBanner';
import { LiveDot } from '../ui/LiveDot';
import { getAnnouncements, updateLanguage, updateBroadcastLang, getVoiceChatStatus, getUpcomingSlots, type VoiceChatStatus, type BroadcastSlot } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import type { User, Announcements, Language, Screen } from '../../types';

interface AnonsScreenProps {
  user: User | null;
  onUserUpdate: (user: User) => void;
  onNavigate?: (screen: Screen) => void;
}

export function AnonsScreen({ user, onUserUpdate, onNavigate }: AnonsScreenProps) {
  const { t, lang, setLang } = useTranslation();
  const [announcements, setAnnouncements] = useState<Announcements>({
    banner1: null,
    banner2: null,
  });
  const [vcStatus, setVcStatus] = useState<VoiceChatStatus | null>(null);
  const [upcomingSlots, setUpcomingSlots] = useState<BroadcastSlot[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (e) {
      console.error('[AnonsScreen] Failed to load announcements:', e);
    }
  }, []);

  const loadVcStatus = useCallback(async () => {
    try {
      const status = await getVoiceChatStatus();
      setVcStatus(status);
    } catch {}
  }, []);

  useEffect(() => {
    loadAnnouncements();
    loadVcStatus();
    getUpcomingSlots().then(setUpcomingSlots).catch(() => {});
    const timer = setTimeout(() => setIsLoaded(true), 50);
    const vcInterval = setInterval(loadVcStatus, 30000); // har 30s
    return () => { clearTimeout(timer); clearInterval(vcInterval); };
  }, [loadAnnouncements, loadVcStatus]);

  const handleLangChange = useCallback(
    async (newLang: Language) => {
      setLang(newLang);
      try {
        await updateLanguage(newLang);
        await updateBroadcastLang(newLang);
        if (user) {
          onUserUpdate({ ...user, language: newLang, broadcast_lang: newLang });
        }
      } catch (e) {
        console.error('[AnonsScreen] Failed to update language:', e);
      }
    },
    [user, onUserUpdate, setLang]
  );

  const hasAnnouncements = announcements.banner1 || announcements.banner2;

  return (
    <div
      className={`flex flex-col gap-3 transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Language Selector */}
      <LanguageSelector selectedLang={lang} onLangChange={handleLangChange} />

      {/* Platform Features */}
      <FeaturesCard
        features={[
          { icon: Headphones, text: t('onb_1') },
          { icon: MessageSquare, text: t('onb_2') },
          { icon: Mic, text: t('onb_3') },
        ]}
      />

      {/* Voice Chat Status */}
      <VoiceChatStatusCard status={vcStatus} lang={lang} />

      {/* Upcoming Broadcast Slots */}
      {upcomingSlots.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onNavigate?.('schedule')}
            className="text-[10px] font-bold tracking-[2px] text-[var(--muted)] uppercase px-1 flex items-center gap-1.5 justify-between"
          >
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {lang === 'ru' ? 'Ближайшие эфиры' : lang === 'lt' ? 'Artėjantys eterai' : 'Upcoming broadcasts'}
            </span>
            {onNavigate && <ChevronRight className="w-3 h-3" />}
          </button>
          {upcomingSlots.map(slot => (
            <div key={slot.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
              style={slot.is_live_now ? { border: '1px solid rgba(239,68,68,0.3)' } : {}}>
              <div className="flex-shrink-0">
                {slot.is_live_now ? (
                  <LiveDot color="#EF4444" />
                ) : slot.is_soon ? (
                  <LiveDot color="#EAB308" />
                ) : (
                  <LiveDot color="#94A3B8" pulse={false} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-[var(--text)] truncate">{slot.title}</div>
                <div className="text-[10px] text-[var(--muted)]">
                  {slot.is_live_now
                    ? (lang === 'ru' ? '🔴 СЕЙЧАС В ЭФИРЕ' : lang === 'lt' ? '🔴 DABAR ETERYJE' : '🔴 LIVE NOW')
                    : new Date(slot.scheduled_at).toLocaleString()}
                </div>
              </div>
              {slot.share_url && (
                <a href={slot.share_url} target="_blank" rel="noreferrer"
                  className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(148,163,184,0.1)' }}>
                  <Share2 className="w-3.5 h-3.5 text-[var(--text)]" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Announcement Banners */}
      {hasAnnouncements && (
        <div className="flex flex-col gap-3">
          {announcements.banner1 && (
            <AnnouncementBanner announcement={announcements.banner1} />
          )}
          {announcements.banner2 && (
            <AnnouncementBanner announcement={announcements.banner2} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

interface FeatureItem {
  icon: typeof Headphones;
  text: string;
}

function FeaturesCard({ features }: { features: FeatureItem[] }) {
  return (
    <div className="glass p-4 rounded-2xl flex flex-col gap-0">
      {features.map((feature, idx) => {
        const Icon = feature.icon;
        const isLast = idx === features.length - 1;

        return (
          <div key={idx}>
            <div className="flex items-center gap-3 py-2.5">
              <div className="w-9 h-9 rounded-xl bg-[rgba(148,163,184,0.1)] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[var(--text)]" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] text-[var(--muted)] leading-relaxed">
                {feature.text}
              </span>
            </div>
            {!isLast && (
              <div className="h-px ml-12 bg-[rgba(148,163,184,0.08)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

const vcLabels: Record<string, Record<string, string>> = {
  ru: { active: 'Voice Chat — В Эфире', waiting: 'Voice Chat — Ожидание', setup: 'Voice Chat — Настройка' },
  en: { active: 'Voice Chat — On Air', waiting: 'Voice Chat — Waiting', setup: 'Voice Chat — Setup' },
  lt: { active: 'Voice Chat — Eteryje', waiting: 'Voice Chat — Laukiama', setup: 'Voice Chat — Nustatymas' },
};

function VoiceChatStatusCard({ status, lang }: { status: VoiceChatStatus | null; lang: string }) {
  const labels = vcLabels[lang] || vcLabels.ru;

  // Determine actual state
  let label: string;
  let isLive = false;

  if (!status || !status.configured) {
    label = labels.setup;
  } else if (status.in_call) {
    label = labels.active;
    isLive = true;
  } else {
    label = labels.waiting;
  }

  return (
    <div className="glass px-4 py-3 rounded-2xl flex items-center gap-3">
      <LiveDot color={isLive ? '#22C55E' : '#94A3B8'} pulse={isLive} />
      <Radio className="w-3.5 h-3.5 text-[var(--muted)]" />
      <span className="text-[10px] font-bold tracking-[2px] text-[var(--muted)] uppercase">
        {label}
      </span>
    </div>
  );
}
