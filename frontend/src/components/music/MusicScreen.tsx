import { useState, useEffect, useCallback } from 'react';
import { Music, Plus, ThumbsUp, Trophy, X, Loader } from 'lucide-react';
import {
  getMusicCurrent, addMusicNomination, voteMusicNomination,
  type MusicNomination, type MusicCurrentResult,
} from '../../lib/api';
import { getLang } from '../../lib/i18n';
import type { User } from '../../types';

interface Props {
  user: User | null;
  onPointsUpdate: (p: number) => void;
}

const L: Record<string, Record<string, string>> = {
  ru: {
    title: 'Голосование за музыку',
    subtitle: 'Предложите трек или проголосуйте',
    no_topic: 'Нет активной темы',
    no_topic_sub: 'Музыкальное голосование откроется с новой темой эфира',
    nominations: 'Номинации',
    votes: 'голосов',
    vote: 'Голосовать',
    voted: 'Вы уже голосовали',
    add: 'Предложить трек',
    track_name: 'Название трека',
    artist: 'Исполнитель (необязательно)',
    submit: 'Предложить',
    cancel: 'Отмена',
    cost_vote: '0.001 поинта',
    cost_nom: '0.001 поинта',
    winner: 'Лидер голосования',
    no_noms: 'Ещё нет номинаций',
    no_noms_sub: 'Будьте первым — предложите трек!',
    topic: 'Тема эфира',
    already_voted: 'Уже проголосовали за эту тему',
    insufficient: 'Недостаточно поинтов',
  },
  en: {
    title: 'Music voting',
    subtitle: 'Suggest a track or vote',
    no_topic: 'No active topic',
    no_topic_sub: 'Music voting opens with a new broadcast topic',
    nominations: 'Nominations',
    votes: 'votes',
    vote: 'Vote',
    voted: 'Already voted',
    add: 'Suggest track',
    track_name: 'Track name',
    artist: 'Artist (optional)',
    submit: 'Submit',
    cancel: 'Cancel',
    cost_vote: '0.001 points',
    cost_nom: '0.001 points',
    winner: 'Leading track',
    no_noms: 'No nominations yet',
    no_noms_sub: 'Be first — suggest a track!',
    topic: 'Broadcast topic',
    already_voted: 'Already voted for this topic',
    insufficient: 'Not enough points',
  },
  lt: {
    title: 'Muzikos balsavimas',
    subtitle: 'Siūlykite kūrinį arba balsuokite',
    no_topic: 'Nėra aktyvios temos',
    no_topic_sub: 'Muzikos balsavimas atsidarys su nauja eterio tema',
    nominations: 'Nominacijos',
    votes: 'balsų',
    vote: 'Balsuoti',
    voted: 'Jau balsavote',
    add: 'Siūlyti kūrinį',
    track_name: 'Kūrinio pavadinimas',
    artist: 'Atlikėjas (nebūtina)',
    submit: 'Pateikti',
    cancel: 'Atšaukti',
    cost_vote: '0.001 taško',
    cost_nom: '0.001 taško',
    winner: 'Pirmaujantis kūrinys',
    no_noms: 'Dar nėra nominacijų',
    no_noms_sub: 'Būkite pirmasis — pasiūlykite kūrinį!',
    topic: 'Eterio tema',
    already_voted: 'Jau balsavote šiai temai',
    insufficient: 'Nepakanka taškų',
  },
};

