import { API_URL } from './config';
import { authHeaders } from './auth';
import type {
  User, RadioStatus, ChatMessage, Announcements, AudioSegment,
  News, PointsRequest, PointPackage,
} from '../types';

// ============ Users / Profile ============
export async function getMe(): Promise<User> {
  const resp = await fetch(`${API_URL}/users/me`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch user');
  return resp.json();
}

// Display name va username tahrirlash (v3: PUT /users/me)
export async function updateProfile(data: {
  display_name?: string;
  username?: string;
}) {
  const resp = await fetch(`${API_URL}/users/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error('Failed to update profile');
  return resp.json();
}

// Til tanlash (v3: /auth/select-language)
export async function updateLanguage(language: string) {
  const resp = await fetch(`${API_URL}/auth/select-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ language }),
  });
  if (!resp.ok) throw new Error('Failed to select language');
  return resp.json();
}

// Eski chaqiruv — moslik uchun (broadcast lang = interfeys tili)
export async function updateBroadcastLang(language: string) {
  return updateLanguage(language);
}

// ============ News (til bo'yicha) ============
export async function getNews(language: string): Promise<News[]> {
  const resp = await fetch(`${API_URL}/news/${language}`);
  if (!resp.ok) throw new Error('Failed to fetch news');
  return resp.json();
}

// Eski "announcements" — endi news'dan banner sifatida (dizayn saqlanadi)
export async function getAnnouncements(): Promise<Announcements> {
  const lang = localStorage.getItem('sfera5_lang') || 'ru';
  try {
    const news = await getNews(lang);
    const toBanner = (n?: News) =>
      n ? { emoji: '📻', title: n.title, text: n.body, image_url: n.image_url || null } : null;
    return { banner1: toBanner(news[0]), banner2: toBanner(news[1]) };
  } catch {
    return { banner1: null, banner2: null };
  }
}

// ============ Points ============
export async function getPointsBalance() {
  const resp = await fetch(`${API_URL}/users/me/points`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch balance');
  return resp.json();
}

// Point berish (ID bo'yicha)
export async function transferPoints(to_user_id: number, amount: number) {
  const resp = await fetch(`${API_URL}/users/me/points/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ to_user_id, amount }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Transfer failed');
  }
  return resp.json();
}

// Point so'rash (from_user_id = kimdan so'ralyapti)
export async function requestPoints(from_user_id: number, amount: number, message = '') {
  const resp = await fetch(`${API_URL}/users/me/points/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ from_user_id, amount, message }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  return resp.json();
}

export async function getMyRequests(): Promise<PointsRequest[]> {
  const resp = await fetch(`${API_URL}/users/me/points/requests`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch requests');
  return resp.json();
}

export async function decideRequest(request_id: number, approve: boolean) {
  const resp = await fetch(`${API_URL}/users/me/points/requests/${request_id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ approve }),
  });
  if (!resp.ok) throw new Error('Failed to decide request');
  return resp.json();
}

export async function getPackages(): Promise<PointPackage[]> {
  const resp = await fetch(`${API_URL}/users/me/points/packages`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch packages');
  return resp.json();
}

export async function purchasePackage(package_id: number) {
  const resp = await fetch(`${API_URL}/users/me/points/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ package_id }),
  });
  if (!resp.ok) throw new Error('Purchase failed');
  return resp.json();
}

// ============ Radio ============
export async function getRadioStatus(city?: string): Promise<RadioStatus> {
  try {
    const c = city || 'global';
    const resp = await fetch(`${API_URL}/radio/status?city=${c}`);
    if (resp.ok) return resp.json();
  } catch (_) {}
  // fallback — Icecast yoqilgan holat (backend ishlamasa ham pleyer urinib ko'radi)
  return {
    is_live: true,
    broadcaster_type: 'ai',
    broadcaster_name: 'AI Host',
    use_icecast: true,
    stream_url: null,
    listeners_count: 0,
  };
}

export async function getPlaylist(_city?: string): Promise<AudioSegment[]> {
  return [];
}

export function getStreamUrl(lang: string, _streamUrlFromStatus?: string | null): string {
  // Har doim same-origin proxy — CORS muammosi yo'q,
  // Telegram WebView ham bemalol ulanadi.
  return `${API_URL}/radio/live/${lang}`;
}

// ============ Chat ============
export async function getChatHistory(_city?: string): Promise<ChatMessage[]> {
  const resp = await fetch(`${API_URL}/chat/history?limit=50`);
  if (!resp.ok) throw new Error('Failed to fetch chat history');
  return resp.json();
}

