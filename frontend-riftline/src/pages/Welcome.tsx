import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Podcast, Radio as RadioIcon, ArrowRight } from 'lucide-react';
import { updateLanguage, getNews } from '../lib/api';
import { setLang } from '../lib/i18n';
import { LS_LANG } from '../lib/config';
import type { Language, News } from '../types';
import { GlitchText } from '../components/ui/GlitchText';

// Tillar + davlat (TZ: tartib EN → LT → RU)
const LANGS: { code: Language; flag: string; label: string; country: string }[] = [
  { code: 'en', flag: '🇬🇧', label: 'English', country: 'United Kingdom' },
  { code: 'lt', flag: '🇱🇹', label: 'Lietuvių', country: 'Lietuva' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский', country: 'Россия' },
];

const WELCOME_TXT: Record<Language, { choose: string; welcome: string; enter: string; loading: string; podcast: string }> = {
  ru: { choose: 'Выберите язык', welcome: 'Добро пожаловать', enter: 'Войти в платформу', loading: 'Загрузка…', podcast: 'ПОДКАСТ · НОВОСТИ' },
  en: { choose: 'Choose language', welcome: 'Welcome', enter: 'Enter platform', loading: 'Loading…', podcast: 'PODCAST · NEWS' },
  lt: { choose: 'Pasirinkite kalbą', welcome: 'Sveiki atvykę', enter: 'Įeiti į platformą', loading: 'Įkeliama…', podcast: 'PODKASTAS · NAUJIENOS' },
};

export function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'lang' | 'news'>('lang');
  const [chosen, setChosen] = useState<Language>('en');
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(false);

  function enterPlatform() {
    localStorage.setItem('sfera5_entered', '1');
    navigate('/radio');
  }

  async function choose(lang: Language) {
    setChosen(lang);
    setLang(lang);
    localStorage.setItem(LS_LANG, lang);
    setLoading(true);
    setStep('news');
    try {
      await updateLanguage(lang);
    } catch (e) {
      console.error('select-language:', e);
    }
    try {
      const n = await getNews(lang);
      setNews(n);
    } catch (e) {
      console.error('news:', e);
    } finally {
      setLoading(false);
    }
  }

  const txt = WELCOME_TXT[chosen];
  const main = news[0];

  return (
    <div className="rift-zone-u5 h-[var(--app-vh)] bg-[var(--bg2)] text-[#c4c4c4] flex flex-col relative overflow-hidden">
      {/* Warm grid + ambient glow */}
      <div className="absolute inset-0 bg-cyber-grid z-0 pointer-events-none opacity-50" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[60vh] bg-[var(--accent)]/5 blur-[120px] rounded-full z-0 pointer-events-none" />

      {/* ====== STEP 1: TIL TANLASH ====== */}
      {step === 'lang' && (
        <main className="relative z-10 w-full max-w-[390px] mx-auto flex-1 flex flex-col items-center justify-between px-5 py-8">
          {/* Logo */}
          <div className="w-full flex justify-center mt-6">
            <GlitchText tag="h1" text="INTRA GROUP" className="text-[28px] font-extrabold tracking-[2px] uppercase logo-gradient drop-shadow-[0_0_15px_rgba(0,240,192,0.25)]" />
          </div>

          {/* Centerpiece animated orb */}
          <div className="flex-1 flex items-center justify-center relative w-full">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--accent)]/5 to-transparent rounded-full blur-[40px] pointer-events-none" />
            <div className="w-32 h-32 rounded-full relative flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 40% 35%, rgba(0,240,192,0.35), rgba(251,146,60,0.12), transparent 70%)',
              }}>
              <div className="orb-nav" style={{ width: 72, height: 72 }} />
            </div>
          </div>

          {/* Language buttons */}
          <div className="w-full flex flex-col gap-4 pb-2">
            <p className="text-center text-[13px] text-[#9a9a9a] mb-1">
              {WELCOME_TXT.en.choose}
            </p>
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => choose(l.code)}
                className="group relative w-full flex items-center justify-between p-5 rounded-2xl transition-all duration-300 active:scale-[0.98] overflow-hidden"
                style={{
                  background: 'rgba(13,13,16,0.65)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0,240,192,0.2)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                <div className="flex items-center gap-5 relative z-10">
                  <span className="text-[30px] leading-none">{l.flag}</span>
                  <div className="flex flex-col items-start">
                    <span className="text-[17px] font-semibold text-white tracking-wide">{l.label}</span>
                    <span className="text-[11px] text-[#9a9a9a] font-mono">{l.country}</span>
                  </div>
                </div>
                <span className="text-[#9a9a9a] group-active:text-[var(--accent)] transition-colors relative z-10">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* ====== STEP 2: YANGILIK (PODKAST) ====== */}
      {step === 'news' && (
        <>
          <div className="relative z-10 flex-1 px-5 pt-10 pb-4 overflow-y-auto flex flex-col gap-5 max-w-[440px] w-full mx-auto">
            <div className="text-center">
              <div className="text-2xl font-extrabold tracking-[1.5px] uppercase logo-gradient font-display">
                INTRA GROUP
              </div>
              <h2 className="text-xl font-bold text-[var(--accent-light)] mt-4 neon-glow-text font-display">{txt.welcome} 👋</h2>
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-3 mt-10">
                <div className="w-9 h-9 rounded-full border-[3px] border-[rgba(0,240,192,0.2)] border-t-[var(--accent)] animate-spin" />
                <span className="text-sm text-[var(--muted)]">{txt.loading}</span>
              </div>
            ) : (
              <>
                {main && (
                  <div className="stitch-card-bordered overflow-hidden">
                    <div
                      className="h-44 flex items-center justify-center"
                      style={{
                        background: main.image_url
                          ? `url('${main.image_url}') center/cover`
                          : 'linear-gradient(135deg, rgba(0,240,192,0.25), rgba(49,46,129,0.35))',
                      }}
                    >
                      {!main.image_url && (
                        <Podcast size={48} className="text-[var(--accent)]" />
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <RadioIcon size={16} className="text-[var(--accent)]" />
                        <span className="text-[10px] tracking-[2px] text-[var(--accent)] font-bold font-mono">{txt.podcast}</span>
                      </div>
                      <h3 className="text-lg font-bold mb-2 text-[#c4c4c4]">{main.title}</h3>
                      <p className="text-sm text-[#9a9a9a] leading-relaxed">{main.body}</p>
                    </div>
                  </div>
                )}

                {news.slice(1).map((n) => (
                  <div key={n.id} className="stitch-card p-4">
                    <h4 className="text-sm font-semibold text-[#c4c4c4] mb-1">{n.title}</h4>
                    <p className="text-xs text-[#9a9a9a] leading-relaxed">{n.body}</p>
                  </div>
                ))}
              </>
            )}
          </div>

          <div
            className="relative z-10 max-w-[440px] w-full mx-auto px-5 pt-2"
            style={{ paddingBottom: 'calc(40px + max(env(safe-area-inset-bottom), var(--tg-safe-bottom, 0px)))' }}
          >
            <button
              onClick={enterPlatform}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 btn-primary-glow font-display"
            >
              {txt.enter}
              <ArrowRight size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
