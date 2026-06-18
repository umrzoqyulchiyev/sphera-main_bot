import { useState, useEffect } from 'react';
import { TrendingUp, MessageSquare, Mic, Radio, Star, Award, Calendar } from 'lucide-react';
import type { User } from '../../types';

interface StatsScreenProps {
  user: User | null;
}

interface Stats {
  totalMessages: number;
  voiceMessages: number;
  studioMessages: number;
  pointsEarned: number;
  pointsSpent: number;
  daysActive: number;
  favoriteCount: number;
  broadcastCount: number;
}

export function StatsScreen({ user }: StatsScreenProps) {
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    voiceMessages: 0,
    studioMessages: 0,
    pointsEarned: 0,
    pointsSpent: 0,
    daysActive: 0,
    favoriteCount: 0,
    broadcastCount: 0,
  });

  useEffect(() => {
    // TODO: Load real stats from backend
    // For now, mock data based on user points
    if (user) {
      const mockStats: Stats = {
        totalMessages: Math.floor(user.points / 2),
        voiceMessages: Math.floor(user.points / 3),
        studioMessages: Math.floor(user.points / 5),
        pointsEarned: user.points + Math.floor(user.points * 0.5),
        pointsSpent: Math.floor(user.points * 0.5),
        daysActive: Math.min(Math.floor(user.points / 10), 90),
        favoriteCount: Math.floor(user.points / 8),
        broadcastCount: Math.floor(user.points / 15),
      };
      setStats(mockStats);
    }
  }, [user]);

  const level = Math.floor((user?.points || 0) / 100) + 1;
  const nextLevelPoints = level * 100;
  const progress = ((user?.points || 0) % 100) / 100 * 100;

  const statCards = [
    {
      icon: MessageSquare,
      label: 'Сообщений',
      value: stats.totalMessages,
      color: '#00d9ff',
      bgGradient: 'from-[rgba(0,217,255,0.15)] to-[rgba(0,217,255,0.05)]',
    },
    {
      icon: Mic,
      label: 'Голосовых',
      value: stats.voiceMessages,
      color: '#a855f7',
      bgGradient: 'from-[rgba(168,85,247,0.15)] to-[rgba(168,85,247,0.05)]',
    },
    {
      icon: Radio,
      label: 'В Студию',
      value: stats.studioMessages,
      color: '#ec4899',
      bgGradient: 'from-[rgba(236,72,153,0.15)] to-[rgba(236,72,153,0.05)]',
    },
    {
      icon: Star,
      label: 'Избранное',
      value: stats.favoriteCount,
      color: '#f59e0b',
      bgGradient: 'from-[rgba(245,158,11,0.15)] to-[rgba(245,158,11,0.05)]',
    },
    {
      icon: TrendingUp,
      label: 'Заработано',
      value: stats.pointsEarned,
      color: '#22c55e',
      bgGradient: 'from-[rgba(34,197,94,0.15)] to-[rgba(34,197,94,0.05)]',
      suffix: 'PT',
    },
    {
      icon: Calendar,
      label: 'Дней активен',
      value: stats.daysActive,
      color: '#06b6d4',
      bgGradient: 'from-[rgba(6,182,212,0.15)] to-[rgba(6,182,212,0.05)]',
    },
  ];

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Level Progress */}
      <div className="relative">
        {/* Glow background */}
        <div className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-[rgba(0,217,255,0.2)] to-[rgba(0,136,255,0.1)] blur-2xl opacity-60" />
        
        <div className="relative glass p-6 rounded-[24px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] tracking-[2px] text-[#6b7c9e] uppercase mb-1">
                Текущий Уровень
              </div>
              <div className="text-4xl font-extrabold text-white">
                <span className="text-[#00d9ff] text-glow-strong">{level}</span>
              </div>
            </div>
            
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00d9ff] to-[#0088ff] flex items-center justify-center shadow-[0_0_30px_rgba(0,217,255,0.5)]">
              <Award className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#8b9cbe]">{user?.points || 0} поинтов</span>
              <span className="text-[#00d9ff] font-bold">{nextLevelPoints} для {level + 1} ур.</span>
            </div>
            
            <div className="h-3 rounded-full bg-[rgba(107,124,158,0.2)] overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-[#00d9ff] to-[#0088ff] rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${progress}%`,
                  boxShadow: '0 0 20px rgba(0,217,255,0.6)',
                }}
              />
              
              {/* Animated shine */}
              <div 
                className="absolute inset-0 opacity-40"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  animation: 'slide-shine 2s ease-in-out infinite',
                }}
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
            <div className="text-sm font-bold text-[#00d9ff]">Психотип</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[rgba(10,20,40,0.4)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">
                Фокус внимания
              </div>
              <div className="text-xs text-white font-medium">
                {user.psychotype.focus_of_attention}
              </div>
            </div>

            <div className="bg-[rgba(10,20,40,0.4)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">
                Эмоц. тон
              </div>
              <div className="text-xs text-white font-medium">
                {user.psychotype.emotional_tone}
              </div>
            </div>

            <div className="col-span-2 bg-[rgba(10,20,40,0.4)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">
                Ключевая тема
              </div>
              <div className="text-xs text-white font-medium">
                {user.psychotype.key_topic}
              </div>
            </div>

            <div className="col-span-2 bg-gradient-to-r from-[rgba(0,217,255,0.15)] to-[rgba(168,85,247,0.15)] rounded-xl p-3">
              <div className="text-[9px] tracking-wider text-[#6b7c9e] uppercase mb-1">
                Приоритет
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[rgba(0,0,0,0.3)] overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#00d9ff] to-[#a855f7] rounded-full"
                    style={{ width: `${(user.psychotype.priority_score ?? 5) * 10}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-[#00d9ff]">
                  {user.psychotype.priority_score ?? 5}/10
                </span>
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
            <div 
              key={idx}
              className="glass rounded-[20px] p-4 hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-start justify-between mb-3">
                <div 
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.bgGradient} flex items-center justify-center`}
                >
                  <Icon 
                    className="w-5 h-5" 
                    style={{ color: card.color }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-extrabold text-white">
                  {card.value}
                  {card.suffix && (
                    <span className="text-xs text-[#6b7c9e] ml-1">{card.suffix}</span>
                  )}
                </div>
                <div className="text-[10px] tracking-wide text-[#6b7c9e] uppercase">
                  {card.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Badge */}
      <div className="glass p-5 rounded-[20px] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[2px] text-[#6b7c9e] uppercase mb-1">
            Ваша Роль
          </div>
          <div className="text-lg font-bold text-white capitalize">
            {user?.role === 'slusatel' && '🎧 Слушатель'}
            {user?.role === 'aktivniy' && '⚡ Активный'}
            {user?.role === 'doverenniy' && '🎙 Доверенный'}
            {user?.role === 'admin' && '👑 Администратор'}
          </div>
        </div>

        <div className="text-4xl opacity-30">
          {user?.role === 'slusatel' && '🎧'}
          {user?.role === 'aktivniy' && '⚡'}
          {user?.role === 'doverenniy' && '🎙'}
          {user?.role === 'admin' && '👑'}
        </div>
      </div>

      <style>{`
        @keyframes slide-shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
