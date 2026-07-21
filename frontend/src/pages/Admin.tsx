import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, X, Users, MessageSquare, Lock, Loader, Sparkles, CheckCircle, XCircle, Calendar, Music, ArrowLeft, Mic, CreditCard, Trash2 } from 'lucide-react';
import {
  adminCreateTopic, adminGetTopics, adminCloseTopic,
  getUsers, adminSetLevel, adminAddPoints,
  adminCreateSlot, getAllSlots, adminUpdateSlotStatus,
  getMusicNominations, adminDeleteNomination,
  adminGetPaymentSettings, adminUpdatePaymentSettings,
  adminListPackages, adminCreatePackage, adminUpdatePackage, adminDeletePackage,
  type BroadcastSlot, type MusicNomination,
} from '../lib/api';
import { authHeaders, getToken } from '../lib/auth';
import { API_URL } from '../lib/config';
import { getLang } from '../lib/i18n';
import type { PaymentSettings, AdminPackage } from '../types';

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
interface CastingApp {
  id: number; user_id: number; username: string | null; display_name: string | null;
  audio_url: string; note: string; status: string; admin_note: string;
  created_at: string; decided_at: string | null;
}

const L: Record<string, Record<string, string>> = {
  ru: {
    title: 'ADMIN PANEL', topics_tab: 'Темы', users_tab: 'Доступ', drafts_tab: 'Эфир', slots_tab: 'Слоты', music_tab: 'Музыка', casting_tab: 'Кастинг',
    no_casting: 'Нет заявок', casting_approve: 'Одобрить → Доверенный', casting_reject: 'Отклонить',
    casting_note_placeholder: 'Комментарий (необязательно)...',
    new_topic: 'Новая тема', topic_title: 'Название темы', topic_desc: 'Описание',
    create: 'Создать', close: 'Закрыть', active: 'Активна', closed: 'Закрыта',
    opinions: 'мнений', no_topics: 'Нет тем', no_users: 'Нет пользователей',
    add_pts: 'Поинты', lvl1: '1', lvl2: '2', lvl3: '3',
    level_label: 'Уровень', access_legend_title: 'Уровни доступа',
    lvl1_desc: '1 — слушает эфир и чат', lvl2_desc: '2 — пишет в чат, переводит поинты',
    lvl3_desc: '3 — доступ к микрофону (эфир)',
    aggregate: 'Создать диалог', no_drafts: 'Нет черновиков эфира',
    pending: 'Ожидает', approved: 'В эфире', rejected: 'Отклонён',
    approve: 'Одобрить → Эфир', reject: 'Отклонить', view: 'Смотреть',
    dialog_title: 'Диалог', positions: 'Позиции слушателей', music: 'Музыка',
    sources: 'источников', words: 'слов',
    no_nominations: 'Нет предложенных треков', votes: 'голосов', winner_label: 'Играет в эфире',
    confirm_delete_nom: 'Удалить этот трек из голосования?',
    payment_tab: 'Оплата', payment_method_title: 'Способ оплаты поинтов',
    payment_stars: '⭐ Telegram Stars', payment_stars_desc: 'Автоматическая покупка через бота (Telegram Payments)',
    payment_manual: '✉️ Вручную', payment_manual_desc: 'Кнопка «Купить» покажет пользователю ваши инструкции/контакт',
    payment_instructions_label: 'Инструкция для пользователя (если «Вручную»)',
    payment_instructions_placeholder: 'Например: напишите @admin_username, чтобы купить поинты картой или переводом',
    save: 'Сохранить', saved: 'Сохранено', packages_title: 'Пакеты поинтов',
    package_label: 'Название', package_points: 'Поинты', package_price: 'Цена €',
    package_active: 'Активен', package_add: 'Добавить пакет', package_delete: 'Удалить пакет?',
    no_packages: 'Нет пакетов',
    add_pts_title: 'Управление поинтами', add_pts_to: 'Кому', amount: 'Количество',
    add_pts_submit: 'Начислить', add_pts_hint: 'Баланс админа не меняется — поинты берутся не с вашего счёта',
    mode_add: 'Начислить', mode_deduct: 'Списать', deduct_pts_submit: 'Списать',
    cancel: 'Отмена', confirm: 'Подтвердить', confirm_delete_title: 'Подтверждение',
  },
  en: {
    title: 'ADMIN PANEL', topics_tab: 'Topics', users_tab: 'Access', drafts_tab: 'Broadcast', slots_tab: 'Slots', music_tab: 'Music', casting_tab: 'Casting',
    no_casting: 'No applications', casting_approve: 'Approve → Trusted', casting_reject: 'Reject',
    casting_note_placeholder: 'Note (optional)...',
    new_topic: 'New topic', topic_title: 'Topic title', topic_desc: 'Description',
    create: 'Create', close: 'Close', active: 'Active', closed: 'Closed',
    opinions: 'opinions', no_topics: 'No topics', no_users: 'No users',
    add_pts: 'Points', lvl1: '1', lvl2: '2', lvl3: '3',
    level_label: 'Level', access_legend_title: 'Access levels',
    lvl1_desc: '1 — listens to broadcast and chat', lvl2_desc: '2 — writes in chat, transfers points',
    lvl3_desc: '3 — microphone access (broadcast)',
    aggregate: 'Create dialog', no_drafts: 'No broadcast drafts',
    pending: 'Pending', approved: 'On air', rejected: 'Rejected',
    approve: 'Approve → Air', reject: 'Reject', view: 'View',
    dialog_title: 'Dialog', positions: 'Listener positions', music: 'Music',
    sources: 'sources', words: 'words',
    no_nominations: 'No track suggestions', votes: 'votes', winner_label: 'On air',
    confirm_delete_nom: 'Remove this track from voting?',
    payment_tab: 'Payment', payment_method_title: 'Points payment method',
    payment_stars: '⭐ Telegram Stars', payment_stars_desc: 'Automatic purchase via bot (Telegram Payments)',
    payment_manual: '✉️ Manual', payment_manual_desc: 'The "Buy" button will show your instructions/contact to users',
    payment_instructions_label: 'Instructions for users (if "Manual")',
    payment_instructions_placeholder: 'e.g. message @admin_username to buy points by card or transfer',
    save: 'Save', saved: 'Saved', packages_title: 'Point packages',
    package_label: 'Label', package_points: 'Points', package_price: 'Price €',
    package_active: 'Active', package_add: 'Add package', package_delete: 'Delete package?',
    no_packages: 'No packages',
    add_pts_title: 'Manage points', add_pts_to: 'To', amount: 'Amount',
    add_pts_submit: 'Add', add_pts_hint: "Your own balance is untouched — points aren't taken from your account",
    mode_add: 'Add', mode_deduct: 'Deduct', deduct_pts_submit: 'Deduct',
    cancel: 'Cancel', confirm: 'Confirm', confirm_delete_title: 'Confirm',
  },
  lt: {
    title: 'ADMIN PANEL', topics_tab: 'Temos', users_tab: 'Prieiga', drafts_tab: 'Eteris', slots_tab: 'Slotai', music_tab: 'Muzika', casting_tab: 'Atranka',
    no_casting: 'Nėra paraiškų', casting_approve: 'Patvirtinti → Patikimas', casting_reject: 'Atmesti',
    casting_note_placeholder: 'Komentaras (neprivalomas)...',
    new_topic: 'Nauja tema', topic_title: 'Temos pavadinimas', topic_desc: 'Aprašymas',
    create: 'Sukurti', close: 'Uždaryti', active: 'Aktyvi', closed: 'Uždaryta',
    opinions: 'nuomonių', no_topics: 'Nėra temų', no_users: 'Nėra vartotojų',
    add_pts: 'Taškai', lvl1: '1', lvl2: '2', lvl3: '3',
    level_label: 'Lygis', access_legend_title: 'Prieigos lygiai',
    lvl1_desc: '1 — klauso eterio ir pokalbio', lvl2_desc: '2 — rašo pokalbyje, perveda taškus',
    lvl3_desc: '3 — mikrofono prieiga (eteris)',
    aggregate: 'Sukurti dialogą', no_drafts: 'Nėra eterio juodraščių',
    pending: 'Laukia', approved: 'Eteryje', rejected: 'Atmesta',
    approve: 'Patvirtinti → Eterį', reject: 'Atmesti', view: 'Žiūrėti',
    dialog_title: 'Dialogas', positions: 'Klausytojų pozicijos', music: 'Muzika',
    sources: 'šaltinių', words: 'žodžių',
    no_nominations: 'Nėra pasiūlytų dainų', votes: 'balsų', winner_label: 'Eteryje',
    confirm_delete_nom: 'Pašalinti šią dainą iš balsavimo?',
    payment_tab: 'Mokėjimas', payment_method_title: 'Taškų mokėjimo būdas',
    payment_stars: '⭐ Telegram Stars', payment_stars_desc: 'Automatinis pirkimas per botą (Telegram Payments)',
    payment_manual: '✉️ Rankiniu būdu', payment_manual_desc: 'Mygtukas „Pirkti“ parodys vartotojui jūsų instrukcijas/kontaktą',
    payment_instructions_label: 'Instrukcija vartotojui (jei „Rankiniu būdu“)',
    payment_instructions_placeholder: 'Pvz.: rašykite @admin_username, kad nusipirktumėte taškų kortele ar pervedimu',
    save: 'Išsaugoti', saved: 'Išsaugota', packages_title: 'Taškų paketai',
    package_label: 'Pavadinimas', package_points: 'Taškai', package_price: 'Kaina €',
    package_active: 'Aktyvus', package_add: 'Pridėti paketą', package_delete: 'Ištrinti paketą?',
    no_packages: 'Nėra paketų',
    add_pts_title: 'Taškų valdymas', add_pts_to: 'Kam', amount: 'Kiekis',
    add_pts_submit: 'Pridėti', add_pts_hint: 'Jūsų balansas nekeičiamas — taškai neimami iš jūsų sąskaitos',
    mode_add: 'Pridėti', mode_deduct: 'Nurašyti', deduct_pts_submit: 'Nurašyti',
    cancel: 'Atšaukti', confirm: 'Patvirtinti', confirm_delete_title: 'Patvirtinimas',
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
async function adminGetCasting(status: string): Promise<CastingApp[]> {
  const r = await fetch(`${API_URL}/casting/admin/list?status=${status}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function adminApproveCasting(id: number, adminNote: string) {
  const r = await fetch(`${API_URL}/casting/admin/${id}/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ admin_note: adminNote }),
  });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function adminRejectCasting(id: number, adminNote: string) {
  const r = await fetch(`${API_URL}/casting/admin/${id}/reject`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ admin_note: adminNote }),
  });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

