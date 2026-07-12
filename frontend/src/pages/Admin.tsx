import { useState, useEffect } from 'react';
import { Plus, X, Users, MessageSquare, Lock, Loader, Sparkles, CheckCircle, XCircle, Calendar, Music } from 'lucide-react';
import {
  adminCreateTopic, adminGetTopics, adminCloseTopic,
  getUsers, adminSetLevel, adminAddPoints,
  adminCreateSlot, getAllSlots, adminUpdateSlotStatus,
  getMusicNominations, adminDeleteNomination,
  type BroadcastSlot, type MusicNomination,
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
    title: 'ADMIN PANEL', topics_tab: 'Темы', users_tab: 'Люди', drafts_tab: 'Эфир', slots_tab: 'Слоты', music_tab: 'Музыка',
    new_topic: 'Новая тема', topic_title: 'Название темы', topic_desc: 'Описание',
    create: 'Создать', close: 'Закрыть', active: 'Активна', closed: 'Закрыта',
    opinions: 'мнений', no_topics: 'Нет тем', no_users: 'Нет пользователей',
    add_pts: 'Поинты', lvl1: 'Слушатель', lvl2: 'Активный', lvl3: 'Доверенный',
    aggregate: 'Создать диалог', no_drafts: 'Нет черновиков эфира',
    pending: 'Ожидает', approved: 'В эфире', rejected: 'Отклонён',
    approve: 'Одобрить → Эфир', reject: 'Отклонить', view: 'Смотреть',
    dialog_title: 'Диалог', positions: 'Позиции слушателей', music: 'Музыка',
    sources: 'источников', words: 'слов',
    no_nominations: 'Нет предложенных треков', votes: 'голосов', winner_label: 'Играет в эфире',
    confirm_delete_nom: 'Удалить этот трек из голосования?',
  },
  en: {
    title: 'ADMIN PANEL', topics_tab: 'Topics', users_tab: 'People', drafts_tab: 'Broadcast', slots_tab: 'Slots', music_tab: 'Music',
    new_topic: 'New topic', topic_title: 'Topic title', topic_desc: 'Description',
    create: 'Create', close: 'Close', active: 'Active', closed: 'Closed',
    opinions: 'opinions', no_topics: 'No topics', no_users: 'No users',
    add_pts: 'Points', lvl1: 'Listener', lvl2: 'Active', lvl3: 'Trusted',
    aggregate: 'Create dialog', no_drafts: 'No broadcast drafts',
    pending: 'Pending', approved: 'On air', rejected: 'Rejected',
    approve: 'Approve → Air', reject: 'Reject', view: 'View',
    dialog_title: 'Dialog', positions: 'Listener positions', music: 'Music',
    sources: 'sources', words: 'words',
    no_nominations: 'No track suggestions', votes: 'votes', winner_label: 'On air',
    confirm_delete_nom: 'Remove this track from voting?',
  },
  lt: {
    title: 'ADMIN PANEL', topics_tab: 'Temos', users_tab: 'Žmonės', drafts_tab: 'Eteris', slots_tab: 'Slotai', music_tab: 'Muzika',
    new_topic: 'Nauja tema', topic_title: 'Temos pavadinimas', topic_desc: 'Aprašymas',
    create: 'Sukurti', close: 'Uždaryti', active: 'Aktyvi', closed: 'Uždaryta',
    opinions: 'nuomonių', no_topics: 'Nėra temų', no_users: 'Nėra vartotojų',
    add_pts: 'Taškai', lvl1: 'Klausytojas', lvl2: 'Aktyvus', lvl3: 'Patikimas',
    aggregate: 'Sukurti dialogą', no_drafts: 'Nėra eterio juodraščių',
    pending: 'Laukia', approved: 'Eteryje', rejected: 'Atmesta',
    approve: 'Patvirtinti → Eterį', reject: 'Atmesti', view: 'Žiūrėti',
    dialog_title: 'Dialogas', positions: 'Klausytojų pozicijos', music: 'Muzika',
    sources: 'šaltinių', words: 'žodžių',
    no_nominations: 'Nėra pasiūlytų dainų', votes: 'balsų', winner_label: 'Eteryje',
    confirm_delete_nom: 'Pašalinti šią dainą iš balsavimo?',
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
  const [tab, setTab] = useState<'topics' | 'users' | 'drafts' | 'slots' | 'music'>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [slots, setSlots] = useState<BroadcastSlot[]>([]);
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
      else if (tab === 'slots') { setSlots(await getAllSlots()); setUsers(await getUsers()); }
      else if (tab === 'music') setTopics(await adminGetTopics());
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
    <div className="min-h-[var(--app-vh)] bg-[#050506] text-[#ededef]">
      <div className="max-w-[520px] mx-auto px-3.5 pt-3.5 pb-6 flex flex-col gap-4">
        <header className="flex items-center justify-between pt-2">
          <div>
            <div className="text-[20px] font-extrabold tracking-[3px] logo-gradient">INTRA GROUP</div>
            <div className="text-[9px] tracking-[4px] text-[#8a8f98] mt-0.5">{tx('title')}</div>
          </div>
        </header>

        {/* Tabs — 5 ta */}
        <div className="flex gap-1.5 flex-wrap">
          {([['topics', MessageSquare, tx('topics_tab')], ['drafts', Sparkles, tx('drafts_tab')], ['slots', Calendar, tx('slots_tab')], ['music', Music, tx('music_tab')], ['users', Users, tx('users_tab')]] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`flex-1 py-2 px-1 rounded-[14px] border font-semibold text-[10px] transition-all flex items-center justify-center gap-1 min-w-[18%] ${
                tab === t ? 'bg-gradient-to-br from-[#7b85e8] to-[#5e6ad2] text-[#020203] border-transparent' : 'glass text-[#ededef]'
              }`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader className="w-8 h-8 text-[#5e6ad2] animate-spin" /></div>
        ) : tab === 'topics' ? (
          <TopicsTab topics={topics} tx={tx} showCreate={showCreate} setShowCreate={setShowCreate}
            newTitle={newTitle} setNewTitle={setNewTitle} newDesc={newDesc} setNewDesc={setNewDesc}
            creating={creating} aggregating={aggregating}
            onCreateTopic={handleCreateTopic}
            onCloseTopic={async (id: number) => { try { await adminCloseTopic(id); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onAggregate={handleAggregate} />
        ) : tab === 'drafts' ? (
          <DraftsTab drafts={drafts} tx={tx} onView={handleViewDraft} onApprove={handleApproveDraft} onReject={handleRejectDraft} />
        ) : tab === 'slots' ? (
          <SlotsTab slots={slots} users={users} onReload={loadData} flash={flash} />
        ) : tab === 'music' ? (
          <MusicTab topics={topics} tx={tx} flash={flash} />
        ) : (
          <UsersTab users={users} tx={tx}
            onSetLevel={async (id: number, lvl: number) => { try { await adminSetLevel(id, lvl); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onAddPoints={async (id: number) => { const s = prompt(tx('add_pts')); if (!s) return; const a = parseFloat(s); if (!a) return; try { await adminAddPoints(id, a); flash('✅'); await loadData(); } catch { flash('❌'); } }} />
        )}
      </div>

      {/* Draft ko'rish modal */}
      {activeDraft && (
        <DraftModal draft={activeDraft} tx={tx} onClose={() => setActiveDraft(null)}
          onApprove={handleApproveDraft} onReject={handleRejectDraft} />
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-xl text-sm text-[#ededef] border border-[rgba(94,106,210,0.4)] z-[200]">
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
        <button onClick={() => setShowCreate(true)} className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#5e6ad2] active:scale-[0.98]">
          <Plus className="w-4 h-4" /> {tx('new_topic')}
        </button>
      ) : (
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#5e6ad2]">{tx('new_topic')}</span>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-[#8a8f98]" /></button>
          </div>
          <input className="w-full bg-[rgba(5,5,6,0.7)] border border-[rgba(110,118,220,0.18)] rounded-xl px-4 py-3 text-sm text-[#ededef] outline-none" placeholder={tx('topic_title')} value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} />
          <input className="w-full bg-[rgba(5,5,6,0.7)] border border-[rgba(110,118,220,0.18)] rounded-xl px-4 py-3 text-sm text-[#ededef] outline-none" placeholder={tx('topic_desc')} value={newDesc} onChange={(e: any) => setNewDesc(e.target.value)} />
          <button onClick={onCreateTopic} disabled={creating || !newTitle.trim()} className="w-full py-3 rounded-xl font-bold text-sm text-[#020203] disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #7b85e8, #5e6ad2)' }}>
            {creating ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : tx('create')}
          </button>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="glass p-8 text-center text-[#8a8f98] text-sm">{tx('no_topics')}</div>
      ) : topics.map((t: Topic) => (
        <div key={t.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${t.status === 'active' ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' : 'bg-[rgba(138,143,152,0.15)] text-[#8a8f98]'}`}>{tx(t.status === 'active' ? 'active' : 'closed')}</span>
                <span className="text-[10px] text-[#8a8f98]">{t.opinion_count} {tx('opinions')}</span>
              </div>
              <div className="text-sm font-bold text-[#ededef]">{t.title}</div>
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
              className="w-full mt-2 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#020203] disabled:opacity-50"
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
    rejected: 'bg-[rgba(138,143,152,0.15)] text-[#8a8f98]',
  };
  if (drafts.length === 0) return <div className="glass p-8 text-center text-[#8a8f98] text-sm">{tx('no_drafts')}</div>;
  return (
    <div className="flex flex-col gap-3">
      {drafts.map((d: Draft) => (
        <div key={d.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${statusColor[d.status] || ''}`}>{tx(d.status)}</span>
                <span className="text-[10px] text-[#8a8f98]">{d.source_count} {tx('sources')}</span>
              </div>
              <div className="text-sm font-bold text-[#ededef]">🎙 {d.main_topic}</div>
              {d.script_preview && <div className="text-[11px] text-[#8a8f98] mt-1 line-clamp-2">{d.script_preview.replace(/^\[META:.*?\]\n\n/, '')}</div>}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onView(d.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[rgba(94,106,210,0.08)] text-[#5e6ad2] flex items-center justify-center gap-1">
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
            <div className="text-base font-bold text-[#5e6ad2]">🎙 {draft.main_topic}</div>
            <button onClick={onClose}><X className="w-5 h-5 text-[#8a8f98]" /></button>
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
                      <span className="text-[10px] text-[#8a8f98]">{p.percent}%</span>
                    </div>
                    <div className="text-[12px] text-[#ededef]">{p.summary}</div>
                  </div>
                );
              })}
            </div>
          )}
          {meta.music_suggestion && (
            <div className="text-[11px] text-[#8a8f98]">🎵 {tx('music')}: {meta.music_suggestion}</div>
          )}

          {/* Dialog matni */}
          <div>
            <div className="text-[11px] font-bold text-[#5e6ad2] uppercase tracking-wide mb-2">{tx('dialog_title')} · {wordCount} {tx('words')}</div>
            <div className="text-[12px] text-[#9a9fa8] leading-relaxed whitespace-pre-line max-h-[40vh] overflow-y-auto rounded-xl p-3" style={{ background: 'rgba(5,5,6,0.5)' }}>
              {dialog}
            </div>
          </div>

          {/* Tugmalar */}
          {draft.status === 'pending' && (
            <div className="flex gap-3">
              <button onClick={() => onApprove(draft.id)} className="flex-1 py-3 rounded-xl font-bold text-sm text-[#020203] flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #22c55e, #5e6ad2)' }}>
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

// ── SlotsTab — Efir jadvali boshqaruvi ──────────────────────
function SlotsTab({ slots, users, onReload, flash }: any) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    host_user_id: '',
    title: '',
    description: '',
    scheduled_at: '',
    duration_min: '60',
  });

  const statusColors: Record<string, string> = {
    scheduled: 'bg-[rgba(94,106,210,0.1)] text-[#5e6ad2]',
    live:       'bg-[rgba(239,68,68,0.15)] text-[#ef4444]',
    done:       'bg-[rgba(34,197,94,0.1)] text-[#22c55e]',
    cancelled:  'bg-[rgba(138,143,152,0.1)] text-[#8a8f98]',
  };

  async function handleCreate() {
    if (!form.title.trim() || !form.host_user_id || !form.scheduled_at) return;
    setCreating(true);
    try {
      const res = await adminCreateSlot({
        host_user_id: parseInt(form.host_user_id),
        title: form.title.trim(),
        description: form.description.trim(),
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_min: parseInt(form.duration_min) || 60,
      });
      flash(`✅ Slot #${res.detail?.slot_id} yaratildi`);
      setShowCreate(false);
      setForm({ host_user_id: '', title: '', description: '', scheduled_at: '', duration_min: '60' });
      onReload();
    } catch (e: any) { flash('❌ ' + e.message); }
    finally { setCreating(false); }
  }

  async function handleStatus(id: number, status: string) {
    try { await adminUpdateSlotStatus(id, status); flash('✅'); onReload(); }
    catch { flash('❌'); }
  }

  const trustedUsers = users.filter((u: any) => ['doverenniy', 'admin'].includes(u.role));

  return (
    <div className="flex flex-col gap-3">
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)}
          className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#5e6ad2] active:scale-[0.98]">
          <Plus className="w-4 h-4" /> Новый слот эфира
        </button>
      ) : (
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#5e6ad2]">Новый слот</span>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-[#8a8f98]" /></button>
          </div>
          {/* Ведущий tanlash */}
          <select
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
            style={{ background: 'rgba(5,5,6,0.7)', border: '1px solid rgba(110,118,220,0.18)' }}
            value={form.host_user_id}
            onChange={e => setForm(f => ({ ...f, host_user_id: e.target.value }))}
          >
            <option value="">Выбрать ведущего (уровень 3)...</option>
            {trustedUsers.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.display_name || u.username || `ID ${u.telegram_id}`} — {u.role}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
            style={{ background: 'rgba(5,5,6,0.7)', border: '1px solid rgba(110,118,220,0.18)' }}
            placeholder="Название эфира"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <input
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
            style={{ background: 'rgba(5,5,6,0.7)', border: '1px solid rgba(110,118,220,0.18)' }}
            placeholder="Описание (необязательно)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-[#8a8f98] mb-1">Дата и время</div>
              <input
                type="datetime-local"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
                style={{ background: 'rgba(5,5,6,0.7)', border: '1px solid rgba(110,118,220,0.18)' }}
                value={form.scheduled_at}
                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              />
            </div>
            <div className="w-24">
              <div className="text-[10px] text-[#8a8f98] mb-1">Длит. (мин)</div>
              <input
                type="number"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
                style={{ background: 'rgba(5,5,6,0.7)', border: '1px solid rgba(110,118,220,0.18)' }}
                value={form.duration_min}
                onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
              />
            </div>
          </div>
          <div className="text-[10px] text-[#8a8f98] text-center">
            Со счёта ведущего спишется ≈ {((parseInt(form.duration_min) || 60) / 60 * 200).toFixed(0)} поинтов за слот
          </div>
          <button onClick={handleCreate} disabled={creating || !form.title.trim() || !form.host_user_id || !form.scheduled_at}
            className="w-full py-3 rounded-xl font-bold text-sm text-[#020203] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7b85e8, #5e6ad2)' }}>
            {creating ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Создать слот'}
          </button>
        </div>
      )}

      {slots.length === 0 ? (
        <div className="glass p-8 text-center text-[#8a8f98] text-sm">Нет слотов эфира</div>
      ) : slots.map((s: BroadcastSlot) => (
        <div key={s.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${statusColors[s.status] || ''}`}>
                  {s.is_live_now ? '🔴 LIVE' : s.status}
                </span>
                <span className="text-[10px] text-[#8a8f98]">{s.duration_min} мин</span>
              </div>
              <div className="text-sm font-bold text-[#ededef]">{s.title}</div>
              {s.display_name || s.username ? (
                <div className="text-[11px] text-[#8a8f98] mt-0.5">
                  📻 {s.display_name || s.username}
                </div>
              ) : null}
              <div className="text-[10px] text-[#8a8f98] mt-0.5">
                🕐 {new Date(s.scheduled_at).toLocaleString()}
              </div>
            </div>
          </div>
          {/* Status tugmalari */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {s.status === 'scheduled' && (
              <button onClick={() => handleStatus(s.id, 'live')}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[rgba(239,68,68,0.15)] text-[#ef4444]">
                ▶ Live
              </button>
            )}
            {s.status === 'live' && (
              <button onClick={() => handleStatus(s.id, 'done')}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[rgba(34,197,94,0.15)] text-[#22c55e]">
                ✓ Завершить
              </button>
            )}
            {['scheduled', 'live'].includes(s.status) && (
              <button onClick={() => handleStatus(s.id, 'cancelled')}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[rgba(255,77,109,0.08)] text-[#ff9fb0]">
                ✕ Отменить
              </button>
            )}
            {s.share_url && (
              <a href={s.share_url} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[rgba(94,106,210,0.08)] text-[#5e6ad2]">
                🔗 Ссылка
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MusicTab — musiqa nomzodlari va ovoz berish natijalari ──
function MusicTab({ topics, tx, flash }: any) {
  const [topicId, setTopicId] = useState<number | null>(null);
  const [noms, setNoms] = useState<MusicNomination[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (topics.length === 0) return;
    if (topicId && topics.some((t: Topic) => t.id === topicId)) return;
    const active = topics.find((t: Topic) => t.status === 'active');
    setTopicId((active || topics[0]).id);
  }, [topics]);

  useEffect(() => { if (topicId) loadNoms(topicId); }, [topicId]);

  async function loadNoms(id: number) {
    setLoading(true);
    try { setNoms(await getMusicNominations(id)); }
    catch { setNoms([]); }
    finally { setLoading(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(tx('confirm_delete_nom'))) return;
    try { await adminDeleteNomination(id); flash('✅'); if (topicId) await loadNoms(topicId); }
    catch { flash('❌'); }
  }

  if (topics.length === 0) return <div className="glass p-8 text-center text-[#8a8f98] text-sm">{tx('no_topics')}</div>;

  return (
    <div className="flex flex-col gap-3">
      <select
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#ededef]"
        style={{ background: 'rgba(5,5,6,0.7)', border: '1px solid rgba(110,118,220,0.18)' }}
        value={topicId ?? ''}
        onChange={e => setTopicId(parseInt(e.target.value))}
      >
        {topics.map((t: Topic) => (
          <option key={t.id} value={t.id}>{t.status === 'active' ? '🟢' : '⚪️'} {t.title}</option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-8"><Loader className="w-6 h-6 text-[#5e6ad2] animate-spin" /></div>
      ) : noms.length === 0 ? (
        <div className="glass p-8 text-center text-[#8a8f98] text-sm">{tx('no_nominations')}</div>
      ) : noms.map((n, i) => (
        <div key={n.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {i === 0 && n.vote_count > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase bg-[rgba(34,197,94,0.15)] text-[#22c55e]">🎧 {tx('winner_label')}</span>
                )}
                <span className="text-[10px] text-[#8a8f98]">{n.vote_count} {tx('votes')}</span>
              </div>
              <div className="text-sm font-bold text-[#ededef] truncate">🎵 {n.title}</div>
              {n.artist && <div className="text-[11px] text-[#8a8f98]">{n.artist}</div>}
              <div className="text-[10px] text-[#8a8f98] mt-0.5">{n.display_name || n.username || '—'}</div>
            </div>
            <button onClick={() => handleDelete(n.id)} className="p-2 rounded-lg bg-[rgba(255,77,109,0.1)] text-[#ff9fb0] shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── UsersTab ─────────────────────────────────────────────────
function UsersTab({ users, tx, onSetLevel, onAddPoints }: any) {
  const roleColor: Record<string, string> = {
    admin:      'text-[#f59e0b]',
    doverenniy: 'text-[#a78bfa]',
    aktivniy:   'text-[#5e6ad2]',
    listener:   'text-[#8a8f98]',
  };
  if (users.length === 0) return (
    <div className="glass p-8 text-center text-[#8a8f98] text-sm">{tx('no_users')}</div>
  );
  return (
    <div className="flex flex-col gap-2">
      {users.map((u: any) => (
        <div key={u.id} className="glass rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#ededef] truncate">
                {u.display_name || u.username || `ID ${u.telegram_id}`}
              </div>
              <div className="text-[10px] text-[#8a8f98]">
                <span className={`font-semibold ${roleColor[u.role] || 'text-[#8a8f98]'}`}>{u.role}</span>
                {' · '}{Number(u.points).toFixed(3)} pts
              </div>
            </div>
            <button onClick={() => onAddPoints(u.id)}
              className="ml-2 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-[rgba(94,106,210,0.1)] text-[#5e6ad2]">
              +pts
            </button>
          </div>
          {/* Level tugmalari */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map(lvl => (
              <button key={lvl} onClick={() => onSetLevel(u.id, lvl)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                  u.level === lvl
                    ? 'bg-gradient-to-r from-[#7b85e8] to-[#5e6ad2] text-[#020203]'
                    : 'glass text-[#8a8f98]'
                }`}>
                {tx(`lvl${lvl}`)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
