import { useState, useEffect } from 'react';
import { TrendingUp, MessageSquare, Mic, Radio, Star, Award, Calendar, Loader } from 'lucide-react';
import { getUserStats, type UserStats } from '../../lib/api';
import { getLang } from '../../lib/i18n';
import type { User } from '../../types';
import { GlitchText } from '../ui/GlitchText';

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
    listener: '🎧 Слушатель', aktivniy: '⚡ Активный', doverenniy: '🎙 Доверенный', admin: '👑 Администратор', moderator: '🛡 Модератор',
  },
  en: {
    level_title: 'Current Level', points_label: 'points', next_level: 'for',
    lvl: 'lvl', role: 'Your Role', psycho: 'Psychotype', focus: 'Focus',
    tone: 'Emotional Tone', topic: 'Key Topic', priority: 'Priority',
    msgs: 'Messages', voice: 'Voice', studio: 'To Studio', favs: 'Favorites',
    earned: 'Earned', days: 'Days Active', loading: 'Loading...',
    listener: '🎧 Listener', aktivniy: '⚡ Active', doverenniy: '🎙 Trusted', admin: '👑 Administrator', moderator: '🛡 Moderator',
  },
  lt: {
    level_title: 'Dabartinis Lygis', points_label: 'taškai', next_level: 'iki',
    lvl: 'lyg.', role: 'Jūsų Vaidmuo', psycho: 'Psichotipas', focus: 'Dėmesio fokusas',
    tone: 'Emocinis tonas', topic: 'Pagrindinė tema', priority: 'Prioritetas',
    msgs: 'Žinučių', voice: 'Balso', studio: 'Į studiją', favs: 'Parankiniai',
    earned: 'Uždirbta', days: 'Dienų aktyvus', loading: 'Kraunama...',
    listener: '🎧 Klausytojas', aktivniy: '⚡ Aktyvus', doverenniy: '🎙 Patikimas', admin: '👑 Administratorius', moderator: '🛡 Moderatorius',
  },
};