export function MusicScreen({ onPointsUpdate }: Props) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;

  const [data, setData] = useState<MusicCurrentResult>({ topic: null, nominations: [] });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const load = useCallback(async () => {
    try {
      const res = await getMusicCurrent();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleVote(nom: MusicNomination) {
    if (nom.user_voted) { flash('⚠️ ' + tx('already_voted')); return; }
    setVoting(nom.id);
    try {
      const res = await voteMusicNomination(nom.id);
      if (res?.detail?.points !== undefined) onPointsUpdate(Number(res.detail.points));
      flash('✅ +1 голос');
      await load();
    } catch (e: any) {
      if (e.message?.includes('Already')) flash('⚠️ ' + tx('already_voted'));
      else if (e.message?.includes('insufficient')) flash('❌ ' + tx('insufficient'));
      else flash('❌ ' + e.message);
    } finally {
      setVoting(null);
    }
  }

  async function handleAddNomination() {
    if (!newTitle.trim() || !data.topic) return;
    setSubmitting(true);
    try {
      const res = await addMusicNomination(data.topic.id, newTitle.trim(), newArtist.trim());
      if (res?.detail?.points !== undefined) onPointsUpdate(Number(res.detail.points));
      flash('✅ Трек добавлен!');
      setNewTitle(''); setNewArtist(''); setShowAdd(false);
      await load();
    } catch (e: any) {
      if (e.message?.includes('insufficient')) flash('❌ ' + tx('insufficient'));
      else flash('❌ ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const winner = data.nominations[0];

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader className="w-8 h-8 text-[#5e6ad2] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="stitch-card p-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(124,92,255,0.15)' }}>
            <Music className="w-5 h-5 text-[#a78bfa]" />
          </div>
          <div>
            <div className="text-base font-black text-[#ededef]">{tx('title')}</div>
            <div className="text-[11px] text-[#8a8f98]">{tx('subtitle')}</div>
          </div>
        </div>
        {data.topic && (
          <div className="mt-2 px-3 py-2 rounded-xl text-[11px]"
            style={{ background: 'rgba(94,106,210,0.07)', border: '1px solid rgba(94,106,210,0.12)' }}>
            <span className="text-[#8a8f98]">{tx('topic')}: </span>
            <span className="text-[#5e6ad2] font-semibold">{data.topic.title}</span>
          </div>
        )}
      </div>

      {/* No topic */}
      {!data.topic && (
        <div className="stitch-card p-8 text-center">
          <Music className="w-12 h-12 text-[#8a8f98] mx-auto mb-3" />
          <div className="text-sm font-bold text-[#ededef] mb-1">{tx('no_topic')}</div>
          <div className="text-[11px] text-[#8a8f98]">{tx('no_topic_sub')}</div>
        </div>
      )}

      {data.topic && (
        <>
          {/* Winner banner */}
          {winner && winner.vote_count > 0 && (
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.2), rgba(94,106,210,0.1))', border: '1px solid rgba(124,92,255,0.3)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-[#f59e0b]" />
                <span className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-wide">{tx('winner')}</span>
              </div>
              <div className="text-base font-black text-[#ededef]">{winner.title}</div>
              {winner.artist && <div className="text-[12px] text-[#8a8f98] mt-0.5">{winner.artist}</div>}
              <div className="text-[11px] text-[#a78bfa] mt-1 font-bold">{winner.vote_count} {tx('votes')}</div>
            </div>
          )}

          {/* Add nomination button */}
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.25)', color: '#a78bfa' }}>
              <Plus className="w-4 h-4" />
              {tx('add')} · {tx('cost_nom')}
            </button>
          ) : (
            <div className="stitch-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#a78bfa]">{tx('add')}</span>
                <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-[#8a8f98]" /></button>
              </div>
              <input
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
                style={{ background: 'rgba(5,5,6,0.6)', border: '1px solid rgba(94,106,210,0.2)' }}
                placeholder={tx('track_name')}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNomination()}
              />
              <input
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
                style={{ background: 'rgba(5,5,6,0.6)', border: '1px solid rgba(94,106,210,0.2)' }}
                placeholder={tx('artist')}
                value={newArtist}
                onChange={e => setNewArtist(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#8a8f98]"
                  style={{ background: 'rgba(94,106,210,0.05)', border: '1px solid rgba(94,106,210,0.1)' }}>
                  {tx('cancel')}
                </button>
                <button onClick={handleAddNomination} disabled={submitting || !newTitle.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#020203] disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7c5cff, #a855f7)' }}>
                  {submitting ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : tx('submit')}
                </button>
              </div>
            </div>
          )}

          {/* Nominations list */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold tracking-[2px] text-[#8a8f98] uppercase px-1">
              {tx('nominations')} · {data.nominations.length}
            </div>

            {data.nominations.length === 0 ? (
              <div className="stitch-card p-8 text-center">
                <Music className="w-10 h-10 text-[#8a8f98] mx-auto mb-3" />
                <div className="text-sm font-bold text-[#ededef] mb-1">{tx('no_noms')}</div>
                <div className="text-[11px] text-[#8a8f98]">{tx('no_noms_sub')}</div>
              </div>
            ) : data.nominations.map((nom, idx) => (
              <div key={nom.id} className="stitch-card p-3.5 flex items-center gap-3">
                {/* Rank */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-black"
                  style={{
                    background: idx === 0 ? 'rgba(245,158,11,0.15)' : idx === 1 ? 'rgba(138,143,152,0.1)' : 'rgba(94,106,210,0.06)',
                    color: idx === 0 ? '#f59e0b' : idx === 1 ? '#8a8f98' : '#8a8f98',
                  }}>
                  #{idx + 1}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#ededef] truncate">{nom.title}</div>
                  {nom.artist && <div className="text-[11px] text-[#8a8f98] truncate">{nom.artist}</div>}
                </div>
                {/* Vote count + button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[12px] font-bold text-[#a78bfa]">{nom.vote_count}</span>
                  <button
                    onClick={() => handleVote(nom)}
                    disabled={nom.user_voted || voting === nom.id}
                    className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
                    style={{
                      background: nom.user_voted ? 'rgba(94,106,210,0.05)' : 'rgba(124,92,255,0.15)',
                      border: `1px solid ${nom.user_voted ? 'rgba(94,106,210,0.1)' : 'rgba(124,92,255,0.3)'}`,
                    }}>
                    {voting === nom.id
                      ? <Loader className="w-3.5 h-3.5 text-[#a78bfa] animate-spin" />
                      : <ThumbsUp className="w-3.5 h-3.5" style={{ color: nom.user_voted ? '#8a8f98' : '#a78bfa' }} />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm text-[#ededef] z-50"
          style={{ background: 'rgba(16,16,20,0.98)', border: '1px solid rgba(94,106,210,0.3)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
