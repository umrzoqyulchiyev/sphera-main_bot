import { getTelegram } from './config';

// Telegram WebApp initialization
export function initTelegramWebApp() {
  const tg = getTelegram();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();

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
    }

    // Telegram theme colors
    try {
      if (tg.setHeaderColor) tg.setHeaderColor('#060a14');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#060a14');
    } catch (e) {
      /* old versions */
    }

    applyViewportHeight();
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
