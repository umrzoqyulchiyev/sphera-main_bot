import { useState, useCallback } from 'react';
import { t as translate, getLang, setLang as setI18nLang } from '../lib/i18n';
import type { Language } from '../types';

/**
 * Hook for translations.
 * Optional namespace parameter is accepted for compatibility but ignored —
 * all keys are merged into a flat structure per language.
 */
export function useTranslation(_ns?: string) {
  const [lang, setLangState] = useState<Language>(getLang());

  const setLang = useCallback((newLang: Language) => {
    setI18nLang(newLang);
    setLangState(newLang);
  }, []);

  const t = useCallback((key: string): string => {
    return translate(key);
  }, [lang]);

  return { t, lang, setLang };
}
