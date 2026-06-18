import { Globe } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { Language } from '../../types';

interface LanguageSelectorProps {
  selectedLang: Language;
  onLangChange: (lang: Language) => void;
}

const languages: { code: Language; label: string }[] = [
  { code: 'ru', label: 'RU' },
  { code: 'lt', label: 'LT' },
  { code: 'en', label: 'EN' },
];

export function LanguageSelector({ selectedLang, onLangChange }: LanguageSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="glass p-4 rounded-2xl">
      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-3.5 h-3.5 text-[#6b7c9e]" strokeWidth={2} />
        <span className="text-[10px] font-medium text-[#6b7c9e] uppercase tracking-wide">
          {t('anons_lang_hint')}
        </span>
      </div>

      {/* Language buttons */}
      <div className="flex gap-2">
        {languages.map((lang) => {
          const isActive = selectedLang === lang.code;

          return (
            <button
              key={lang.code}
              onClick={() => onLangChange(lang.code)}
              className={`
                relative flex-1 h-11 rounded-xl font-bold text-xs
                flex items-center justify-center gap-2
                transition-all duration-300 ease-out
                overflow-hidden
                ${
                  isActive
                    ? 'text-[#060a14] scale-[1.03]'
                    : 'bg-[rgba(255,255,255,0.03)] text-[#8b9bb3] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#dbe9ff] hover:scale-[1.01]'
                }
              `}
              style={
                isActive
                  ? {
                      background: 'linear-gradient(135deg, #2ea8ff, #38e1ff)',
                      boxShadow: '0 0 20px rgba(56,225,255,0.35), 0 4px 12px rgba(46,168,255,0.2)',
                    }
                  : {}
              }
            >
              {/* Animated glow background for active */}
              {isActive && (
                <span
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4), transparent 70%)',
                    animation: 'langPulse 2s ease-in-out infinite',
                  }}
                />
              )}

              {/* Label */}
              <span className="relative z-10 transition-transform duration-300">
                {lang.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes langPulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
