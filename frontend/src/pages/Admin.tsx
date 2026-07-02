import { useState, useEffect } from 'react';
import { Plus, X, Users, MessageSquare, Lock, Award, Loader, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import {
  adminCreateTopic, adminGetTopics, adminCloseTopic,
  getUsers, adminSetLevel, adminAddPoints,
} from '../lib/api';
import { authHeaders } from '../lib/auth';
import { API_URL } from '../lib/config';
import { getLang } from '../lib/i18n';

interface Topic {
  id: number; title: string; description: string;
  status: string; opinion_count: number; created_at: string;
}
interface UserRow {
  id: number; telegram_id: number; username: string | null;
  display_name: string | null; level: number; points: string;
  role: string; created_at: string;
}
interface Draft {
  id: number; city: string; main_topic: string;
  source_count: number; status: string; created_at: string;
  script_preview?: string; dialog?: string; meta?: any;
}

const L: Record<string, Record<string, string>> = {
  ru: {
    title: 'ADMIN PANEL', topics_tab: 'Темы', users_tab: 'Люди', drafts_tab: 'Эфир',
    new_topic: 'Новая тема', topic_title: 'Название темы', topic_desc: 'Описание',
    create: 'Создать', close: 'Закрыть', active: 'Активна', closed: 'Закрыта',
    opinions: 'мнений', no_topics: 'Нет тем', no_users: 'Нет пользователей',
    add_pts: 'Поинты', lvl1: 'Слушатель', lvl2: 'Активный', lvl3: 'Доверенный',
    aggregate: 'Создать диалог', no_drafts: 'Нет черновиков эфира',
    pending: 'Ожидает', approved: 'В эфире', rejected: 'Отклонён',
    approve: 'Одобрить → Эфир', reject: 'Отклонить', view: 'Смотреть',
    dialog_title: 'Диалог', positions: 'Позиции слушателей', music: 'Музыка',
    sources: 'источников', words: 'слов',
  },
  en: {
    title: 'ADMIN PANEL', topics_tab: 'Topics', users_tab: 'People', drafts_tab: 'Broadcast',
    new_topic: 'New topic', topic_title: 'Topic title', topic_desc: 'Description',
    create: 'Create', close: 'Close', active: 'Active', closed: 'Closed',
    opinions: 'opinions', no_topics: 'No topics', no_users: 'No users',
    add_pts: 'Points', lvl1: 'Listener', lvl2: 'Active', lvl3: 'Trusted',
    aggregate: 'Create dialog', no_drafts: 'No broadcast drafts',
    pending: 'Pending', approved: 'On air', rejected: 'Rejected',
    approve: 'Approve → Air', reject: 'Reject', view: 'View',
    dialog_title: 'Dialog', positions: 'Listener positions', music: 'Music',
    sources: 'sources', words: 'words',
  },
  lt: {
    title: 'ADMIN PANEL', topics_tab: 'Temos', users_tab: 'Žmonės', drafts_tab: 'Eteris',
    new_topic: 'Nauja tema', topic_title: 'Temos pavadinimas', topic_desc: 'Aprašymas',
    create: 'Sukurti', close: 'Uždaryti', active: 'Aktyvi', closed: 'Uždaryta',
    opinions: 'nuomonių', no_topics: 'Nėra temų', no_users: 'Nėra vartotojų',
    add_pts: 'Taškai', lvl1: 'Klausytojas', lvl2: 'Aktyvus', lvl3: 'Patikimas',
    aggregate: 'Sukurti dialogą', no_drafts: 'Nėra eterio juodraščių',
    pending: 'Laukia', approved: 'Eteryje', rejected: 'Atmesta',
    approve: 'Patvirtinti → Eterį', reject: 'Atmesti', view: 'Žiūrėti',
    dialog_title: 'Dialogas', positions: 'Klausytojų pozicijos', music: 'Muzika',
    sources: 'šaltinių', words: 'žodžių',
  },
};

// API helper funksiyalar (admin endpointlar uchun)
async function adminAggregateTopic(topicId: number) {
  const r = await fetch(`${API_URL}/admin/topics/${topicId}/aggregate`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Error'); }
  return r.json();
}
async function adminGetDrafts(): Promise<Draft[]> {
  const r = await fetch(`${API_URL}/admin/drafts`, { headers: authHeaders() });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function adminGetDraft(id: number): Promise<Draft> {
  const r = await fetch(`${API_URL}/admin/drafts/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function adminApproveDraft(id: number) {
  const r = await fetch(`${API_URL}/admin/drafts/${id}/approve`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function adminRejectDraft(id: number) {
  const r = await fetch(`${API_URL}/admin/drafts/${id}/reject`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

export function Admin() {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const [tab, setTab] = useState<'topics' | 'users' | 'drafts'>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [aggregating, setAggregating] = useState<number | null>(null);

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'topics') setTopics(await adminGetTopics());
      else if (tab === 'users') setUsers(await getUsers());
      else setDrafts(await adminGetDrafts());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function handleCreateTopic() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try { await adminCreateTopic(newTitle.trim(), newDesc.trim()); setNewTitle(''); setNewDesc(''); setShowCreate(false); flash('✅'); await loadData(); }
    catch { flash('❌'); } finally { setCreating(false); }
  }

  async function handleAggregate(topicId: number) {
    setAggregating(topicId);
    try {
      const res = await adminAggregateTopic(topicId);
      flash(`✅ Dialog #${res.draft_id} yaratildi!`);
      setTab('drafts');
    } catch (e: any) { flash(`❌ ${e.message}`); }
    finally { setAggregating(null); }
  }

  async function handleViewDraft(id: number) {
    try { setActiveDraft(await adminGetDraft(id)); } catch { flash('❌'); }
  }

  async function handleApproveDraft(id: number) {
    try { await adminApproveDraft(id); flash('✅ Efirga yuborildi!'); setActiveDraft(null); await loadData(); }
    catch { flash('❌'); }
  }

  async function handleRejectDraft(id: number) {
    try { await adminRejectDraft(id); flash('✅ Rad etildi'); setActiveDraft(null); await loadData(); }
    catch { flash('❌'); }
  }

  return (
    <div className="min-h-[var(--app-vh)] bg-[#060a14] text-[#dbe9ff]">
      <div className="max-w-[520px] mx-auto px-3.5 pt-3.5 pb-6 flex flex-col gap-4">
        <header className="flex items-center justify-between pt-2">
          <div>
            <div className="text-[20px] font-extrabold tracking-[3px] logo-gradient">INTRA GROUP</div>
            <div className="text-[9px] tracking-[4px] text-[#6b7c9e] mt-0.5">{tx('title')}</div>
          </div>
        </header>

        {/* Tabs — 3 ta */}
        <div className="flex gap-2">
          {([['topics', MessageSquare, tx('topics_tab')], ['drafts', Sparkles, tx('drafts_tab')], ['users', Users, tx('users_tab')]] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`flex-1 py-2.5 px-2 rounded-[14px] border font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                tab === t ? 'bg-gradient-to-br from-[#2ea8ff] to-[#38e1ff] text-[#02101f] border-transparent' : 'glass text-[#dbe9ff]'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader className="w-8 h-8 text-[#38e1ff] animate-spin" /></div>
        ) : tab === 'topics' ? (
          <TopicsTab topics={topics} tx={tx} showCreate={showCreate} setShowCreate={setShowCreate}
            newTitle={newTitle} setNewTitle={setNewTitle} newDesc={newDesc} setNewDesc={setNewDesc}
            creating={creating} aggregating={aggregating}
            onCreateTopic={handleCreateTopic}
            onCloseTopic={async (id) => { try { await adminCloseTopic(id); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onAggregate={handleAggregate} />
        ) : tab === 'drafts' ? (
          <DraftsTab drafts={drafts} tx={tx} onView={handleViewDraft} onApprove={handleApproveDraft} onReject={handleRejectDraft} />
        ) : (
          <UsersTab users={users} tx={tx}
            onSetLevel={async (id, lvl) => { try { await adminSetLevel(id, lvl); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onAddPoints={async (id) => { const s = prompt(tx('add_pts')); if (!s) return; const a = parseFloat(s); if (!a) return; try { await adminAddPoints(id, a); flash('✅'); await loadData(); } catch { flash('❌'); } }} />
        )}
      </div>

      {/* Draft ko'rish modal */}
      {activeDraft && (
        <DraftModal draft={activeDraft} tx={tx} onClose={() => setActiveDraft(null)}
          onApprove={handleApproveDraft} onReject={handleRejectDraft} />
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-xl text-sm text-[#dbe9ff] border border-[rgba(56,225,255,0.4)] z-[200]">
          {toast}
        </div>
      )}
    </div>
  );
}

function TopicsTab({ topics, tx, showCreate, setShowCreate, newTitle, setNewTitle, newDesc, setNewDesc, creating, aggregating, onCreateTopic, onCloseTopic, onAggregate }: any) {
  return (
    <div className="flex flex-col gap-3">
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)} className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#38e1ff] active:scale-[0.98]">
          <Plus className="w-4 h-4" /> {tx('new_topic')}
        </button>
      ) : (
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#38e1ff]">{tx('new_topic')}</span>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-[#6b7c9e]" /></button>
          </div>
          <input className="w-full bg-[rgba(6,10,20,0.7)] border border-[rgba(80,160,255,0.18)] rounded-xl px-4 py-3 text-sm text-[#dbe9ff] outline-none" placeholder={tx('topic_title')} value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} />
          <input className="w-full bg-[rgba(6,10,20,0.7)] border border-[rgba(80,160,255,0.18)] rounded-xl px-4 py-3 text-sm text-[#dbe9ff] outline-none" placeholder={tx('topic_desc')} value={newDesc} onChange={(e: any) => setNewDesc(e.target.value)} />
          <button onClick={onCreateTopic} disabled={creating || !newTitle.trim()} className="w-full py-3 rounded-xl font-bold text-sm text-[#02101f] disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #2ea8ff, #38e1ff)' }}>
            {creating ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : tx('create')}
          </button>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="glass p-8 text-center text-[#6b7c9e] text-sm">{tx('no_topics')}</div>
      ) : topics.map((t: Topic) => (
        <div key={t.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${t.status === 'active' ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' : 'bg-[rgba(107,124,158,0.15)] text-[#6b7c9e]'}`}>{tx(t.status === 'active' ? 'active' : 'closed')}</span>
                <span className="text-[10px] text-[#6b7c9e]">{t.opinion_count} {tx('opinions')}</span>
              </div>
              <div className="text-sm font-bold text-[#dbe9ff]">{t.title}</div>
            </div>
            {t.status === 'active' && (
              <button onClick={() => onCloseTopic(t.id)} className="ml-2 p-2 rounded-lg bg-[rgba(255,77,109,0.1)] text-[#ff9fb0]">
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Agregatsiya tugmasi — fikr bo'lsa ko'rinadi */}
          {t.opinion_count >= 3 && (
            <button onClick={() => onAggregate(t.id)} disabled={aggregating === t.id}
              className="w-full mt-2 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#02101f] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c5cff, #a855f7)' }}>
              {aggregating === t.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {tx('aggregate')} ({t.opinion_count} {tx('opinions')})
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function DraftsTab({ drafts, tx, onView, onApprove, onReject }: any) {
  const statusColor: Record<string, string> = {
    pending: 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]',
    approved: 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]',
    rejected: 'bg-[rgba(107,124,158,0.15)] text-[#6b7c9e]',
  };
  if (drafts.length === 0) return <div className="glass p-8 text-center text-[#6b7c9e] text-sm">{tx('no_drafts')}</div>;
  return (
    <div className="flex flex-col gap-3">
      {drafts.map((d: Draft) => (
        <div key={d.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${statusColor[d.status] || ''}`}>{tx(d.status)}</span>
                <span className="text-[10px] text-[#6b7c9e]">{d.source_count} {tx('sources')}</span>
              </div>
              <div className="text-sm font-bold text-[#dbe9ff]">🎙 {d.main_topic}</div>
              {d.script_preview && <div className="text-[11px] text-[#6b7c9e] mt-1 line-clamp-2">{d.script_preview.replace(/^\[META:.*?\]\n\n/, '')}</div>}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onView(d.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[rgba(56,225,255,0.08)] text-[#38e1ff] flex items-center justify-center gap-1">
              👁 {tx('view')}
            </button>
            {d.status === 'pending' && <>
              <button onClick={() => onApprove(d.id)} className="flex-1 py-2 rounded-xl text-xs font-bold bg-[rgba(34,197,94,0.15)] text-[#22c55e] flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {tx('approve')}
              </button>
              <button onClick={() => onReject(d.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[rgba(255,77,109,0.1)] text-[#ff9fb0] flex items-center justify-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {tx('reject')}
              </button>
            </>}
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftModal({ draft, tx, onClose, onApprove, onReject }: any) {
  const meta = draft.meta || {};
  const dialog = draft.dialog || draft.script || '';
  const wordCount = dialog.split(/\s+/).filter(Boolean).length;
  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex-1 overflow-y-auto p-4 max-w-[520px] mx-auto w-full" onClick={(e) => e.stopPropagation()}>
        <div className="glass rounded-2xl p-5 flex flex-col gap-4 mt-4 mb-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="text-base font-bold text-[#38e1ff]">🎙 {draft.main_topic}</div>
            <button onClick={onClose}><X className="w-5 h-5 text-[#6b7c9e]" /></button>
          </div>

          {/* META: pozitsiyalar */}
          {meta.positions && (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-bold text-[#a78bfa] uppercase tracking-wide">{tx('positions')}</div>
              {[1,2,3].map(i => {
                const p = meta.positions[`p${i}`];
                if (!p) return null;
                return (
                  <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(124,92,255,0.08)', border: '1px solid rgba(124,92,255,0.15)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-[#a78bfa]">#{i}</span>
                      <span className="text-[10px] text-[#6b7c9e]">{p.percent}%</span>
                    </div>
                    <div className="text-[12px] text-[#dbe9ff]">{p.summary}</div>
                  </div>
                );
              })}
            </div>
          )}
          {meta.music_suggestion && (
            <div className="text-[11px] text-[#6b7c9e]">🎵 {tx('music')}: {meta.music_suggestion}</div>
          )}

          {/* Dialog matni */}
          <div>
            <div className="text-[11px] font-bold text-[#38e1ff] uppercase tracking-wide mb-2">{tx('dialog_title')} · {wordCount} {tx('words')}</div>
            <div className="text-[12px] text-[#bbc9cd] leading-relaxed whitespace-pre-line max-h-[40vh] overflow-y-auto rounded-xl p-3" style={{ background: 'rgba(6,10,20,0.5)' }}>
              {dialog}
            </div>
          </div>

          {/* Tugmalar */}
          {draft.status === 'pending' && (
            <div className="flex gap-3">
              <button onClick={() => onApprove(draft.id)} className="flex-1 py-3 rounded-xl font-bold text-sm text-[#02101f] flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #22c55e, #38e1ff)' }}>
                <CheckCircle className="w-4 h-4" /> {tx('approve')}
              </button>
              <button onClick={() => onReject(draft.id)} className="flex-1 py-3 rounded-xl font-semibold text-sm text-[#ff9fb0] bg-[rgba(255,77,109,0.1)] flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" /> {tx('reject')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
