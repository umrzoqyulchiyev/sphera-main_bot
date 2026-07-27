import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, MessageSquare, Sparkles, Globe, Headphones, Mic } from 'lucide-react';
import { authenticate } from '../lib/auth';
import { DEFAULT_CITY, LS_CITY } from '../lib/config';
import { useTranslation } from '../hooks/useTranslation';
import type { Language } from '../types';

export function Splash() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useTranslation('splash');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    async function init() {
      // Animate progress
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 12;
        });
      }, 150);

      try {
        await authenticate();
      } catch (e) {
        console.error('Auth error:', e);
      }

      clearInterval(interval);
      setProgress(100);
      setPhase('ready');

      localStorage.setItem(LS_CITY, DEFAULT_CITY);

      setTimeout(() => {
        // Avval platformaga kirган bo'lsa — to'g'ridan radio (loop bo'lmaydi).
        // Birinchi marta — til tanlash → yangilik → platforma (TZ).
        if (localStorage.getItem('sfera5_entered') === '1') {
          navigate('/radio');
        } else {
          navigate('/welcome');
        }
      }, 1200);
    }

    init();
  }, [navigate]);

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'lt', label: 'LT' },
    { code: 'ru', label: 'RU' },
  ];

  const features = [
    { icon: Radio, label: t('features_realtime') },
    { icon: Sparkles, label: t('features_ai') },
    { icon: MessageSquare, label: t('features_chat') },
    { icon: Globe, label: t('features_multilang') },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col items-center justify-center relative overflow-hidden px-5 py-8">

      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.09)_0%,transparent_70%)] animate-pulse" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(49,46,129,0.3)_0%,transparent_70%)]" />
      </div>

      {/* Language selector - top right. Telegram'ning o'z native
          свернуть/закрыть/⋮ tugmalari aynan shu burchakda bo'lgani uchun,
          qolgan ekranlar (Admin/RoomsScreen/EfirScreen/Chat) bilan bir xil
          76px + safe-area отступ ishlatiladi (avval hech qanday отступ
          yo'q edi — eng birinchi ko'rinadigan ekranda to'g'ridan-to'g'ri
          Telegram chromesi ustiga tushib qolardi). */}
      <div className="absolute right-4 z-20 flex gap-1.5" style={{ top: 'calc(76px + env(safe-area-inset-top))' }}>
        {languages.map(({ code, label }) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            className={`px-2.5 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-all duration-200 ${
              lang === code
                ? 'glass text-[var(--accent)] shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                : 'bg-[rgba(255,255,255,0.03)] text-[var(--muted)] border border-[rgba(255,255,255,0.06)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-[380px] flex flex-col items-center gap-8">

        {/* Logo / Orb area */}
        <div className="relative flex flex-col items-center gap-5">
          {/* Animated orb behind logo */}
          <div className="relative w-[140px] h-[140px] flex items-center justify-center">
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full border border-[rgba(249,115,22,0.22)]"
              style={{
                animation: 'spin 12s linear infinite',
                borderStyle: 'dashed',
                boxShadow: '0 0 30px rgba(249,115,22,0.12) inset',
              }}
            />
            {/* Middle ring */}
            <div
              className="absolute inset-4 rounded-full border border-[rgba(251,146,60,0.3)]"
              style={{
                animation: 'spin 18s linear infinite reverse',
                borderStyle: 'dashed',
              }}
            />
            {/* Inner glowing core */}
            <div
              className="absolute inset-8 rounded-full"
              style={{
                background: 'radial-gradient(circle at 40% 35%, rgba(249,115,22,0.4), rgba(49,46,129,0.25), rgba(15,15,35,0.9) 70%)',
                boxShadow: '0 0 40px rgba(249,115,22,0.3), inset 0 0 20px rgba(251,146,60,0.2)',
              }}
            />
            {/* Center icon */}
            <div className="relative z-10 w-14 h-14 rounded-full glass flex items-center justify-center">
              <Headphones className="w-7 h-7 text-[var(--accent)]" strokeWidth={1.8} />
            </div>
          </div>

          {/* Brand */}
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-[3px] logo-gradient font-display">
              INTRA GROUP
            </h1>
            <div className="flex items-center justify-center gap-3 mt-2">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-[rgba(249,115,22,0.4)]" />
              <p className="text-[10px] tracking-[4px] text-[var(--muted)] font-semibold uppercase">
                {t('brand_sub')}
              </p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-[rgba(249,115,22,0.4)]" />
            </div>
            <p className="text-xs text-[var(--muted)] mt-2.5 leading-relaxed">
              {t('tagline')}
            </p>
          </div>
        </div>

        {/* Features grid */}
        <div className="w-full grid grid-cols-2 gap-2.5">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="glass p-3.5 rounded-2xl flex items-center gap-3 group hover:border-[rgba(249,115,22,0.3)] transition-all duration-300"
              style={{
                animationDelay: `${idx * 100}ms`,
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-[rgba(249,115,22,0.12)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(249,115,22,0.18)] transition-colors">
                <feature.icon className="w-4.5 h-4.5 text-[var(--accent)]" strokeWidth={1.8} />
              </div>
              <span className="text-[11px] font-medium text-[var(--text)] leading-tight">
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        {/* Loading card */}
        <div className="w-full glass p-5 rounded-2xl">
          {/* Status */}
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className={`w-2 h-2 rounded-full ${phase === 'ready' ? 'bg-[var(--live)]' : 'bg-[var(--accent)] animate-pulse'}`} />
            <p className="text-sm font-medium text-[var(--text)]">
              {phase === 'ready' ? t('welcome') : t('connecting')}
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative h-1.5 bg-[rgba(249,115,22,0.1)] rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: phase === 'ready'
                  ? 'linear-gradient(90deg, #22C55E, #F97316)'
                  : 'linear-gradient(90deg, #FB923C, #F97316)',
                boxShadow: `0 0 12px ${phase === 'ready' ? 'rgba(34,197,94,0.5)' : 'rgba(249,115,22,0.5)'}`,
              }}
            />
          </div>

          {/* Percentage */}
          <div className="text-center mt-2.5">
            <span className="text-[11px] font-mono text-[var(--muted)]">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="flex items-center gap-2 opacity-50">
          <Mic className="w-3 h-3 text-[var(--accent)]" strokeWidth={2} />
          <div className="flex gap-0.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-0.5 bg-[var(--accent)] rounded-full animate-pulse"
                style={{
                  height: `${6 + Math.random() * 10}px`,
                  animationDelay: `${i * 80}ms`,
                  opacity: 0.4 + Math.random() * 0.6,
                }}
              />
            ))}
          </div>
          <Mic className="w-3 h-3 text-[var(--accent)]" strokeWidth={2} />
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
