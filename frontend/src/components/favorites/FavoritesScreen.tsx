import { useState, useEffect } from 'react';
import { Star, Play, Clock, User as UserIcon, Trash2, Search } from 'lucide-react';
import type { User } from '../../types';

interface Favorite {
  id: number;
  type: 'broadcast' | 'message' | 'segment';
  title: string;
  content: string;
  broadcaster?: string;
  duration?: number;
  audioUrl?: string;
  createdAt: string;
}

interface FavoritesScreenProps {
  user: User | null;
}

export function FavoritesScreen({ user }: FavoritesScreenProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [filter, setFilter] = useState<'all' | 'broadcast' | 'message'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // TODO: Load favorites from backend
    // Mock data for now
    const mockFavorites: Favorite[] = [
      {
        id: 1,
        type: 'broadcast',
        title: 'Философия утреннего кофе',
        content: 'Размышления о важности начала дня с правильных мыслей...',
        broadcaster: 'AI Host',
        duration: 180,
        audioUrl: '/audio/sample1.mp3',
        createdAt: '2024-06-10T08:30:00Z',
      },
      {
        id: 2,
        type: 'message',
        title: 'Обсуждение городских проектов',
        content: 'Хотелось бы обсудить новые инициативы по благоустройству парков в нашем городе...',
        createdAt: '2024-06-09T14:20:00Z',
      },
      {
        id: 3,
        type: 'segment',
        title: 'Музыкальная подборка вечера',
        content: 'Специальный эфир с классической музыкой',
        broadcaster: 'Doverenniy Alex',
        duration: 240,
        audioUrl: '/audio/sample2.mp3',
        createdAt: '2024-06-08T19:00:00Z',
      },
    ];
    setFavorites(mockFavorites);
  }, [user]);

  const filteredFavorites = favorites.filter((fav) => {
    if (filter !== 'all' && fav.type !== filter) return false;
    if (searchQuery && !fav.title.toLowerCase().includes(searchQuery.toLowerCase()) 
        && !fav.content.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleRemove = (id: number) => {
    // TODO: Remove from backend
    setFavorites(favorites.filter((f) => f.id !== id));
  };

  const handlePlay = (audioUrl: string) => {
    // TODO: Integrate with audio player
    console.log('Playing:', audioUrl);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="glass p-4 rounded-[20px] space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7c9e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск в избранном..."
            className="w-full bg-[rgba(10,20,40,0.6)] border border-[rgba(0,217,255,0.2)] rounded-[16px] pl-10 pr-4 py-3 text-sm outline-none focus:border-[rgba(0,217,255,0.4)] transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-gradient-to-r from-[#00d9ff] to-[#0088ff] text-white shadow-[0_0_15px_rgba(0,217,255,0.4)]'
                : 'bg-[rgba(10,20,40,0.4)] text-[#6b7c9e] hover:text-white'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setFilter('broadcast')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              filter === 'broadcast'
                ? 'bg-gradient-to-r from-[#00d9ff] to-[#0088ff] text-white shadow-[0_0_15px_rgba(0,217,255,0.4)]'
                : 'bg-[rgba(10,20,40,0.4)] text-[#6b7c9e] hover:text-white'
            }`}
          >
            Эфиры
          </button>
          <button
            onClick={() => setFilter('message')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              filter === 'message'
                ? 'bg-gradient-to-r from-[#00d9ff] to-[#0088ff] text-white shadow-[0_0_15px_rgba(0,217,255,0.4)]'
                : 'bg-[rgba(10,20,40,0.4)] text-[#6b7c9e] hover:text-white'
            }`}
          >
            Сообщения
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filteredFavorites.length === 0 && (
        <div className="glass p-8 rounded-[24px] text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[rgba(0,217,255,0.2)] to-[rgba(0,217,255,0.05)] flex items-center justify-center">
            <Star className="w-8 h-8 text-[#00d9ff] opacity-40" />
          </div>
          <div className="text-sm text-[#6b7c9e]">
            {searchQuery 
              ? 'Ничего не найдено' 
              : 'Ваше избранное пока пусто'}
          </div>
          <div className="text-xs text-[#6b7c9e] opacity-60">
            {searchQuery
              ? 'Попробуйте изменить запрос'
              : 'Добавляйте интересные эфиры и сообщения'}
          </div>
        </div>
      )}

      {/* Favorites List */}
      <div className="space-y-3">
        {filteredFavorites.map((fav) => (
          <div 
            key={fav.id}
            className="glass rounded-[20px] p-4 hover:border-[rgba(0,217,255,0.3)] transition-all group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div 
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    fav.type === 'broadcast' 
                      ? 'bg-gradient-to-br from-[rgba(0,217,255,0.2)] to-[rgba(0,217,255,0.05)]'
                      : 'bg-gradient-to-br from-[rgba(168,85,247,0.2)] to-[rgba(168,85,247,0.05)]'
                  }`}
                >
                  {fav.type === 'broadcast' ? (
                    <span className="text-sm">📻</span>
                  ) : (
                    <span className="text-sm">💬</span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {fav.title}
                  </div>
                  {fav.broadcaster && (
                    <div className="flex items-center gap-1 text-[9px] text-[#6b7c9e] mt-0.5">
                      <UserIcon className="w-3 h-3" />
                      <span>{fav.broadcaster}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRemove(fav.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[rgba(255,77,109,0.1)] text-[#ff4d6d]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-xs text-[#8b9cbe] leading-relaxed mb-3 line-clamp-2">
              {fav.content}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-[#6b7c9e]">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(fav.createdAt)}</span>
                </div>
                {fav.duration && (
                  <div className="flex items-center gap-1">
                    <span>⏱</span>
                    <span>{formatDuration(fav.duration)}</span>
                  </div>
                )}
              </div>

              {fav.audioUrl && (
                <button
                  onClick={() => handlePlay(fav.audioUrl!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[rgba(0,217,255,0.15)] to-[rgba(0,136,255,0.1)] hover:from-[rgba(0,217,255,0.25)] hover:to-[rgba(0,136,255,0.15)] text-[#00d9ff] text-xs font-semibold transition-all"
                >
                  <Play className="w-3 h-3" />
                  <span>Слушать</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Stats Footer */}
      {filteredFavorites.length > 0 && (
        <div className="glass p-4 rounded-[20px] flex items-center justify-between text-xs">
          <span className="text-[#6b7c9e]">Всего сохранено</span>
          <span className="text-[#00d9ff] font-bold">{favorites.length} элемент(ов)</span>
        </div>
      )}
    </div>
  );
}
