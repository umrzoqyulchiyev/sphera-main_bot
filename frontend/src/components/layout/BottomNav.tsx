import type { Screen } from '../../types';

interface BottomNavProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

/* Ikonkalar — rasmdagidek SVG */
const Icons = {
  // ⚙️ Anons / settings
  anons: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/>
    </svg>
  ),
  // 〰️ Waveform / stats
  stats: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  // 🔵 Center orb — Efir
  efir: (active: boolean) => (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
      style={{
        background: active
          ? 'radial-gradient(circle at 35% 35%, #5ef0ff 0%, #38e1ff 30%, #2ea8ff 70%, #1a6aff 100%)'
          : 'radial-gradient(circle at 35% 35%, rgba(56,225,255,0.5) 0%, rgba(46,168,255,0.3) 60%, rgba(26,106,255,0.2) 100%)',
        border: active ? '2px solid rgba(56,225,255,0.8)' : '2px solid rgba(56,225,255,0.25)',
        boxShadow: active
          ? '0 0 20px rgba(56,225,255,0.7), 0 0 40px rgba(46,168,255,0.4), inset 0 1px 0 rgba(255,255,255,0.3)'
          : '0 0 10px rgba(56,225,255,0.2)',
      }}
    >
      <div
        className="w-5 h-5 rounded-full"
        style={{
          background: active ? 'rgba(255,255,255,0.9)' : 'rgba(56,225,255,0.6)',
          boxShadow: active ? '0 0 8px rgba(255,255,255,0.8)' : 'none',
        }}
      />
    </div>
  ),
  // ⭐ Favorites
  favorites: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  // 👤 Profile
  profile: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
  const navItems: { id: Screen; isCenter?: boolean }[] = [
    { id: 'anons' },
    { id: 'stats' },
    { id: 'efir', isCenter: true },
    { id: 'favorites' },
    { id: 'profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="pointer-events-auto max-w-[460px] mx-auto px-3 pb-[calc(6px+env(safe-area-inset-bottom))] pt-2"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(6,10,20,0.9) 25%, rgba(6,10,20,0.99) 100%)',
        }}
      >
        {/* Nav bar */}
        <div
          className="flex justify-around items-end px-1 py-2 rounded-[24px]"
          style={{
            background: 'rgba(10,18,36,0.95)',
            border: '1px solid rgba(56,225,255,0.1)',
            boxShadow: '0 -2px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            const iconFn = Icons[item.id];

            if (item.isCenter) {
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="-mt-5 active:scale-90 transition-transform duration-150"
                  aria-label="efir"
                >
                  {iconFn(isActive)}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 active:scale-90"
                style={{ color: isActive ? '#38e1ff' : '#6b7c9e' }}
              >
                {iconFn(isActive)}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
