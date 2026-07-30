import { LS_LANG } from './config';
import type { Language } from '../types';

// Import all locale JSON files
import ruCommon from '../locales/ru/common.json';
import ruAnons from '../locales/ru/anons.json';
import ruEfir from '../locales/ru/efir.json';
import ruProfile from '../locales/ru/profile.json';
import ruOnboarding from '../locales/ru/onboarding.json';
import ruAdmin from '../locales/ru/admin.json';
import ruSplash from '../locales/ru/splash.json';
import ruRadio from '../locales/ru/radio.json';

import ltCommon from '../locales/lt/common.json';
import ltAnons from '../locales/lt/anons.json';
import ltEfir from '../locales/lt/efir.json';
import ltProfile from '../locales/lt/profile.json';
import ltOnboarding from '../locales/lt/onboarding.json';
import ltAdmin from '../locales/lt/admin.json';
import ltSplash from '../locales/lt/splash.json';
import ltRadio from '../locales/lt/radio.json';

import enCommon from '../locales/en/common.json';
import enAnons from '../locales/en/anons.json';
import enEfir from '../locales/en/efir.json';
import enProfile from '../locales/en/profile.json';
import enOnboarding from '../locales/en/onboarding.json';
import enAdmin from '../locales/en/admin.json';
import enSplash from '../locales/en/splash.json';
import enRadio from '../locales/en/radio.json';

// Merge all sections per language
export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  ru: { ...ruCommon, ...ruAnons, ...ruEfir, ...ruProfile, ...ruOnboarding, ...ruAdmin, ...ruSplash, ...ruRadio },
  lt: { ...ltCommon, ...ltAnons, ...ltEfir, ...ltProfile, ...ltOnboarding, ...ltAdmin, ...ltSplash, ...ltRadio },
  en: { ...enCommon, ...enAnons, ...enEfir, ...enProfile, ...enOnboarding, ...enAdmin, ...enSplash, ...enRadio },
};

export function getLang(): Language {
  return (localStorage.getItem(LS_LANG) as Language) || 'ru';
}

export function setLang(lang: Language) {
  if (TRANSLATIONS[lang]) {
    localStorage.setItem(LS_LANG, lang);
  }
}

export function t(key: string): string {
  const lang = getLang();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.ru[key] || key;
}

// Display names for UI
export const ROLE_NAMES: Record<string, string> = {
  slusatel: 'Слушатель',
  aktivniy: 'Активный',
  doverenniy: 'Доверенный',
  admin: 'Администратор',
};

export const TONE_NAMES: Record<string, string> = {
  optimist: 'Оптимист 😊',
  melanxolik: 'Меланхолик 😔',
  ratsional: 'Рациональный 🧩',
};

export const FOCUS_NAMES: Record<string, string> = {
  vnutrenniy: 'Внутренний',
  vneshniy: 'Внешний',
};

export const LANG_NAMES: Record<string, string> = {
  ru: 'Русский',
  lt: 'Lietuvių',
  en: 'English',
};
