import { useEffect, useState, useCallback } from 'react';
import { Headphones, MessageSquare, Mic } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { AnnouncementBanner } from './AnnouncementBanner';
import { getAnnouncements, updateLanguage, updateBroadcastLang } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import type { User, Announcements, Language } from '../../types';

interface AnonsScreenProps {
  user: User | null;
  onUserUpdate: (user: User) => void;
}

export function AnonsScreen({ user, onUserUpdate }: AnonsScreenProps) {
  const { t, lang, setLang } = useTranslation();
  const [announcements, setAnnouncements] = useState<Announcements>({
    banner1: null,
    banner2: null,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (e) {
      console.error('[AnonsScreen] Failed to load announcements:', e);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
    // Trigger mount animation
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, [loadAnnouncements]);

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

      {/* Live Status Indicator */}
      <LiveStatusCard />

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
              <div className="w-9 h-9 rounded-xl bg-[rgba(56,225,255,0.08)] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#38e1ff]" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] text-[#8b9bb3] leading-relaxed">
                {feature.text}
              </span>
            </div>
            {!isLast && (
              <div className="h-px ml-12 bg-[rgba(80,160,255,0.08)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LiveStatusCard() {
  return (
    <div className="glass px-4 py-3 rounded-2xl flex items-center gap-3">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38e1ff] opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#38e1ff]" />
      </span>
      <span className="text-[10px] font-bold tracking-[2px] text-[#6b7c9e] uppercase">
        Stream Active
      </span>
    </div>
  );
}
