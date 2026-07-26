import { getTelegram } from './config';

// Telegram WebApp initialization
export function initTelegramWebApp() {
  const tg = getTelegram();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();

    // To'liq ekran (Bot API 8.0+) — expand() o'zi Telegram xromini yashirmaydi,
    // ayniqsa iOS'da. requestFullscreen shart.
    if (typeof tg.requestFullscreen === 'function') {
      try { tg.requestFullscreen(); } catch (e) { /* eski versiya */ }
    }

    // Android: prevent accidental closing
    if (typeof tg.disableVerticalSwipes === 'function') {
      tg.disableVerticalSwipes();
    }
    if (typeof tg.enableClosingConfirmation === 'function') {
      tg.enableClosingConfirmation();
    }

    // Viewport changes (keyboard, focus)
    if (typeof tg.onEvent === 'function') {
      tg.onEvent('viewportChanged', applyViewportHeight);
      // Android jismoniy "Kнопки" navigatsiyasi (yoki gesture pill) —
      // fullscreen rejimda kontent ular ostiga tushib qolishi mumkin.
      // Telegram bu maydonni o'zi biladi (WebView emas, native ilova
      // darajasida), shuning uchun CSS env(safe-area-inset-*)ga emas,
      // shu API'ga tayanamiz — u ancha ishonchli.
      tg.onEvent('safeAreaChanged', applySafeAreaInsets);
      tg.onEvent('contentSafeAreaChanged', applySafeAreaInsets);
    }

    // Telegram theme colors
    try {
      if (tg.setHeaderColor) tg.setHeaderColor('#0F0F23');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0F0F23');
    } catch (e) {
      /* old versions */
    }

    applyViewportHeight();
    applySafeAreaInsets();
  } catch (e) {
    console.error('TG init error:', e);
  }
}

// Real viewport height for Android
export function applyViewportHeight() {
  const tg = getTelegram();
  let h = window.innerHeight;
  
  if (tg && tg.viewportStableHeight) {
    h = tg.viewportStableHeight;
  } else if (tg && tg.viewportHeight) {
    h = tg.viewportHeight;
  }
  
  document.documentElement.style.setProperty('--app-vh', h + 'px');
}

// Qurilmaning haqiqiy xavfsiz maydoni (Android jismoniy "Kнопки" paneli,
// gesture pill, notch va h.k.) — Telegram native ilova darajasida biladi.
// CSS env(safe-area-inset-*) Android'da 3-tugmali navigatsiya balandligini
// har doim ham to'g'ri bermaydi (WebView buni "system bar" deb hisoblab,
// kontentni undan tashqarida chizadi — ayniqsa fullscreen'da esa aksincha
// bo'lib, tugmalar kontent ustiga tushib qolishi mumkin). Shu sabab
// pastki navigatsiya balandligini shu qiymat bilan CSS max() orqali
// solishtiramiz (qaysi biri kattaroq — o'shani ishlatamiz).
export function applySafeAreaInsets() {
  const tg = getTelegram();
  const root = document.documentElement.style;
  const safe = (tg && tg.safeAreaInset) || { top: 0, bottom: 0, left: 0, right: 0 };
  const content = (tg && tg.contentSafeAreaInset) || { top: 0, bottom: 0, left: 0, right: 0 };

  root.setProperty('--tg-safe-top', `${Math.max(safe.top || 0, content.top || 0)}px`);
  root.setProperty('--tg-safe-bottom', `${Math.max(safe.bottom || 0, content.bottom || 0)}px`);
  root.setProperty('--tg-safe-left', `${Math.max(safe.left || 0, content.left || 0)}px`);
  root.setProperty('--tg-safe-right', `${Math.max(safe.right || 0, content.right || 0)}px`);
}

// Get Telegram user
export function getTgUser() {
  const tg = getTelegram();
  
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    return tg.initDataUnsafe.user;
  }
  
  // Browser test fallback
  return { id: 999999, username: 'test_user', first_name: 'Test' };
}

// Setup viewport listeners
if (typeof window !== 'undefined') {
  window.addEventListener('resize', applyViewportHeight);
  window.addEventListener('orientationchange', () =>
    setTimeout(applyViewportHeight, 200)
  );
}
