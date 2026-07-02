import { useState, useEffect } from 'react';
import { Star, Play, Clock, User as UserIcon, Trash2, Search, Loader } from 'lucide-react';
import { getFavorites, removeFavorite, type FavoriteItem } from '../../lib/api';
import { getLang } from '../../lib/i18n';
import type { User } from '../../types';

interface FavoritesScreenProps {
  user: User | null;
}

const L: Record<string, Record<string, string>> = {
  ru: {
    all: 'Все', broadcasts: 'Эфиры', messages: 'Сообщения', search: 'Поиск в избранном...',
    empty: 'Ваше избранное пока пусто', empty_hint: 'Добавляйте интересные эфиры и сообщения',
    not_found: 'Ничего не найдено', try_other: 'Попробуйте изменить запрос',
    total: 'Всего сохранено', items: 'элемент(ов)', listen: 'Слушать',
    today: 'Сегодня', yesterday: 'Вчера', days_ago: 'дн. назад',
  },
  en: {
    all: 'All', broadcasts: 'Broadcasts', messages: 'Messages', search: 'Search favorites...',
    empty: 'Your favorites list is empty', empty_hint: 'Add broadcasts and messages you like',
    not_found: 'Nothing found', try_other: 'Try changing your search',
    total: 'Total saved', items: 'item(s)', listen: 'Listen',
    today: 'Today', yesterday: 'Yesterday', days_ago: 'days ago',
  },
  lt: {
    all: 'Visi', broadcasts: 'Eteriai', messages: 'Žinutės', search: 'Ieškoti parankinuose...',
    empty: 'Parankinių sąrašas tuščias', empty_hint: 'Pridėkite patinkančius eterius ir žinutes',
    not_found: 'Nieko nerasta', try_other: 'Pabandykite pakeisti užklausą',
    total: 'Iš viso išsaugota', items: 'elem.', listen: 'Klausyti',
    today: 'Šiandien', yesterday: 'Vakar', days_ago: 'd. prieš',
  },
};

export function FavoritesScreen({ user }: FavoritesScreenProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'broadcast' | 'message'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getFavorites()
      .then(setFavorites)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const filteredFavorites = favorites.filter((fav) => {
    if (filter !== 'all' && fav.item_type !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!fav.title.toLowerCase().includes(q) && !(fav.content || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleRemove = async (id: number) => {
    try {
      await removeFavorite(id);
      setFavorites(favorites.filter((f) => f.id !== id));
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return tx('today');
    if (diffDays === 1) return tx('yesterday');
    if (diffDays < 7) return `${diffDays} ${tx('days_ago')}`;
    return date.toLocaleDateString(lang === 'lt' ? 'lt-LT' : lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-8 h-8 text-[#38e1ff] animate-spin" />
      </div>
    );
  }

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
            placeholder={tx('search')}
            className="w-full bg-[rgba(10,20,40,0.6)] border border-[rgba(0,217,255,0.2)] rounded-[16px] pl-10 pr-4 py-3 text-sm outline-none focus:border-[rgba(0,217,255,0.4)] transition-colors text-[#dbe9ff]"
          />
        </div>
        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'broadcast', 'message'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-[#00d9ff] to-[#0088ff] text-white shadow-[0_0_15px_rgba(0,217,255,0.4)]'
                  : 'bg-[rgba(10,20,40,0.4)] text-[#6b7c9e] hover:text-white'
              }`}
            >
              {f === 'all' ? tx('all') : f === 'broadcast' ? tx('broadcasts') : tx('messages')}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filteredFavorites.length === 0 && (
        <div className="glass p-8 rounded-[24px] text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[rgba(0,217,255,0.2)] to-[rgba(0,217,255,0.05)] flex items-center justify-center">
            <Star className="w-8 h-8 text-[#00d9ff] opacity-40" />
          </div>
          <div className="text-sm text-[#6b7c9e]">
            {searchQuery ? tx('not_found') : tx('empty')}
          </div>
          <div className="text-xs text-[#6b7c9e] opacity-60">
            {searchQuery ? tx('try_other') : tx('empty_hint')}
          </div>
        </div>
      )}

      {/* Favorites List */}
      <div className="space-y-3">
        {filteredFavorites.map((fav) => (
          <div key={fav.id} className="glass rounded-[20px] p-4 group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  fav.item_type === 'broadcast'
                    ? 'bg-gradient-to-br from-[rgba(0,217,255,0.2)] to-[rgba(0,217,255,0.05)]'
                    : 'bg-gradient-to-br from-[rgba(168,85,247,0.2)] to-[rgba(168,85,247,0.05)]'
                }`}>
                  <span className="text-sm">{fav.item_type === 'broadcast' ? '📻' : '💬'}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{fav.title}</div>
                  {fav.broadcaster && (
                    <div className="flex items-center gap-1 text-[9px] text-[#6b7c9e] mt-0.5">
                      <UserIcon className="w-3 h-3" /><span>{fav.broadcaster}</span>
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
            {fav.content && (
              <p className="text-xs text-[#8b9cbe] leading-relaxed mb-3 line-clamp-2">{fav.content}</p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-[#6b7c9e]">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /><span>{formatDate(fav.created_at)}</span>
                </div>
                {fav.duration && (
                  <div className="flex items-center gap-1"><span>⏱</span><span>{formatDuration(fav.duration)}</span></div>
                )}
              </div>
              {fav.audio_url && (
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[rgba(0,217,255,0.15)] to-[rgba(0,136,255,0.1)] text-[#00d9ff] text-xs font-semibold">
                  <Play className="w-3 h-3" /><span>{tx('listen')}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Stats Footer */}
      {filteredFavorites.length > 0 && (
        <div className="glass p-4 rounded-[20px] flex items-center justify-between text-xs">
          <span className="text-[#6b7c9e]">{tx('total')}</span>
          <span className="text-[#00d9ff] font-bold">{favorites.length} {tx('items')}</span>
        </div>
      )}
    </div>
  );
}