export function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const [tab, setTab] = useState<'topics' | 'users' | 'drafts' | 'slots' | 'music' | 'casting' | 'payment'>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [slots, setSlots] = useState<BroadcastSlot[]>([]);
  const [castingApps, setCastingApps] = useState<CastingApp[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [addPointsTarget, setAddPointsTarget] = useState<UserRow | null>(null);
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
      else if (tab === 'casting') setCastingApps(await adminGetCasting('pending'));
      else if (tab === 'payment') {
        setPaymentSettings(await adminGetPaymentSettings());
        setPackages(await adminListPackages());
      }
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

  function handleBack() {
    // /admin har doim faqat Profil tabidan ochiladi — shuning uchun orqaga
    // qaytishda o'sha tabga qaytamiz (navigate(-1) Radio'ni remount qilib,
    // tab holatini 'anons'ga tushirib yuborardi).
    const from = (location.state as { from?: string } | null)?.from;
    navigate('/radio', { replace: true, state: { screen: from || 'profile' } });
  }

  return (
    <div
      className="bg-[#0F0F23] text-[#F8FAFC] overflow-y-auto overscroll-contain"
      style={{ height: 'var(--app-vh)', WebkitOverflowScrolling: 'touch' }}
    >
      <div className="max-w-[520px] mx-auto px-3.5 pb-6 flex flex-col gap-4">
        {/* Telegram'ning o'z native "⋮ ⌄ ✕" paneli tepada bo'lgani uchun,
            orqaga tugmasi shu bilan to'qnashib bosilmay qolmasin. */}
        <header className="flex items-center gap-3" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top))' }}>
          <button onClick={handleBack} aria-label="Назад" className="glass w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-[0.92] transition-transform duration-150">
            <ArrowLeft className="w-4.5 h-4.5 text-[#F8FAFC]" />
          </button>
          <div className="min-w-0">
            <div className="text-[20px] font-extrabold tracking-[3px] logo-gradient leading-tight truncate">INTRA GROUP</div>
            <div className="text-[9px] tracking-[4px] text-[#94A3B8] mt-1 font-semibold">{tx('title')}</div>
          </div>
        </header>

        {/* Tabs — gorizontal skroll bo'ladigan pill-lar */}
        <div
          className="flex gap-2 overflow-x-auto -mx-3.5 px-3.5"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {([['topics', MessageSquare, tx('topics_tab')], ['drafts', Sparkles, tx('drafts_tab')], ['casting', Mic, tx('casting_tab')], ['slots', Calendar, tx('slots_tab')], ['music', Music, tx('music_tab')], ['users', Users, tx('users_tab')], ['payment', CreditCard, tx('payment_tab')]] as const).map(([t, Icon, label]) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t as any)}
                className={`shrink-0 flex items-center gap-1.5 py-2.5 px-4 rounded-full border font-bold text-[11px] transition-all duration-200 active:scale-[0.95] ${
                  active ? 'text-[#1B1204] border-transparent' : 'glass text-[#94A3B8] border-[rgba(249,115,22,0.14)]'
                }`}
                style={active ? { background: 'linear-gradient(135deg, #FB923C, #F97316)', boxShadow: '0 4px 18px rgba(249,115,22,0.45)' } : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader className="w-8 h-8 text-[#F97316] animate-spin" /></div>
        ) : tab === 'topics' ? (
          <TopicsTab topics={topics} tx={tx} showCreate={showCreate} setShowCreate={setShowCreate}
            newTitle={newTitle} setNewTitle={setNewTitle} newDesc={newDesc} setNewDesc={setNewDesc}
            creating={creating} aggregating={aggregating}
            onCreateTopic={handleCreateTopic}
            onCloseTopic={async (id: number) => { try { await adminCloseTopic(id); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onAggregate={handleAggregate} />
        ) : tab === 'drafts' ? (
          <DraftsTab drafts={drafts} tx={tx} onView={handleViewDraft} onApprove={handleApproveDraft} onReject={handleRejectDraft} />
        ) : tab === 'casting' ? (
          <CastingTab apps={castingApps} tx={tx}
            onApprove={async (id: number, note: string) => { try { await adminApproveCasting(id, note); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onReject={async (id: number, note: string) => { try { await adminRejectCasting(id, note); flash('✅'); await loadData(); } catch { flash('❌'); } }} />
        ) : tab === 'slots' ? (
          <SlotsTab slots={slots} users={users} onReload={loadData} flash={flash} />
        ) : tab === 'music' ? (
          <MusicTab topics={topics} tx={tx} flash={flash} />
        ) : tab === 'payment' ? (
          <PaymentTab tx={tx} settings={paymentSettings} packages={packages} flash={flash} onReload={loadData} />
        ) : (
          <UsersTab users={users} tx={tx}
            onSetLevel={async (id: number, lvl: number) => { try { await adminSetLevel(id, lvl); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onAddPoints={(u: UserRow) => setAddPointsTarget(u)} />
        )}
      </div>

      {/* Poinт berish modali — admin xohlagan foydalanuvchiga, xohlagan
          vaqtda, xohlagan miqdorda point qo'sha oladi (native prompt()
          Telegram Mini App'da ishlamasligi mumkin edi). */}
      {addPointsTarget && (
        <AddPointsModal
          user={addPointsTarget}
          tx={tx}
          onClose={() => setAddPointsTarget(null)}
          onSubmit={async (amount: number) => {
            try {
              await adminAddPoints(addPointsTarget.id, amount);
              flash('✅');
              setAddPointsTarget(null);
              await loadData();
            } catch { flash('❌'); }
          }}
        />
      )}

      {/* Draft ko'rish modal */}
      {activeDraft && (
        <DraftModal draft={activeDraft} tx={tx} onClose={() => setActiveDraft(null)}
          onApprove={handleApproveDraft} onReject={handleRejectDraft} />
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-xl text-sm text-[#F8FAFC] border border-[rgba(249,115,22,0.4)] z-[200]">
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
        <button onClick={() => setShowCreate(true)} className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#F97316] active:scale-[0.98]">
          <Plus className="w-4 h-4" /> {tx('new_topic')}
        </button>
      ) : (
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#F97316]">{tx('new_topic')}</span>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-[#94A3B8]" /></button>
          </div>
          <input className="w-full bg-[rgba(15,15,35,0.7)] border border-[rgba(249,115,22,0.18)] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] outline-none" placeholder={tx('topic_title')} value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} />
          <input className="w-full bg-[rgba(15,15,35,0.7)] border border-[rgba(249,115,22,0.18)] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] outline-none" placeholder={tx('topic_desc')} value={newDesc} onChange={(e: any) => setNewDesc(e.target.value)} />
          <button onClick={onCreateTopic} disabled={creating || !newTitle.trim()} className="w-full py-3 rounded-xl font-bold text-sm text-[#1B1204] disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}>
            {creating ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : tx('create')}
          </button>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="glass p-8 text-center text-[#94A3B8] text-sm">{tx('no_topics')}</div>
      ) : topics.map((t: Topic) => (
        <div key={t.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${t.status === 'active' ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' : 'bg-[rgba(138,143,152,0.15)] text-[#94A3B8]'}`}>{tx(t.status === 'active' ? 'active' : 'closed')}</span>
                <span className="text-[10px] text-[#94A3B8]">{t.opinion_count} {tx('opinions')}</span>
              </div>
              <div className="text-sm font-bold text-[#F8FAFC]">{t.title}</div>
            </div>
            {t.status === 'active' && (
              <button onClick={() => onCloseTopic(t.id)} className="ml-2 p-2 rounded-lg bg-[rgba(239,68,68,0.1)] text-[#FCA5A5]">
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Agregatsiya tugmasi — fikr bo'lsa ko'rinadi */}
          {t.opinion_count >= 3 && (
            <button onClick={() => onAggregate(t.id)} disabled={aggregating === t.id}
              className="w-full mt-2 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#1B1204] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>
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
    pending: 'bg-[rgba(234,179,8,0.15)] text-[#EAB308]',
    approved: 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]',
    rejected: 'bg-[rgba(138,143,152,0.15)] text-[#94A3B8]',
  };
  if (drafts.length === 0) return <div className="glass p-8 text-center text-[#94A3B8] text-sm">{tx('no_drafts')}</div>;
  return (
    <div className="flex flex-col gap-3">
      {drafts.map((d: Draft) => (
        <div key={d.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${statusColor[d.status] || ''}`}>{tx(d.status)}</span>
                <span className="text-[10px] text-[#94A3B8]">{d.source_count} {tx('sources')}</span>
              </div>
              <div className="text-sm font-bold text-[#F8FAFC]">🎙 {d.main_topic}</div>
              {d.script_preview && <div className="text-[11px] text-[#94A3B8] mt-1 line-clamp-2">{d.script_preview.replace(/^\[META:.*?\]\n\n/, '')}</div>}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onView(d.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[rgba(249,115,22,0.08)] text-[#F97316] flex items-center justify-center gap-1">
              👁 {tx('view')}
            </button>
            {d.status === 'pending' && <>
              <button onClick={() => onApprove(d.id)} className="flex-1 py-2 rounded-xl text-xs font-bold bg-[rgba(34,197,94,0.15)] text-[#22c55e] flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {tx('approve')}
              </button>
              <button onClick={() => onReject(d.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[rgba(239,68,68,0.1)] text-[#FCA5A5] flex items-center justify-center gap-1">
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
            <div className="text-base font-bold text-[#F97316]">🎙 {draft.main_topic}</div>
            <button onClick={onClose}><X className="w-5 h-5 text-[#94A3B8]" /></button>
          </div>

          {/* META: pozitsiyalar */}
          {meta.positions && (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-bold text-[#a78bfa] uppercase tracking-wide">{tx('positions')}</div>
              {[1,2,3].map(i => {
                const p = meta.positions[`p${i}`];
                if (!p) return null;
                return (
                  <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-[#a78bfa]">#{i}</span>
                      <span className="text-[10px] text-[#94A3B8]">{p.percent}%</span>
                    </div>
                    <div className="text-[12px] text-[#F8FAFC]">{p.summary}</div>
                  </div>
                );
              })}
            </div>
          )}
          {meta.music_suggestion && (
            <div className="text-[11px] text-[#94A3B8]">🎵 {tx('music')}: {meta.music_suggestion}</div>
          )}

          {/* Dialog matni */}
          <div>
            <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wide mb-2">{tx('dialog_title')} · {wordCount} {tx('words')}</div>
            <div className="text-[12px] text-[#94A3B8] leading-relaxed whitespace-pre-line max-h-[40vh] overflow-y-auto rounded-xl p-3" style={{ background: 'rgba(15,15,35,0.5)' }}>
              {dialog}
            </div>
          </div>

          {/* Tugmalar */}
          {draft.status === 'pending' && (
            <div className="flex gap-3">
              <button onClick={() => onApprove(draft.id)} className="flex-1 py-3 rounded-xl font-bold text-sm text-[#1B1204] flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #22c55e, #F97316)' }}>
                <CheckCircle className="w-4 h-4" /> {tx('approve')}
              </button>
              <button onClick={() => onReject(draft.id)} className="flex-1 py-3 rounded-xl font-semibold text-sm text-[#FCA5A5] bg-[rgba(239,68,68,0.1)] flex items-center justify-center gap-2">
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
function CastingTab({ apps, tx, onApprove, onReject }: any) {
  const [noteById, setNoteById] = useState<Record<number, string>>({});
  if (apps.length === 0) return <div className="glass p-8 text-center text-[#94A3B8] text-sm">{tx('no_casting')}</div>;
  return (
    <div className="flex flex-col gap-3">
      {apps.map((a: CastingApp) => (
        <div key={a.id} className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(249,115,22,0.15)' }}>
              <Mic className="w-4 h-4 text-[#F97316]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#F8FAFC] truncate">
                {a.display_name || a.username || `id${a.user_id}`}
              </div>
              <div className="text-[10px] text-[#94A3B8]">{new Date(a.created_at).toLocaleString()}</div>
            </div>
          </div>

          <audio controls src={`${API_URL}${a.audio_url}?token=${getToken()}`} className="w-full h-9" />

          {a.note && (
            <div className="text-[11px] text-[#94A3B8] bg-[rgba(15,15,35,0.4)] rounded-xl p-3 leading-relaxed">
              {a.note}
            </div>
          )}

          <input
            value={noteById[a.id] ?? ''}
            onChange={(e) => setNoteById((prev) => ({ ...prev, [a.id]: e.target.value }))}
            placeholder={tx('casting_note_placeholder')}
            className="w-full bg-[rgba(15,15,35,0.6)] border border-[rgba(249,115,22,0.2)] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => onApprove(a.id, noteById[a.id] || '')}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[rgba(34,197,94,0.15)] text-[#22c55e] flex items-center justify-center gap-1"
            >
              <CheckCircle className="w-3.5 h-3.5" /> {tx('casting_approve')}
            </button>
            <button
              onClick={() => onReject(a.id, noteById[a.id] || '')}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[rgba(239,68,68,0.1)] text-[#FCA5A5] flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> {tx('casting_reject')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

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
    scheduled: 'bg-[rgba(249,115,22,0.1)] text-[#F97316]',
    live:       'bg-[rgba(239,68,68,0.15)] text-[#ef4444]',
    done:       'bg-[rgba(34,197,94,0.1)] text-[#22c55e]',
    cancelled:  'bg-[rgba(138,143,152,0.1)] text-[#94A3B8]',
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
          className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-[#F97316] active:scale-[0.98]">
          <Plus className="w-4 h-4" /> Новый слот эфира
        </button>
      ) : (
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#F97316]">Новый слот</span>
            <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-[#94A3B8]" /></button>
          </div>
          {/* Ведущий tanlash */}
          <select
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#F8FAFC]"
            style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
            value={form.host_user_id}
            onChange={e => setForm(f => ({ ...f, host_user_id: e.target.value }))}
          >
            <option value="">Выбрать ведущего (уровень 3)...</option>
            {trustedUsers.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.display_name || u.username || `ID ${u.telegram_id}`} — {u.role === 'admin' ? 'ADMIN' : `Уровень ${u.level}`}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#F8FAFC]"
            style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
            placeholder="Название эфира"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <input
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#F8FAFC]"
            style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
            placeholder="Описание (необязательно)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-[#94A3B8] mb-1">Дата и время</div>
              <input
                type="datetime-local"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#F8FAFC]"
                style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
                value={form.scheduled_at}
                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              />
            </div>
            <div className="w-24">
              <div className="text-[10px] text-[#94A3B8] mb-1">Длит. (мин)</div>
              <input
                type="number"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#F8FAFC]"
                style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
                value={form.duration_min}
                onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
              />
            </div>
          </div>
          <div className="text-[10px] text-[#94A3B8] text-center">
            Со счёта ведущего спишется ≈ {((parseInt(form.duration_min) || 60) / 60 * 200).toFixed(0)} поинтов за слот
          </div>
          <button onClick={handleCreate} disabled={creating || !form.title.trim() || !form.host_user_id || !form.scheduled_at}
            className="w-full py-3 rounded-xl font-bold text-sm text-[#1B1204] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}>
            {creating ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : 'Создать слот'}
          </button>
        </div>
      )}

      {slots.length === 0 ? (
        <div className="glass p-8 text-center text-[#94A3B8] text-sm">Нет слотов эфира</div>
      ) : slots.map((s: BroadcastSlot) => (
        <div key={s.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase ${statusColors[s.status] || ''}`}>
                  {s.is_live_now ? '🔴 LIVE' : s.status}
                </span>
                <span className="text-[10px] text-[#94A3B8]">{s.duration_min} мин</span>
              </div>
              <div className="text-sm font-bold text-[#F8FAFC]">{s.title}</div>
              {s.display_name || s.username ? (
                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                  📻 {s.display_name || s.username}
                </div>
              ) : null}
              <div className="text-[10px] text-[#94A3B8] mt-0.5">
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
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[rgba(239,68,68,0.08)] text-[#FCA5A5]">
                ✕ Отменить
              </button>
            )}
            {s.share_url && (
              <a href={s.share_url} target="_blank" rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[rgba(249,115,22,0.08)] text-[#F97316]">
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
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

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

  async function confirmDelete() {
    if (pendingDelete === null) return;
    const id = pendingDelete;
    setPendingDelete(null);
    try { await adminDeleteNomination(id); flash('✅'); if (topicId) await loadNoms(topicId); }
    catch { flash('❌'); }
  }

  if (topics.length === 0) return <div className="glass p-8 text-center text-[#94A3B8] text-sm">{tx('no_topics')}</div>;

  return (
    <div className="flex flex-col gap-3">
      <select
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-[#F8FAFC]"
        style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
        value={topicId ?? ''}
        onChange={e => setTopicId(parseInt(e.target.value))}
      >
        {topics.map((t: Topic) => (
          <option key={t.id} value={t.id}>{t.status === 'active' ? '🟢' : '⚪️'} {t.title}</option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-8"><Loader className="w-6 h-6 text-[#F97316] animate-spin" /></div>
      ) : noms.length === 0 ? (
        <div className="glass p-8 text-center text-[#94A3B8] text-sm">{tx('no_nominations')}</div>
      ) : noms.map((n, i) => (
        <div key={n.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {i === 0 && n.vote_count > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase bg-[rgba(34,197,94,0.15)] text-[#22c55e]">🎧 {tx('winner_label')}</span>
                )}
                <span className="text-[10px] text-[#94A3B8]">{n.vote_count} {tx('votes')}</span>
              </div>
              <div className="text-sm font-bold text-[#F8FAFC] truncate">🎵 {n.title}</div>
              {n.artist && <div className="text-[11px] text-[#94A3B8]">{n.artist}</div>}
              <div className="text-[10px] text-[#94A3B8] mt-0.5">{n.display_name || n.username || '—'}</div>
            </div>
            <button onClick={() => setPendingDelete(n.id)} className="p-2 rounded-lg bg-[rgba(239,68,68,0.1)] text-[#FCA5A5] shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {pendingDelete !== null && (
        <ConfirmModal
          tx={tx}
          message={tx('confirm_delete_nom')}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// ── UsersTab (контроль доступа — уровни 1/2/3) ────────────────
function UsersTab({ users, tx, onSetLevel, onAddPoints }: any) {
  if (users.length === 0) return (
    <div className="glass p-8 text-center text-[#94A3B8] text-sm">{tx('no_users')}</div>
  );
  return (
    <div className="flex flex-col gap-3">
      {/* Легенда уровней доступа */}
      <div className="glass rounded-2xl p-3.5">
        <div className="text-[10px] font-bold text-[#F97316] uppercase tracking-wide mb-1.5">{tx('access_legend_title')}</div>
        <div className="flex flex-col gap-0.5 text-[11px] text-[#94A3B8]">
          <div>{tx('lvl1_desc')}</div>
          <div>{tx('lvl2_desc')}</div>
          <div>{tx('lvl3_desc')}</div>
        </div>
      </div>

      {users.map((u: any) => (
        <div key={u.id} className="glass rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#F8FAFC] truncate">
                {u.display_name || u.username || `ID ${u.telegram_id}`}
                {u.role === 'admin' && <span className="ml-1.5 text-[10px] font-bold text-[#EAB308]">👑 ADMIN</span>}
              </div>
              <div className="text-[10px] text-[#94A3B8]">
                <span className="font-semibold text-[#F97316]">{tx('level_label')} {u.level}</span>
                {' · '}{Number(u.points).toFixed(3)} pts
              </div>
            </div>
            <button onClick={() => onAddPoints(u)}
              className="ml-2 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-[rgba(249,115,22,0.1)] text-[#F97316]">
              +pts
            </button>
          </div>
          {/* Level tugmalari — raqamli darajalar (1/2/3) */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map(lvl => (
              <button key={lvl} onClick={() => onSetLevel(u.id, lvl)}
                className={`flex-1 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                  u.level === lvl
                    ? 'bg-gradient-to-r from-[#FB923C] to-[#F97316] text-[#1B1204]'
                    : 'glass text-[#94A3B8]'
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

// ── PaymentTab — admin поинт оплатасини қандай ишлашини белгилайди ──
function PaymentTab({ tx, settings, packages, flash, onReload }: {
  tx: any; settings: PaymentSettings | null; packages: AdminPackage[];
  flash: (m: string) => void; onReload: () => Promise<void>;
}) {
  const [method, setMethod] = useState<'stars' | 'manual'>(settings?.method || 'stars');
  const [instructions, setInstructions] = useState(settings?.instructions || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMethod(settings?.method || 'stars');
    setInstructions(settings?.instructions || '');
  }, [settings]);

  async function saveSettings(newMethod?: 'stars' | 'manual') {
    setSaving(true);
    try {
      await adminUpdatePaymentSettings(newMethod || method, instructions);
      flash('✅ ' + tx('saved'));
      await onReload();
    } catch { flash('❌'); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl p-4">
        <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wide mb-3">{tx('payment_method_title')}</div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { setMethod('stars'); saveSettings('stars'); }}
            className="text-left rounded-xl p-3 border transition-all"
            style={method === 'stars'
              ? { borderColor: '#F97316', background: 'rgba(249,115,22,0.1)' }
              : { borderColor: 'rgba(249,115,22,0.14)' }}
          >
            <div className="text-sm font-bold text-[#F8FAFC]">{tx('payment_stars')}</div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">{tx('payment_stars_desc')}</div>
          </button>
          <button
            onClick={() => { setMethod('manual'); saveSettings('manual'); }}
            className="text-left rounded-xl p-3 border transition-all"
            style={method === 'manual'
              ? { borderColor: '#F97316', background: 'rgba(249,115,22,0.1)' }
              : { borderColor: 'rgba(249,115,22,0.14)' }}
          >
            <div className="text-sm font-bold text-[#F8FAFC]">{tx('payment_manual')}</div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">{tx('payment_manual_desc')}</div>
          </button>
        </div>

        {method === 'manual' && (
          <div className="mt-3">
            <label className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{tx('payment_instructions_label')}</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={tx('payment_instructions_placeholder')}
              rows={3}
              className="w-full mt-1.5 rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] outline-none resize-none"
              style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
            />
            <button
              onClick={() => saveSettings()}
              disabled={saving}
              className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold text-[#1B1204] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
            >
              {saving ? <Loader className="w-3.5 h-3.5 animate-spin mx-auto" /> : tx('save')}
            </button>
          </div>
        )}
      </div>

      <PackagesEditor tx={tx} packages={packages} flash={flash} onReload={onReload} />
    </div>
  );
}

// ── PackagesEditor — point пакетларини CRUD қилиш (нарх/миқдор/фаоллик) ──
function PackagesEditor({ tx, packages, flash, onReload }: {
  tx: any; packages: AdminPackage[]; flash: (m: string) => void; onReload: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: '', points_amount: '', price_eur: '' });
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  async function handleAdd() {
    const points = parseFloat(form.points_amount);
    const price = parseFloat(form.price_eur);
    if (!form.label.trim() || !points || !price) return;
    setCreating(true);
    try {
      await adminCreatePackage({ points_amount: points, price_eur: price, label: form.label.trim() });
      setForm({ label: '', points_amount: '', price_eur: '' });
      setShowAdd(false);
      flash('✅');
      await onReload();
    } catch { flash('❌'); }
    finally { setCreating(false); }
  }

  async function toggleActive(p: AdminPackage) {
    try {
      await adminUpdatePackage(p.id, {
        points_amount: p.points_amount, price_eur: p.price_eur, label: p.label, is_active: !p.is_active,
      });
      await onReload();
    } catch { flash('❌'); }
  }

  async function confirmDelete() {
    if (pendingDelete === null) return;
    const id = pendingDelete;
    setPendingDelete(null);
    try { await adminDeletePackage(id); flash('✅'); await onReload(); }
    catch { flash('❌'); }
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wide">{tx('packages_title')}</div>
        <button onClick={() => setShowAdd((s) => !s)} className="p-1.5 rounded-lg bg-[rgba(249,115,22,0.1)] text-[#F97316]">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showAdd && (
        <div className="flex flex-col gap-2 mb-3 p-3 rounded-xl" style={{ background: 'rgba(15,15,35,0.5)', border: '1px solid rgba(249,115,22,0.14)' }}>
          <input
            placeholder={tx('package_label')}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none"
            style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
          />
          <div className="flex gap-2">
            <input
              placeholder={tx('package_points')}
              value={form.points_amount}
              inputMode="decimal"
              onChange={(e) => setForm((f) => ({ ...f, points_amount: e.target.value }))}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none"
              style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
            />
            <input
              placeholder={tx('package_price')}
              value={form.price_eur}
              inputMode="decimal"
              onChange={(e) => setForm((f) => ({ ...f, price_eur: e.target.value }))}
              className="flex-1 rounded-lg px-3 py-2 text-sm text-[#F8FAFC] outline-none"
              style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={creating}
            className="py-2 rounded-lg text-xs font-bold text-[#1B1204] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          >
            {creating ? <Loader className="w-3.5 h-3.5 animate-spin mx-auto" /> : tx('package_add')}
          </button>
        </div>
      )}

      {packages.length === 0 ? (
        <div className="text-center text-xs text-[#94A3B8] py-4">{tx('no_packages')}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(15,15,35,0.4)', border: '1px solid rgba(249,115,22,0.1)' }}>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${p.is_active ? 'text-[#F8FAFC]' : 'text-[#64748B] line-through'}`}>{p.label}</div>
                <div className="text-[11px] text-[#94A3B8]">{Number(p.points_amount).toFixed(0)} pts · €{Number(p.price_eur).toFixed(2)}</div>
              </div>
              <button
                onClick={() => toggleActive(p)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 ${p.is_active ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' : 'bg-[rgba(138,143,152,0.15)] text-[#94A3B8]'}`}
              >
                {tx('package_active')}
              </button>
              <button onClick={() => setPendingDelete(p.id)} className="p-1.5 rounded-lg bg-[rgba(239,68,68,0.1)] text-[#FCA5A5] shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingDelete !== null && (
        <ConfirmModal
          tx={tx}
          message={tx('package_delete')}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// ── AddPointsModal — админ хоҳлаган пользовательга, хоҳлаган пайтда,
// хоҳлаган миқдорда поинт бера олади. window.prompt() Telegram Mini App
// WebView'da ishonchli ishlamasligi mumkin edi (ba'zi klientlarda umuman
// ko'rinmaydi) — shu sabab oddiy in-app modal orqali qilinadi.
function AddPointsModal({ user, tx, onClose, onSubmit }: {
  user: { id: number; display_name: string | null; username: string | null; telegram_id: number };
  tx: any; onClose: () => void; onSubmit: (amount: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<'add' | 'deduct'>('add');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    // Maydon doim musbat — yo'nalish yuqoridagi Начислить/Списать tugmasi
    // orqali tanlanadi, minus belgisi terish shart emas.
    const a = Math.abs(parseFloat(amount));
    if (!a) return;
    setBusy(true);
    try { await onSubmit(mode === 'deduct' ? -a : a); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[360px] glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-[#F97316]">{tx('add_pts_title')}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] text-[#94A3B8] active:scale-90 transition-transform">
            <X size={16} />
          </button>
        </div>

        <div className="text-xs text-[#94A3B8] mb-1">{tx('add_pts_to')}</div>
        <div className="text-sm font-semibold text-[#F8FAFC] mb-4">
          {user.display_name || user.username || `ID ${user.telegram_id}`}
        </div>

        {/* Yo'nalish tanlash — Начислить (admin balansiga tegmasdan qo'shadi)
            yoki Списать (foydalanuvchidan yechadi, 0 dan pastga tushmaydi) */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('add')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'add' ? 'text-[#1B1204]' : 'glass text-[#94A3B8]'
            }`}
            style={mode === 'add' ? { background: 'linear-gradient(135deg, #FB923C, #F97316)' } : undefined}
          >
            {tx('mode_add')}
          </button>
          <button
            onClick={() => setMode('deduct')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'deduct' ? 'text-white' : 'glass text-[#94A3B8]'
            }`}
            style={mode === 'deduct' ? { background: 'linear-gradient(135deg, #F87171, #ef4444)' } : undefined}
          >
            {tx('mode_deduct')}
          </button>
        </div>

        <label className="text-xs text-[#94A3B8]">{tx('amount')}</label>
        <input
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          inputMode="decimal"
          placeholder="0"
          className="w-full bg-[rgba(15,15,35,0.7)] border border-[rgba(249,115,22,0.18)] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] outline-none focus:border-[#F97316] mb-1.5"
        />
        <div className="text-[10px] text-[#94A3B8] mb-4">{tx('add_pts_hint')}</div>

        <button
          onClick={submit}
          disabled={busy || !amount}
          className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{
            background: mode === 'deduct'
              ? 'linear-gradient(135deg, #F87171, #ef4444)'
              : 'linear-gradient(135deg, #FB923C, #F97316)',
            color: mode === 'deduct' ? '#fff' : '#1B1204',
          }}
        >
          {busy ? <Loader className="w-4 h-4 animate-spin mx-auto" /> : mode === 'deduct' ? tx('deduct_pts_submit') : tx('add_pts_submit')}
        </button>
      </div>
    </div>
  );
}

// ── ConfirmModal — window.confirm() o'rniga (bir xil sababdan: Telegram
// Mini App'da native dialoglar ishonchsiz) ──
function ConfirmModal({ tx, message, onConfirm, onCancel }: {
  tx: any; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-[340px] glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-[#F8FAFC] mb-2">{tx('confirm_delete_title')}</h3>
        <p className="text-sm text-[#94A3B8] mb-5">{message}</p>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#94A3B8] glass">
            {tx('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #F87171, #ef4444)' }}
          >
            {tx('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
