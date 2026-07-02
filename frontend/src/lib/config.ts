// API konfiguratsiyasi
const getApiUrl = () => {
  // 1. Env dan olish (faqat agar aniq berilgan bo'lsa)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. Same-origin — backend frontend'ni o'zi serve qiladi (tunnel domeni avtomatik to'g'ri)
  return '';
};

export const API_URL = getApiUrl();

// WebSocket: VITE_WS_URL bo'lsa o'sha, aks holda SAME-ORIGIN (tunnel domeni bilan bir xil)
export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

export const RADIO_URL = import.meta.env.VITE_RADIO_URL || API_URL;

// LocalStorage keys
export const LS_TOKEN = 'sfera5_token';
export const LS_CITY = 'sfera5_city';
export const LS_ROLE = 'sfera5_role';
export const LS_LANG = 'sfera5_lang';

// Default city
export const DEFAULT_CITY = import.meta.env.VITE_DEFAULT_CITY || 'global';

// Telegram WebApp
export const getTelegram = () => {
  return (window as any).Telegram?.WebApp || null;
};