export async function sendChatMessage(_city: string, message: string) {
  const resp = await fetch(`${API_URL}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ message }),
  });
  if (!resp.ok) {
    const error: any = new Error('Failed to send message');
    error.status = resp.status;
    error.response = resp;
    throw error;
  }
  return resp.json();
}

// Ovozli xabar (v3: POST /chat/voice — 0.005 point)
export async function sendVoiceMessage(
  _city: string,
  audioBlob: Blob,
  _destination: 'chat' | 'studio',
  _lang: string
) {
  // Blob MIME turiga qarab to'g'ri kengaytma tanlash (backend shu bo'yicha saqlaydi)
  const typeExtMap: Record<string, string> = {
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
  };
  const baseType = (audioBlob.type || 'audio/webm').split(';')[0];
  const ext = typeExtMap[baseType] || 'webm';

  const fd = new FormData();
  fd.append('audio_file', audioBlob, `voice.${ext}`);

  const resp = await fetch(`${API_URL}/chat/voice`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });

  if (!resp.ok) {
    const error: any = new Error('Failed to send voice');
    error.status = resp.status;
    error.response = resp;
    throw error;
  }
  const data = await resp.json();
  // detail.points ni yuqori darajaga chiqaramiz (moslik uchun)
  return { ...data, points: data?.detail?.points };
}

export async function sendTextMessage(_city: string, text: string, _lang: string) {
  return sendChatMessage(_city, text);
}

export async function uploadFile(_city: string, _file: File) {
  // v3 backend'da fayl endpointi yo'q — hozircha qo'llab-quvvatlanmaydi
  throw Object.assign(new Error('File upload not supported'), { status: 400 });
}

// ============ Opinions / Topics (yangi konsepsiya) ============
export interface CurrentTopic {
  id: number;
  title: string;
  description: string;
  opinion_count: number;
}

export async function getCurrentTopic(): Promise<CurrentTopic | null> {
  const resp = await fetch(`${API_URL}/opinions/current-topic`, { headers: authHeaders() });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.topic || null;
}

export async function sendOpinionText(text: string) {
  const resp = await fetch(`${API_URL}/opinions/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ kind: 'text', text, tg_message_id: 0 }),
  });
  if (!resp.ok) {
    const err: any = new Error('Failed to send opinion');
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

export async function sendOpinionVoice(audioBlob: Blob) {
  // Ovoz mini-app orqali — backendga yuklaymiz (Telegram emas, lekin file saqlanmaydi-zarur emas MVP)
  const fd = new FormData();
  fd.append('audio_file', audioBlob, 'opinion.webm');
  const resp = await fetch(`${API_URL}/opinions/voice`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  if (!resp.ok) {
    const err: any = new Error('Failed to send voice opinion');
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

// Admin: topics
export async function adminCreateTopic(title: string, description = '') {
  const resp = await fetch(`${API_URL}/admin/topics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title, description }),
  });
  if (!resp.ok) throw new Error('Failed to create topic');
  return resp.json();
}

export async function adminGetTopics() {
  const resp = await fetch(`${API_URL}/admin/topics`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch topics');
  return resp.json();
}

export async function adminCloseTopic(topicId: number) {
  const resp = await fetch(`${API_URL}/admin/topics/${topicId}/close`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!resp.ok) throw new Error('Failed to close topic');
  return resp.json();
}

// ============ Announcements (admin — v3'da yo'q, stub) ============
export async function updateAnnouncement(_slot: number, _data: any) {
  return { ok: true };
}

// ============ Admin (v3) ============
export async function getUsers() {
  const resp = await fetch(`${API_URL}/admin/users`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch users');
  return resp.json();
}

export async function adminSetLevel(user_id: number, level: number) {
  const resp = await fetch(`${API_URL}/admin/users/set-level`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ user_id, level }),
  });
  if (!resp.ok) throw new Error('Failed to set level');
  return resp.json();
}

export async function adminAddPoints(user_id: number, amount: number) {
  const resp = await fetch(`${API_URL}/admin/users/add-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ user_id, amount }),
  });
  if (!resp.ok) throw new Error('Failed to add points');
  return resp.json();
}

// Eski drafts API — v3'da yo'q (stub, Admin sahifa buzilmasligi uchun)
export async function getDrafts(_status = 'pending'): Promise<any[]> {
  return [];
}
export async function editDraft(_id: number, _script: string) { return { ok: true }; }
export async function approveDraft(_id: number) { return { ok: true }; }
export async function rejectDraft(_id: number) { return { ok: true }; }

// ============ Stats ============
export interface UserStats {
  total_messages: number;
  chat_messages: number;
  voice_messages: number;
  studio_messages: number;
  file_uploads: number;
  points_earned: number;
  points_spent: number;
  current_points: number;
  days_active: number;
  broadcasts_count: number;
  favorite_count: number;
  level: number;
}

export async function getUserStats(): Promise<UserStats> {
  const resp = await fetch(`${API_URL}/users/stats`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch stats');
  return resp.json();
}

// ============ Favorites ============
export interface FavoriteItem {
  id: number;
  item_type: string;
  item_id: number;
  title: string;
  content: string | null;
  broadcaster: string | null;
  duration: number | null;
  audio_url: string | null;
  created_at: string;
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  const resp = await fetch(`${API_URL}/users/favorites`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch favorites');
  return resp.json();
}

export async function addFavorite(data: {
  item_type: string; item_id: number; title: string;
  content?: string; broadcaster?: string; duration?: number; audio_url?: string;
}): Promise<FavoriteItem> {
  const resp = await fetch(`${API_URL}/users/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error('Failed to add favorite');
  return resp.json();
}

export async function removeFavorite(favoriteId: number) {
  const resp = await fetch(`${API_URL}/users/favorites/${favoriteId}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!resp.ok) throw new Error('Failed to remove favorite');
  return resp.json();
}

// ============ Voice Chat Status ============
export interface VoiceChatStatus {
  configured: boolean;
  in_call: boolean;
}

export async function getVoiceChatStatus(): Promise<VoiceChatStatus> {
  try {
    const resp = await fetch(`${API_URL}/voice/status`, { headers: authHeaders() });
    if (resp.ok) return resp.json();
  } catch {}
  return { configured: false, in_call: false };
}