export function StatsScreen({ user }: StatsScreenProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getUserStats()
      .then(setStats)
      .catch((e) => { console.error('[StatsScreen] Failed to load stats:', e); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rift-zone-u1 flex items-center justify-center py-16">
        <Loader className="w-8 h-8 text-[#E0263A] animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rift-zone-u1 glass p-8 text-center text-[#6b5f4f] text-sm rounded-[20px]">
        {lang === 'ru' ? 'Не удалось загрузить статистику' : lang === 'lt' ? 'Nepavyko įkelti statistikos' : 'Failed to load stats'}
      </div>
    );
  }

  const level = stats.level;
  const currentPoints = Number(stats.current_points);
  const nextLevelPoints = level * 100;
  const progress = Math.min(((currentPoints % 100) / 100) * 100, 100);

  const statCards = [
    { icon: MessageSquare, label: tx('msgs'), value: stats.total_messages, color: '#E0263A' },
    { icon: Mic, label: tx('voice'), value: stats.voice_messages, color: '#1C3FD6' },
    { icon: Radio, label: tx('studio'), value: stats.studio_messages, color: '#EC4899' },
    { icon: Star, label: tx('favs'), value: stats.favorite_count, color: '#1C3FD6' },
    { icon: TrendingUp, label: tx('earned'), value: stats.points_earned, color: '#1C3FD6', suffix: 'PT' },
    { icon: Calendar, label: tx('days'), value: stats.days_active, color: '#06B6D4' },
  ];

  const roleKey = user?.role || 'listener';
  const roleMap: Record<string, string> = {
    listener: 'listener', slusatel: 'listener', aktivniy: 'aktivniy',
    doverenniy: 'doverenniy', admin: 'admin', broadcaster: 'doverenniy', moderator: 'moderator',
  };
  const roleLabel = tx(roleMap[roleKey] || 'listener');

  return (
    <div className="rift-zone-u1 flex flex-col gap-4 pb-4">
      {/* Level Progress */}
      <div className="relative">
        <div className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-[rgba(224,38,58,0.1)] to-[rgba(224,38,58,0.04)] blur-2xl opacity-60" />
        <div className="relative glass rift-halftone rift-torn-b p-6 rounded-[24px]" style={{ transform: 'rotate(1deg)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <GlitchText tag="div" text={tx('level_title')} className="text-[10px] tracking-[2px] text-[#6b5f4f] uppercase mb-1" />
              <div className="text-4xl font-extrabold text-[#1A1310]">
                <span className="text-[#E0263A]">{level}</span>
              </div>
            </div>
            <div
              className="rift-patch w-20 h-20 shadow-[0_2px_14px_rgba(224,38,58,0.3)]"
              style={{
                background: 'linear-gradient(135deg, #ff4f63, #E0263A)',
                ['--patch-rot' as any]: level >= 3 ? '-9deg' : '-4deg',
                ['--patch-scale' as any]: level >= 3 ? 1.15 : 1,
              }}
            >
              <Award className={level >= 3 ? 'w-12 h-12 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]' : 'w-10 h-10 text-white'} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#6b5f4f]">{currentPoints.toFixed(1)} {tx('points_label')}</span>
              <span className="text-[#E0263A] font-bold">{nextLevelPoints} {tx('next_level')} {level + 1} {tx('lvl')}</span>
            </div>
            <div className="h-3 rounded-full bg-[rgba(26,19,16,0.2)] overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-[#ff4f63] to-[#E0263A] rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%`, boxShadow: '0 0 8px rgba(224,38,58,0.35)' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rift-diagonal" />

      {/* Psychotype (if available) */}
      {user?.psychotype && (
        <div className="glass p-5 rounded-[20px] space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[rgba(168,85,247,0.3)] to-[rgba(236,72,153,0.2)] flex items-center justify-center">
              <span className="text-lg">🧠</span>
            </div>
            <div className="text-sm font-bold text-[#E0263A]">{tx('psycho')}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[rgba(255,251,240,0.45)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b5f4f] uppercase mb-1">{tx('focus')}</div>
              <div className="text-xs text-[#1A1310] font-medium">{user.psychotype.focus_of_attention}</div>
            </div>
            <div className="bg-[rgba(255,251,240,0.45)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b5f4f] uppercase mb-1">{tx('tone')}</div>
              <div className="text-xs text-[#1A1310] font-medium">{user.psychotype.emotional_tone}</div>
            </div>
            <div className="col-span-2 bg-[rgba(255,251,240,0.45)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b5f4f] uppercase mb-1">{tx('topic')}</div>
              <div className="text-xs text-[#1A1310] font-medium">{user.psychotype.key_topic}</div>
            </div>
            <div className="col-span-2 bg-gradient-to-r from-[rgba(224,38,58,0.15)] to-[rgba(167,139,250,0.15)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b5f4f] uppercase mb-1">{tx('priority')}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[rgba(45,42,94,0.16)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#E0263A] to-[#1C3FD6] rounded-full"
                    style={{ width: `${(user.psychotype.priority_score ?? 5) * 10}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-[#E0263A]">{user.psychotype.priority_score ?? 5}/10</span>
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
                <div className="text-2xl font-extrabold text-[#1A1310]">
                  {card.value}
                  {card.suffix && <span className="text-xs text-[#6b5f4f] ml-1">{card.suffix}</span>}
                </div>
                <div className="text-[10px] tracking-wide text-[#6b5f4f] uppercase">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Badge */}
      <div className="glass p-5 rounded-[20px] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[2px] text-[#6b5f4f] uppercase mb-1">{tx('role')}</div>
          <div className="text-lg font-bold text-[#1A1310]">{roleLabel}</div>
        </div>
        <div
          className="rift-patch w-14 h-14 text-2xl"
          style={{
            background: 'rgba(255,251,240,0.5)',
            ['--patch-rot' as any]: (roleKey === 'admin' || roleKey === 'doverenniy') ? '7deg' : '3deg',
            ['--patch-scale' as any]: (roleKey === 'admin' || roleKey === 'doverenniy') ? 1.1 : 1,
          }}
        >
          {roleKey === 'admin' ? '👑' : roleKey === 'moderator' ? '🛡' : roleKey === 'doverenniy' ? '🎙' : roleKey === 'aktivniy' ? '⚡' : '🎧'}
        </div>
      </div>
    </div>
  );
}
