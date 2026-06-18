// Splash
import splashRu from './ru/splash.json';
import splashLt from './lt/splash.json';
import splashEn from './en/splash.json';

// Radio (main app)
import radioRu from './ru/radio.json';
import radioLt from './lt/radio.json';
import radioEn from './en/radio.json';

// Admin
import adminRu from './ru/admin.json';
import adminLt from './lt/admin.json';
import adminEn from './en/admin.json';

export const locales = {
  ru: { splash: splashRu, radio: radioRu, admin: adminRu },
  lt: { splash: splashLt, radio: radioLt, admin: adminLt },
  en: { splash: splashEn, radio: radioEn, admin: adminEn },
} as const;

export type Language = keyof typeof locales;
export type Namespace = keyof typeof locales.ru;
