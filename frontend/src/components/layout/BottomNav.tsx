import { MessageCircle, TrendingUp, Radio, Music, User } from 'lucide-react';
import type { Screen } from '../../types';

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  // Profil tugmasi ustidagi значok — masalan ko'rib chiqilmagan kasting
  // arizalari soni (faqat haqiqiy admin uchun beriladi, boshqalarda 0).
  profileBadgeCount?: number;
}

const ICONS: Record<string, typeof MessageCircle> = {
  chat: MessageCircle,
  show_chart: TrendingUp,
  radio: Radio,
  music_note: Music,
  person: User,
};

export function BottomNav({ currentScreen, onNavigate, profileBadgeCount = 0 }: BottomNavProps) {
  // Stitch dizayni: chat | podcasts | [ORB] | spatial_audio | person
  const navItems: { id: Screen; icon: string; isCenter?: boolean }[] = [
    { id: 'anons', icon: 'chat' },
    { id: 'stats', icon: 'show_chart' },
    { id: 'efir', icon: 'radio', isCenter: true },
    { id: 'music', icon: 'music_note' },
    { id: 'profile', icon: 'person' },
  ];

  return (
    <nav className="rift-zone-u5 fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="pointer-events-auto max-w-[460px] sm:max-w-[480px] lg:max-w-[520px] mx-auto px-4 pt-2"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(13,13,16,0.92) 30%, rgba(13,13,16,0.99) 100%)',
          // Android jismoniy "Kнопки" navigatsiya paneli bilan
          // to'qnashmasin — Telegram native ilova bergan --tg-safe-bottom
          // (ishonchliroq) va brauzerning o'z env(safe-area-inset-bottom)
          // ikkalasidan kattarog'i olinadi.
          paddingBottom: 'calc(6px + max(env(safe-area-inset-bottom), var(--tg-safe-bottom, 0px)))',
        }}
      >
        <div
          className="flex justify-around items-center h-[60px] px-2.5 relative"
          style={{
            background: 'rgba(13,13,16,0.94)',
            border: '2px solid rgba(0,240,192,0.3)',
            borderRadius: '10px',
            boxShadow: '3px 3px 0 rgba(0,0,0,0.4), 0 -4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            const Icon = ICONS[item.icon];

            if (item.isCenter) {
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="relative -translate-y-4 active:scale-90 transition-transform duration-150"
                  aria-label="efir"
                >
                  {/* Aylanuvchi tashqi halqa */}
                  <span className="orb-ring" />
                  {/* Asosiy orb + ichida radio ikonka */}
                  <div className={`orb-nav ${isActive ? 'orb-active' : ''}`}>
                    <Icon size={21} fill="currentColor" strokeWidth={1.5} />
                  </div>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="relative flex items-center justify-center w-10 h-10 transition-all duration-200 active:scale-90"
                style={{
                  color: isActive ? '#001a14' : '#9a9a9a',
                  background: isActive ? '#00F0C0' : 'rgba(0,240,192,0.06)',
                  border: isActive ? '2px solid #EDEDED' : '1px solid rgba(0,240,192,0.18)',
                  borderRadius: isActive ? '8px' : '6px',
                  boxShadow: isActive ? '2px 2px 0 rgba(0,0,0,0.35)' : 'none',
                  transform: isActive ? 'rotate(-2deg) scale(1.05)' : 'scale(1)',
                }}
              >
                <Icon size={19} fill={isActive ? 'currentColor' : 'none'} strokeWidth={2} />
                {item.id === 'profile' && profileBadgeCount > 0 && (
                  <span
                    className="absolute top-0 right-0.5 min-w-[16px] h-[16px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-extrabold text-white"
                    style={{ background: '#FF3B5C', boxShadow: '0 0 0 2px #0d0d10' }}
                  >
                    {profileBadgeCount > 9 ? '9+' : profileBadgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
