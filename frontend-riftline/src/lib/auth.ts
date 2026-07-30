import { API_URL, LS_TOKEN, LS_LANG } from './config';
import { getTgUser } from './telegram';

// Backend bilan autentifikatsiya (real Telegram ID orqali)
export async function authenticate() {
  const user = getTgUser();
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');

  const resp = await fetch(`${API_URL}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegram_id: user.id,
      username: user.username || null,
      full_name: fullName || null,
    }),
  });

  if (!resp.ok) throw new Error('Auth failed');

  const data = await resp.json();
  localStorage.setItem(LS_TOKEN, data.token);
  // Tanlangan til bo'lsa saqlaymiz (interfeys uchun)
  if (data.language) localStorage.setItem(LS_LANG, data.language);

  return data;
}

export function getToken(): string | null {
  return localStorage.getItem(LS_TOKEN);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
