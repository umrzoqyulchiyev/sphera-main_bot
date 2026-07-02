import { useState, useEffect } from 'react';
import { TrendingUp, MessageSquare, Mic, Radio, Star, Award, Calendar, Loader } from 'lucide-react';
import { getUserStats, type UserStats } from '../../lib/api';
import { getLang } from '../../lib/i18n';
import type { User } from '../../types';

interface StatsScreenProps {
  user: User | null;
}

const L: Record<string, Record<string, string>> = {
  ru: {
    level_title: 'Текущий Уровень', points_label: 'поинтов', next_level: 'для',
    lvl: 'ур.', role: 'Ваша Роль', psycho: 'Психотип', focus: 'Фокус внимания',
    tone: 'Эмоц. тон', topic: 'Ключевая тема', priority: 'Приоритет',
    msgs: 'Сообщений', voice: 'Голосовых', studio: 'В Студию', favs: 'Избранное',
    earned: 'Заработано', days: 'Дней активен', loading: 'Загрузка...',
    listener: '🎧 Слушатель', aktivniy: '⚡ Активный', doverenniy: '🎙 Доверенный', admin: '👑 Администратор',
  },
  en: {
    level_title: 'Current Level', points_label: 'points', next_level: 'for',
    lvl: 'lvl', role: 'Your Role', psycho: 'Psychotype', focus: 'Focus',
    tone: 'Emotional Tone', topic: 'Key Topic', priority: 'Priority',
    msgs: 'Messages', voice: 'Voice', studio: 'To Studio', favs: 'Favorites',
    earned: 'Earned', days: 'Days Active', loading: 'Loading...',
    listener: '🎧 Listener', aktivniy: '⚡ Active', doverenniy: '🎙 Trusted', admin: '👑 Administrator',
  },
  lt: {
    level_title: 'Dabartinis Lygis', points_label: 'taškai', next_level: 'iki',
    lvl: 'lyg.', role: 'Jūsų Vaidmuo', psycho: 'Psichotipas', focus: 'Dėmesio fokusas',
    tone: 'Emocinis tonas', topic: 'Pagrindinė tema', priority: 'Prioritetas',
    msgs: 'Žinučių', voice: 'Balso', studio: 'Į studiją', favs: 'Parankiniai',
    earned: 'Uždirbta', days: 'Dienų aktyvus', loading: 'Kraunama...',
    listener: '🎧 Klausytojas', aktivniy: '⚡ Aktyvus', doverenniy: '🎙 Patikimas', admin: '👑 Administratorius',
  },
};

export function StatsScreen({ user }: StatsScreenProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-8 h-8 text-[#38e1ff] animate-spin" />
      </div>
    );
  }

  const level = stats.level;
  const currentPoints = Number(stats.current_points);
  const nextLevelPoints = level * 100;
  const progress = Math.min(((currentPoints % 100) / 100) * 100, 100);

  const statCards = [
    { icon: MessageSquare, label: tx('msgs'), value: stats.total_messages, color: '#00d9ff' },
    { icon: Mic, label: tx('voice'), value: stats.voice_messages, color: '#a855f7' },
    { icon: Radio, label: tx('studio'), value: stats.studio_messages, color: '#ec4899' },
    { icon: Star, label: tx('favs'), value: stats.favorite_count, color: '#f59e0b' },
    { icon: TrendingUp, label: tx('earned'), value: stats.points_earned, color: '#22c55e', suffix: 'PT' },
    { icon: Calendar, label: tx('days'), value: stats.days_active, color: '#06b6d4' },
  ];

  const roleKey = user?.role || 'listener';
  const roleMap: Record<string, string> = {
    listener: 'listener', slusatel: 'listener', aktivniy: 'aktivniy',
    doverenniy: 'doverenniy', admin: 'admin', broadcaster: 'doverenniy',
  };
  const roleLabel = tx(roleMap[roleKey] || 'listener');

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Level Progress */}
      <div className="relative">
        <div className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-[rgba(0,217,255,0.2)] to-[rgba(0,136,255,0.1)] blur-2xl opacity-60" />
        <div className="relative glass p-6 rounded-[24px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] tracking-[2px] text-[#6b7c9e] uppercase mb-1">{tx('level_title')}</div>
              <div className="text-4xl font-extrabold text-white">
                <span className="text-[#00d9ff]">{level}</span>
              </div>
            </div>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00d9ff] to-[#0088ff] flex items-center justify-center shadow-[0_0_30px_rgba(0,217,255,0.5)]">
              <Award className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#8b9cbe]">{currentPoints.toFixed(1)} {tx('points_label')}</span>
              <span className="text-[#00d9ff] font-bold">{nextLevelPoints} {tx('next_level')} {level + 1} {tx('lvl')}</span>
            </div>
            <div className="h-3 rounded-full bg-[rgba(107,124,158,0.2)] overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-[#00d9ff] to-[#0088ff] rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%`, boxShadow: '0 0 20px rgba(0,217,255,0.6)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Psychotype (if available) */}
      {user?.psychotype && (
        <div className="glass p-5 rounded-[20px] space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[rgba(168,85,247,0.3)] to-[rgba(236,72,153,0.2)] flex items-center justify-center">
              <span className="text-lg">🧠</span>
            </div>
            <div className="text-sm font-bold text-[#00d9ff]">{tx('psycho')}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[rgba(10,20,40,0.4)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">{tx('focus')}</div>
              <div className="text-xs text-white font-medium">{user.psychotype.focus_of_attention}</div>
            </div>
            <div className="bg-[rgba(10,20,40,0.4)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">{tx('tone')}</div>
              <div className="text-xs text-white font-medium">{user.psychotype.emotional_tone}</div>
            </div>
            <div className="col-span-2 bg-[rgba(10,20,40,0.4)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">{tx('topic')}</div>
              <div className="text-xs text-white font-medium">{user.psychotype.key_topic}</div>
            </div>
            <div className="col-span-2 bg-gradient-to-r from-[rgba(0,217,255,0.15)] to-[rgba(168,85,247,0.15)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">{tx('priority')}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[rgba(0,0,0,0.3)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00d9ff] to-[#a855f7] rounded-full"
                    style={{ width: `${(user.psychotype.priority_score ?? 5) * 10}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-[#00d9ff]">{user.psychotype.priority_score ?? 5}/10</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass rounded-[20px] p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${card.color}18` }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-extrabold text-white">
                  {card.value}
                  {card.suffix && <span className="text-xs text-[#6b7c9e] ml-1">{card.suffix}</span>}
                </div>
                <div className="text-[10px] tracking-wide text-[#6b7c9e] uppercase">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Badge */}
      <div className="glass p-5 rounded-[20px] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[2px] text-[#6b7c9e] uppercase mb-1">{tx('role')}</div>
          <div className="text-lg font-bold text-white">{roleLabel}</div>
        </div>
        <div className="text-4xl opacity-30">
          {roleKey === 'admin' ? '👑' : roleKey === 'doverenniy' ? '🎙' : roleKey === 'aktivniy' ? '⚡' : '🎧'}
        </div>
      </div>
    </div>
  );
}
