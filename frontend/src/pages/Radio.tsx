import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Gift, Sparkles } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { BottomNav } from '../components/layout/BottomNav';
import { ChatScreen } from '../components/radio/ChatScreen';
import { EfirScreen } from '../components/radio/EfirScreen';
import { ProfileScreen } from '../components/profile/ProfileScreen';
import { StatsScreen } from '../components/stats/StatsScreen';
import { MusicScreen } from '../components/music/MusicScreen';
import { SlotsScreen } from '../components/slots/SlotsScreen';
import { CastingScreen } from '../components/casting/CastingScreen';
import { OnboardingModal } from '../components/ui/OnboardingModal';
import { getMe, getPointsHistory } from '../lib/api';
import { authenticate, isAuthenticated } from '../lib/auth';
import { DEFAULT_CITY, LS_CITY } from '../lib/config';
import { t } from '../lib/i18n';
import type { Screen, User } from '../types';

const ONBOARDING_KEY = 'sfera5_onboarded';
const POINTS_POLL_MS = 20000;

export function Radio() {
  // Admin panelidan "Orqaga" bosilganda qaysi tabga qaytish kerakligi
  // location.state orqali keladi (masalan { screen: 'profile' }) — aks holda
  // Radio har safar remount bo'lganda tab holati yo'qolib, doim 'anons'ga
  // tushib qolar edi.
  const location = useLocation();
  const [currentScreen, setCurrentScreen] = useState<Screen>((location.state as { screen?: Screen } | null)?.screen || 'anons');
  const [user, setUser] = useState<User | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pointsNotice, setPointsNotice] = useState<{ text: string; gift: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTxIdRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          // Backend points ni string qaytaradi — number'ga convert qilamiz
          setUser({ ...userData, points: Number(userData.points) || 0 });
        } catch (e) {
          console.error('[Radio] Failed to load user:', e);
          try {
            await authenticate();
            const userData = await getMe();
            setUser({ ...userData, points: Number(userData.points) || 0 });
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

  // Уведомление о получении поинтов (перевод от пользователя, подарок
  // от админа) — опрашиваем историю, т.к. WS-чат подключён только на
  // вкладке "Анонсы" и не ловит события с других вкладок.
  //
  // Telegram Mini App odatda "yopib qayta ochish"da haqiqiy sahifa
  // reload'i qilmaydi — WebView shunchaki background'dan qaytadi va
  // JS taymerlari pauza bo'lib qolgan bo'lishi mumkin. Shuning uchun
  // faqat setInterval'ga tayanmaymiz — ilova qayta faollashganda
  // (visibilitychange/focus/pageshow) darhol qayta tekshiramiz.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const history = await getPointsHistory();
        if (cancelled || history.length === 0) return;

        if (lastTxIdRef.current === null) {
          // Birinchi so'rov — faqat boshlang'ich holatni belgilaymiz,
          // eski tranzaksiyalar uchun bildirishnoma ko'rsatmaymiz.
          lastTxIdRef.current = Math.max(...history.map((h) => h.id));
          return;
        }

        const lastSeenId = lastTxIdRef.current;
        const fresh = history.filter((h) => h.id > lastSeenId);
        if (fresh.length === 0) return;
        lastTxIdRef.current = Math.max(lastSeenId, ...fresh.map((h) => h.id));

        // Balansni har doim yangilaymiz (chat/studiya orqali sarflangan
        // bo'lsa ham UI eskirmasin), bildirishnomani esa faqat kirim uchun.
        try {
          const updatedUser = await getMe();
          if (!cancelled) setUser({ ...updatedUser, points: Number(updatedUser.points) || 0 });
        } catch { /* balans keyingi poll'da yangilanadi */ }

        const incoming = fresh.find((h) => h.event_type === 'transfer_in' || h.event_type === 'gift');
        if (incoming) {
          const amount = Number(incoming.amount).toFixed(3);
          const key = incoming.event_type === 'gift' ? 'notify_points_gift' : 'notify_points_received';
          const text = t(key).replace('{amount}', amount);
          if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
          setPointsNotice({ text, gift: incoming.event_type === 'gift' });
          noticeTimeoutRef.current = setTimeout(() => { if (!cancelled) setPointsNotice(null); }, 4500);
        }
      } catch { /* tarmoq xatosi — keyingi poll urinib ko'radi */ }
      finally { inFlight = false; }
    }

    function onWake() {
      if (document.visibilityState === 'visible') poll();
    }

    poll();
    const interval = setInterval(poll, POINTS_POLL_MS);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, [!!user]);

  const handlePointsUpdate = (newPoints: number) => {
    if (user) {
      setUser({ ...user, points: Number(newPoints) || 0 });
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
        return <ChatScreen user={user} onPointsUpdate={handlePointsUpdate} />;
      case 'efir':
        return <EfirScreen user={user} onPointsUpdate={handlePointsUpdate} onNavigate={handleNavigate} />;
      case 'stats':
        return <StatsScreen user={user} />;
      case 'music':
        return <MusicScreen user={user} onPointsUpdate={handlePointsUpdate} />;
      case 'schedule':
        return <SlotsScreen user={user} />;
      case 'casting':
        return <CastingScreen />;
      case 'profile':
        return <ProfileScreen user={user} onUserUpdate={setUser} />;
      default:
        return <ChatScreen user={user} onPointsUpdate={handlePointsUpdate} />;
    }
  };

  // Chat ekrani — to'liq balandlikda, o'z ichida scroll qiladi (boshqa ekranlar
  // kabi umumiy sahifa scroll'iga bog'lanmaydi)
  const isChat = currentScreen === 'anons';

  return (
    <div
      className="bg-[#050506] text-[#ededef] flex flex-col relative"
      style={{ height: 'var(--app-vh)', overflow: 'hidden' }}
    >
      {/* Background ambient */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(94,106,210,0.06)_0%,transparent_70%)]" />
      </div>

      {/* Asosiy scroll container — mouse wheel + touch ikkalasi ishlaydi */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1"
        style={{
          overflowY: isChat ? 'hidden' : 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          /* scrollbar ko'rinmaydi lekin ishlaydi */
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div
          className={`w-full max-w-[460px] sm:max-w-[480px] lg:max-w-[520px] mx-auto px-4 pt-3 flex flex-col gap-4 ${
            isChat ? 'h-full pb-[100px]' : 'pb-[190px]'
          }`}
        >
          <TopBar points={user?.points || 0} />
          {isChat ? (
            <div className="flex-1 min-h-0 flex flex-col">{renderScreen(currentScreen)}</div>
          ) : (
            renderScreen(currentScreen)
          )}
        </div>
      </div>

      <BottomNav currentScreen={currentScreen} onNavigate={handleNavigate} />
      <OnboardingModal isOpen={showOnboarding} onClose={handleCloseOnboarding} />
      {pointsNotice && (
        <div
          className="fixed top-[calc(12px+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[2500] w-[92%] max-w-[400px] cursor-pointer"
          onClick={() => setPointsNotice(null)}
        >
          <div
            className="glass rounded-2xl px-4 py-3 flex items-center gap-3 animate-[slideDown_0.25s_ease-out]"
            style={{ border: '1px solid rgba(34,227,165,0.35)', boxShadow: '0 8px 30px rgba(34,227,165,0.15)' }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[rgba(34,227,165,0.15)] text-[#22e3a5]">
              {pointsNotice.gift ? <Gift size={18} /> : <Sparkles size={18} />}
            </div>
            <span className="text-sm font-semibold text-[#ededef]">{pointsNotice.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
