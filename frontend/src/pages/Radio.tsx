import { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { BottomNav } from '../components/layout/BottomNav';
import { AnonsScreen } from '../components/announcements/AnonsScreen';
import { EfirScreen } from '../components/radio/EfirScreen';
import { ProfileScreen } from '../components/profile/ProfileScreen';
import { StatsScreen } from '../components/stats/StatsScreen';
import { FavoritesScreen } from '../components/favorites/FavoritesScreen';
import { OnboardingModal } from '../components/ui/OnboardingModal';
import { getMe } from '../lib/api';
import { authenticate, isAuthenticated } from '../lib/auth';
import { DEFAULT_CITY, LS_CITY } from '../lib/config';
import type { Screen, User } from '../types';

const ONBOARDING_KEY = 'sfera5_onboarded';

export function Radio() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('anons');
  const [user, setUser] = useState<User | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      if (!isAuthenticated()) {
        try {
          await authenticate();
          if (!localStorage.getItem(LS_CITY)) {
            localStorage.setItem(LS_CITY, DEFAULT_CITY);
          }
        } catch (e) {
          console.error('[Radio] Auth error:', e);
          // Loop'ga tushmaslik uchun bu yerda navigate('/') QILMAYMIZ.
          // Auth keyinroq loadUser ichida qayta urinadi.
        }
      }

      async function loadUser() {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch (e) {
          console.error('[Radio] Failed to load user:', e);
          try {
            await authenticate();
            const userData = await getMe();
            setUser(userData);
          } catch (retryError) {
            console.error('[Radio] Re-auth failed:', retryError);
          }
        }
      }

      await loadUser();

      if (!localStorage.getItem(ONBOARDING_KEY)) {
        setShowOnboarding(true);
      }
    }

    init();
  }, []);

  const handlePointsUpdate = (newPoints: number) => {
    if (user) {
      setUser({ ...user, points: newPoints });
    }
  };

  const handleCloseOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  const handleNavigate = (newScreen: Screen) => {
    if (newScreen === currentScreen) return;
    setCurrentScreen(newScreen);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const renderScreen = (screen: Screen) => {
    switch (screen) {
      case 'anons':
        return <AnonsScreen user={user} onUserUpdate={setUser} />;
      case 'efir':
        return <EfirScreen user={user} onPointsUpdate={handlePointsUpdate} />;
      case 'stats':
        return <StatsScreen user={user} />;
      case 'favorites':
        return <FavoritesScreen user={user} />;
      case 'profile':
        return <ProfileScreen user={user} onUserUpdate={setUser} />;
      default:
        return <AnonsScreen user={user} onUserUpdate={setUser} />;
    }
  };

  return (
    <div
      className="bg-[#060a14] text-[#dbe9ff] flex flex-col relative"
      style={{ height: 'var(--app-vh)', overflow: 'hidden' }}
    >
      {/* Background ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(56,225,255,0.06)_0%,transparent_70%)]" />
      </div>

      {/* Asosiy scroll container — mouse wheel + touch ikkalasi ishlaydi */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          /* scrollbar ko'rinmaydi lekin ishlaydi */
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div className="w-full max-w-[460px] sm:max-w-[480px] lg:max-w-[520px] mx-auto px-4 pt-3 pb-[120px] flex flex-col gap-4">
          <TopBar points={user?.points || 0} />
          {renderScreen(currentScreen)}
        </div>
      </div>

      <BottomNav currentScreen={currentScreen} onNavigate={handleNavigate} />
      <OnboardingModal isOpen={showOnboarding} onClose={handleCloseOnboarding} />
    </div>
  );
}
