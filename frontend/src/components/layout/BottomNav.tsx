import { MessageCircle, TrendingUp, Radio, Music, User } from 'lucide-react';
import type { Screen } from '../../types';

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const ICONS: Record<string, typeof MessageCircle> = {
  chat: MessageCircle,
  show_chart: TrendingUp,
  radio: Radio,
  music_note: Music,
  person: User,
};

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
  // Stitch dizayni: chat | podcasts | [ORB] | spatial_audio | person
  const navItems: { id: Screen; icon: string; isCenter?: boolean }[] = [
    { id: 'anons', icon: 'chat' },
    { id: 'stats', icon: 'show_chart' },
    { id: 'efir', icon: 'radio', isCenter: true },
    { id: 'music', icon: 'music_note' },
    { id: 'profile', icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="pointer-events-auto max-w-[460px] sm:max-w-[480px] lg:max-w-[520px] mx-auto px-4 pb-[calc(6px+env(safe-area-inset-bottom))] pt-2"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(15,15,35,0.92) 30%, rgba(15,15,35,0.99) 100%)',
        }}
      >
        <div
          className="flex justify-around items-center h-[58px] px-2 rounded-[24px] relative"
          style={{
            background: 'rgba(27,27,48,0.92)',
            border: '1px solid rgba(148,163,184,0.14)',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
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
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-90"
                style={{
                  color: isActive ? '#F97316' : '#94A3B8',
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <Icon size={21} fill={isActive ? 'currentColor' : 'none'} strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
