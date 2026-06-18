import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, ArrowRight, Radio as RadioIcon } from 'lucide-react';
import { updateLanguage, getNews } from '../lib/api';
import { setLang } from '../lib/i18n';
import { LS_LANG } from '../lib/config';
import type { Language, News } from '../types';

// Tillar + davlat (TZ: 3 til, 3 davlat)
const LANGS: { code: Language; flag: string; label: string; country: string }[] = [
  { code: 'ru', flag: '🇷🇺', label: 'Русский', country: 'Россия' },
  { code: 'en', flag: '🇬🇧', label: 'English', country: 'United Kingdom' },
  { code: 'lt', flag: '🇱🇹', label: 'Lietuvių', country: 'Lietuva' },
];

const WELCOME_TXT: Record<Language, { choose: string; welcome: string; enter: string; loading: string; podcast: string }> = {
  ru: { choose: 'Выберите язык', welcome: 'Добро пожаловать', enter: 'Войти в платформу', loading: 'Загрузка…', podcast: 'ПОДКАСТ · НОВОСТИ' },
  en: { choose: 'Choose language', welcome: 'Welcome', enter: 'Enter platform', loading: 'Loading…', podcast: 'PODCAST · NEWS' },
  lt: { choose: 'Pasirinkite kalbą', welcome: 'Sveiki atvykę', enter: 'Įeiti į platformą', loading: 'Įkeliama…', podcast: 'PODKASTAS · NAUJIENOS' },
};

export function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'lang' | 'news'>('lang');
  const [chosen, setChosen] = useState<Language>('ru');
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-[var(--app-vh)] bg-[#060a14] text-[#dbe9ff] flex flex-col relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-[radial-gradient(circle,rgba(56,225,255,0.08)_0%,transparent_70%)]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.06)_0%,transparent_70%)]" />
      </div>

      {/* ====== STEP 1: TIL TANLASH ====== */}
      {step === 'lang' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 gap-10">
          <div className="text-center">
            <h1 className="text-[44px] font-black tracking-[3px] leading-none">
              IN<span className="text-[#38e1ff]">TRA</span>
              <span className="text-[#7c5cff]"> GROUP</span>
            </h1>
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-[rgba(56,225,255,0.4)]" />
              <p className="text-[10px] tracking-[4px] text-[#6b7c9e] uppercase">Radio Platform</p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-[rgba(56,225,255,0.4)]" />
            </div>
          </div>

          <div className="w-full max-w-[340px] flex flex-col gap-3">
            <p className="text-center text-sm text-[#8b9bb3] mb-1">{WELCOME_TXT.ru.choose} · {WELCOME_TXT.en.choose}</p>
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => choose(l.code)}
                className="glass w-full flex items-center gap-4 px-5 py-4 rounded-2xl hover:border-[rgba(56,225,255,0.4)] transition-all active:scale-[0.98]"
              >
                <span className="text-2xl">{l.flag}</span>
                <div className="flex flex-col items-start">
                  <span className="text-base font-semibold text-[#dbe9ff]">{l.label}</span>
                  <span className="text-[10px] text-[#6b7c9e]">{l.country}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[#38e1ff] ml-auto" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ====== STEP 2: YANGILIK (PODKAST) ====== */}
      {step === 'news' && (
        <>
          <div className="relative z-10 flex-1 px-5 pt-10 pb-4 overflow-y-auto flex flex-col gap-5 max-w-[460px] w-full mx-auto">
            <div className="text-center">
              <div className="text-2xl font-black tracking-[2px]">
                IN<span className="text-[#38e1ff]">TRA</span><span className="text-[#7c5cff]"> GROUP</span>
              </div>
              <h2 className="text-xl font-extrabold text-[#38e1ff] mt-4 text-glow">{txt.welcome} 👋</h2>
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-3 mt-10">
                <div className="w-9 h-9 rounded-full border-[3px] border-[rgba(46,168,255,0.2)] border-t-[#38e1ff] animate-spin" />
                <span className="text-sm text-[#6b7c9e]">{txt.loading}</span>
              </div>
            ) : (
              <>
                {main && (
                  <div className="glass rounded-3xl overflow-hidden">
                    <div
                      className="h-44 flex items-center justify-center"
                      style={{
                        background: main.image_url
                          ? `url('${main.image_url}') center/cover`
                          : 'linear-gradient(135deg, rgba(46,168,255,0.25), rgba(124,92,255,0.25))',
                      }}
                    >
                      {!main.image_url && <Headphones className="w-12 h-12 text-[#38e1ff]" strokeWidth={1.5} />}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <RadioIcon className="w-3.5 h-3.5 text-[#7c5cff]" />
                        <span className="text-[10px] tracking-[2px] text-[#7c5cff] font-bold">{txt.podcast}</span>
                      </div>
                      <h3 className="text-lg font-bold mb-2 text-[#dbe9ff]">{main.title}</h3>
                      <p className="text-sm text-[#8b9bb3] leading-relaxed">{main.body}</p>
                    </div>
                  </div>
                )}

                {news.slice(1).map((n) => (
                  <div key={n.id} className="glass rounded-2xl p-4">
                    <h4 className="text-sm font-semibold text-[#dbe9ff] mb-1">{n.title}</h4>
                    <p className="text-xs text-[#6b7c9e] leading-relaxed">{n.body}</p>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="relative z-10 max-w-[460px] w-full mx-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
            <button
              onClick={() => navigate('/radio')}
              className="w-full py-4 rounded-2xl font-bold text-[#02101f] text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, #2ea8ff, #38e1ff)', boxShadow: '0 0 24px rgba(46,168,255,0.45)' }}
            >
              {txt.enter} <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
