// User va Profile (v3 backend — eski maydonlar moslik uchun optional)
export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  display_name?: string | null;
  full_name?: string | null;
  role: 'listener' | 'broadcaster' | 'admin' | 'moderator' | 'slusatel' | 'aktivniy' | 'doverenniy';
  points: number;
  level?: number;
  level_name?: string;
  language: 'ru' | 'lt' | 'en';
  broadcast_lang?: 'ru' | 'lt' | 'en';
  city?: string;
  // TZ §4: Psixologik profil (backend /users/me dan keladi)
  focus_of_attention?: 'vnutrenniy' | 'vneshniy' | null;
  emotional_tone?: 'optimist' | 'melanxolik' | 'ratsional' | null;
  key_topic?: string | null;
  psychotype?: Psychotype;
}

export interface Psychotype {
  emotional_tone: 'optimist' | 'melanxolik' | 'ratsional';
  focus_of_attention: 'vnutrenniy' | 'vneshniy';
  key_topic: string;
  priority_score?: number;
}

// Point so'rovi (menga kelgan)
export interface PointsRequest {
  id: number;
  from_user_id: number;
  from_display_name: string | null;
  to_user_id: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  created_at: string;
}

// Point paketi
export interface PointPackage {
  id: number;
  points_amount: number;
  price_eur: number;
  label: string;
}

// Point tranzaksiyasi (tarix)
export interface PointsTransaction {
  id: number;
  amount: number;
  event_type: string;
  description: string;
  created_at: string;
}

// To'lov sozlamalari (admin belgilaydi — poinт uchun qanday to'lanadi)
export interface PaymentSettings {
  method: 'stars' | 'manual';
  instructions: string;
}

// Guruh (ведущий yaratadi)
export interface ChatRoom {
  id: number;
  title: string;
  description: string;
  host_user_id: number | null;
  host_display_name: string | null;
  is_active: boolean;
  created_at: string;
}

// Point paketi (admin CRUD)
export interface AdminPackage {
  id: number;
  points_amount: number;
  price_eur: number;
  label: string;
  is_active: boolean;
}

// Yangilik
export interface News {
  id: number;
  title: string;
  body: string;
  image_url: string;
  created_at: string;
}

// Chat Messages
export interface ChatMessage {
  id: number;
  telegram_id?: number;
  username: string | null;
  display_name?: string | null;
  message: string | null;
  message_type?: string;
  voice_url: string | null;
  file_url?: string | null;
  file_name?: string | null;
  duration_sec?: number | null;
  kind?: 'chat' | 'studio' | 'ai';
  created_at: string;
  // Faqat shu sessiyada optimistik yuborilgan xabarlarda bo'ladi (Telegram
  // uslubidagi bitta/ikkita galochka) — tarixdan yuklangan xabarlarda yo'q.
  status?: 'sending' | 'sent' | 'delivered';
}

// Radio Status
export interface RadioStatus {
  is_live: boolean;
  broadcaster_type: string | null;
  broadcaster_name: string | null;
  use_hls?: boolean;
  use_icecast?: boolean;
  stream_url?: string | null;
  listeners_count?: number;
}

// Announcement Banner (news bannerlari)
export interface Announcement {
  emoji: string;
  title: string;
  text: string;
  image_url: string | null;
}

export interface Announcements {
  banner1: Announcement | null;
  banner2: Announcement | null;
}

// AI Draft (Admin)
export interface Draft {
  id: number;
  city: string;
  main_topic: string | null;
  script: string;
  source_count: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

// Audio Segment
export interface AudioSegment {
  id: number;
  url: string;
  script: string;
  duration_sec: number;
}

// WebSocket Events
export type WSMessageType =
  | 'chat'
  | 'radio_status'
  | 'presence'
  | 'new_segment'
  | 'role_up'
  | 'studio_ack'
  | 'limit_exceeded'
  | 'studio_denied'
  | 'balance'
  | 'points_update'
  | 'role_updated'
  | 'casting_updated'
  | 'error'
  | 'pong'
  | 'ping';

export interface WSMessage {
  type: WSMessageType;
  data?: any;
}

// Navigation
export type Screen = 'anons' | 'efir' | 'profile' | 'stats' | 'music' | 'schedule' | 'casting';

export type { Language } from '../locales';
