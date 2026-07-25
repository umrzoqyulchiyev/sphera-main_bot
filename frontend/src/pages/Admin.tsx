import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, X, Users, MessageSquare, Lock, Loader, Sparkles, CheckCircle, XCircle, Calendar, Music, ArrowLeft, Mic, CreditCard, Trash2, Search, Upload, UserPlus } from 'lucide-react';
import {
  adminCreateTopic, adminGetTopics, adminCloseTopic,
  getUsers, adminSetLevel, adminSetStaffRole, adminAddPoints, getMe,
  adminCreateSlot, getAllSlots, adminUpdateSlotStatus,
  getMusicNominations, adminDeleteNomination,
  adminGetPaymentSettings, adminUpdatePaymentSettings,
  adminListPackages, adminCreatePackage, adminUpdatePackage, adminDeletePackage,
  adminGetPricing, adminUpdatePricing,
  getDefaultMusic, uploadDefaultMusic, deleteDefaultMusic,
  type BroadcastSlot, type MusicNomination, type StaffRole, type Pricing,
} from '../lib/api';
import type { User } from '../types';
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
    make_moderator: 'Сделать модератором', revoke_moderator: 'Убрать модератора',
    moderator_badge: 'Модератор', main_admin_badge: 'Главный админ',
    confirm_grant_admin: 'Сделать этого пользователя модератором? Он получит доступ ко всей админ-панели (темы, эфир, кастинг, слоты, музыка, оплата, поинты), но не сможет менять уровни и роли других пользователей.',
    confirm_revoke_admin: 'Убрать у этого пользователя права модератора?',
    search_users_placeholder: 'Поиск по ID или @username',
    search_no_results: 'Никого не найдено',
    default_music_title: 'Музыка по умолчанию', default_music_none: 'Не задано — играет тишина',
    default_music_upload: 'Загрузить трек', default_music_replace: 'Заменить трек',
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
    pricing_title: 'Стоимость услуг', pricing_hint: 'Сколько поинтов списывается у пользователя за каждое действие. Изменения применяются сразу.',
    pricing_text: 'Текстовое сообщение', pricing_voice: 'Голосовое сообщение', pricing_slot: 'Час эфира (слот)',
    pricing_saved: 'Цены сохранены',
    grant_access: 'Управление доступом к панели', grant_access_title: 'Доступ к админ-панели',
    grant_access_pick: 'Выбрать', grant_access_hint: 'Выберите пользователя, чтобы дать доступ к админ-панели или, если он модератор, исключить его оттуда.',
    no_candidates: 'Некому давать доступ',
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
    make_moderator: 'Make moderator', revoke_moderator: 'Revoke moderator',
    moderator_badge: 'Moderator', main_admin_badge: 'Main admin',
    confirm_grant_admin: 'Make this user a moderator? They will get access to the entire admin panel (topics, broadcast, casting, slots, music, payment, points), but cannot change other users\' levels or roles.',
    confirm_revoke_admin: 'Revoke moderator access from this user?',
    search_users_placeholder: 'Search by ID or @username',
    search_no_results: 'No one found',
    default_music_title: 'Default music', default_music_none: 'Not set — silence plays',
    default_music_upload: 'Upload track', default_music_replace: 'Replace track',
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
    pricing_title: 'Service pricing', pricing_hint: 'How many points are deducted from a user for each action. Changes apply immediately.',
    pricing_text: 'Text message', pricing_voice: 'Voice message', pricing_slot: 'Broadcast hour (slot)',
    pricing_saved: 'Prices saved',
    grant_access: 'Manage panel access', grant_access_title: 'Admin panel access',
    grant_access_pick: 'Select', grant_access_hint: 'Pick a user to grant admin panel access, or — if they\'re already a moderator — remove it.',
    no_candidates: 'No one to grant access to',
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
    make_moderator: 'Suteikti moderatoriaus teises', revoke_moderator: 'Atimti moderatoriaus teises',
    moderator_badge: 'Moderatorius', main_admin_badge: 'Pagrindinis adminas',
    confirm_grant_admin: 'Padaryti šį vartotoją moderatoriumi? Jis gaus prieigą prie visos admin panelės (temos, eteris, atranka, slotai, muzika, mokėjimas, taškai), bet negalės keisti kitų vartotojų lygių ar rolių.',
    confirm_revoke_admin: 'Atimti moderatoriaus teises iš šio vartotojo?',
    search_users_placeholder: 'Ieškoti pagal ID arba @username',
    search_no_results: 'Nieko nerasta',
    default_music_title: 'Numatytoji muzika', default_music_none: 'Nenustatyta — skamba tyla',
    default_music_upload: 'Įkelti dainą', default_music_replace: 'Pakeisti dainą',
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
    pricing_title: 'Paslaugų kainos', pricing_hint: 'Kiek taškų nurašoma iš vartotojo už kiekvieną veiksmą. Pakeitimai taikomi iš karto.',
    pricing_text: 'Teksto žinutė', pricing_voice: 'Balso žinutė', pricing_slot: 'Eterio valanda (slotas)',
    pricing_saved: 'Kainos išsaugotos',
    grant_access: 'Prieigos prie panelės valdymas', grant_access_title: 'Prieiga prie admin panelės',
    grant_access_pick: 'Pasirinkti', grant_access_hint: 'Pasirinkite vartotoją, kad suteiktumėte prieigą prie admin panelės arba, jei jis jau moderatorius, ją panaikintumėte.',
    no_candidates: 'Nėra kam suteikti prieigą',
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
  const [me, setMe] = useState<User | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [slots, setSlots] = useState<BroadcastSlot[]>([]);
  const [castingApps, setCastingApps] = useState<CastingApp[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [addPointsTarget, setAddPointsTarget] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [aggregating, setAggregating] = useState<number | null>(null);
  const [showGrantAccess, setShowGrantAccess] = useState(false);

  useEffect(() => { loadData(); }, [tab]);
  // Panelning o'zi kim ekanini bilishi kerak — faqat "haqiqiy" admin
  // boshqa foydalanuvchilarning rolini o'zgartira oladi, moderator emas.
  useEffect(() => { getMe().then(setMe).catch(() => {}); }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'topics') setTopics(await adminGetTopics());
      else if (tab === 'users') setUsers(await getUsers());
      else if (tab === 'slots') {
        setSlots(await getAllSlots());
        setUsers(await getUsers());
        // Slotni yaratishda narx taxminini ko'rsatish uchun — moderator ham
        // slot yarata oladi, shuning uchun bu o'qish require_staff'da.
        adminGetPricing().then(setPricing).catch(() => {});
      }
      else if (tab === 'music') setTopics(await adminGetTopics());
      else if (tab === 'casting') setCastingApps(await adminGetCasting('pending'));
      else if (tab === 'payment') {
        setPaymentSettings(await adminGetPaymentSettings());
        setPackages(await adminListPackages());
        setPricing(await adminGetPricing());
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

  // "Оплата" va "Кастинг" — faqat haqiqiy admin ko'radi. Moderator bu yerga
  // kirmasligi kerak: to'lov/narxlar hamda kastingni tasdiqlash (bu ham
  // aslida foydalanuvchini 'doverenniy' qiladi — status o'zgartirish bilan
  // barobar) FAQAT admin qaroriga tegishli.
  const isFullAdmin = me?.role === 'admin';
  type TabDef = readonly [string, typeof MessageSquare, string];
  const tabDefs: TabDef[] = [
    ['topics', MessageSquare, tx('topics_tab')],
    ['drafts', Sparkles, tx('drafts_tab')],
    ...(isFullAdmin ? [['casting', Mic, tx('casting_tab')] as TabDef] : []),
    ['slots', Calendar, tx('slots_tab')],
    ['music', Music, tx('music_tab')],
    ['users', Users, tx('users_tab')],
    ...(isFullAdmin ? [['payment', CreditCard, tx('payment_tab')] as TabDef] : []),
  ];

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
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-extrabold tracking-[3px] logo-gradient leading-tight truncate">INTRA GROUP</div>
            <div className="text-[9px] tracking-[4px] text-[#94A3B8] mt-1 font-semibold">{tx('title')}</div>
          </div>
          {/* Admin-panelga kirish huquqini berish — FAQAT haqiqiy admin
              ko'radi. Moderator (kimga bu huquq berilgan bo'lsa ham) bu
              tugmani ko'rmaydi — u boshqa hech kimga huquq bera olmaydi. */}
          {isFullAdmin && (
            <button
              onClick={() => setShowGrantAccess(true)}
              aria-label={tx('grant_access')}
              className="glass w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-[0.92] transition-transform duration-150"
            >
              <UserPlus className="w-4.5 h-4.5 text-[#F97316]" />
            </button>
          )}
        </header>

        {/* Tabs — hammasi bir vaqtda ko'rinadi (flex-wrap), skroll bilan
            yashirinib qolmasin: "Доступ" (users) tab aynan shu sababdan
            topilmay qolgan edi — gorizontal skrollda 6-o'rinda, ekrandan
            tashqarida edi va hech qanday skroll ishorasi yo'q edi. */}
        <div className="flex flex-wrap gap-2">
          {tabDefs.map(([t, Icon, label]) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t as any)}
                className={`flex items-center gap-1.5 py-2.5 px-4 rounded-full border font-bold text-[11px] transition-all duration-200 active:scale-[0.95] ${
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
        ) : tab === 'casting' && isFullAdmin ? (
          <CastingTab apps={castingApps} tx={tx}
            onApprove={async (id: number, note: string) => { try { await adminApproveCasting(id, note); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onReject={async (id: number, note: string) => { try { await adminRejectCasting(id, note); flash('✅'); await loadData(); } catch { flash('❌'); } }} />
        ) : tab === 'slots' ? (
          <SlotsTab slots={slots} users={users} pricing={pricing} isFullAdmin={isFullAdmin} onReload={loadData} flash={flash} />
        ) : tab === 'music' ? (
          <MusicTab topics={topics} tx={tx} flash={flash} />
        ) : tab === 'payment' && isFullAdmin ? (
          <PaymentTab tx={tx} settings={paymentSettings} packages={packages} pricing={pricing} flash={flash} onReload={loadData} />
        ) : (
          <UsersTab users={users} tx={tx} isFullAdmin={isFullAdmin}
            onSetLevel={async (id: number, lvl: number) => { try { await adminSetLevel(id, lvl); flash('✅'); await loadData(); } catch { flash('❌'); } }}
            onSetRole={async (id: number, role: StaffRole) => {
              try { await adminSetStaffRole(id, role); flash('✅'); await loadData(); }
              catch (e: any) { flash('❌ ' + (e.message || '')); }
            }}
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

      {/* Admin-panelga kirish huquqi berish — header'dagi tez tugma */}
      {showGrantAccess && (
        <GrantAccessModal
          tx={tx}
          onClose={() => setShowGrantAccess(false)}
          flash={flash}
          onGranted={() => { if (tab === 'users') loadData(); }}
        />
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

function SlotsTab({ slots, users, pricing, isFullAdmin, onReload, flash }: any) {
  const pricePerHour = pricing ? parseFloat(pricing.price_slot_per_hour) : 200;
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

  const trustedUsers = users.filter((u: any) => ['doverenniy', 'moderator', 'admin'].includes(u.role));

  return (
    <div className="flex flex-col gap-3">
      {/* Slot ochish — resurs (vaqt + poinт xarajati) taqsimlash qarori,
          shuning uchun FAQAT haqiqiy admin. Moderator pastdagi ro'yxatni
          ko'radi va statusni boshqaradi, lekin yangi slot ocha olmaydi. */}
      {!isFullAdmin ? null : !showCreate ? (
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
                {u.display_name || u.username || `ID ${u.telegram_id}`} — {u.role === 'admin' ? 'ADMIN' : u.role === 'moderator' ? 'MODERATOR' : `Уровень ${u.level}`}
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
            Со счёта ведущего спишется ≈ {((parseInt(form.duration_min) || 60) / 60 * pricePerHour).toFixed(0)} поинтов за слот
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
  const [defaultMusicName, setDefaultMusicName] = useState<string | null>(null);
  const [defaultMusicLoading, setDefaultMusicLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getDefaultMusic().then((r) => setDefaultMusicName(r.name)).finally(() => setDefaultMusicLoading(false));
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const res = await uploadDefaultMusic(file);
      setDefaultMusicName(res.detail?.name ?? file.name);
      flash('✅');
    } catch (e: any) { flash('❌ ' + (e.message || '')); }
    finally { setUploading(false); }
  }

  async function handleDeleteDefault() {
    try { await deleteDefaultMusic(); setDefaultMusicName(null); flash('✅'); }
    catch { flash('❌'); }
  }

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

  return (
    <div className="flex flex-col gap-3">
      {/* Дefolt musiqa — efirda navbatda AI-segment yoki jonli efir yo'q
          paytda jimlik o'rniga shu trek chalinadi (topic tanlanishidan
          mustaqil, global sozlama). */}
      <div className="glass rounded-2xl p-4">
        <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wide mb-2">{tx('default_music_title')}</div>
        {defaultMusicLoading ? (
          <div className="flex justify-center py-2"><Loader className="w-4 h-4 text-[#F97316] animate-spin" /></div>
        ) : (
          <>
            <div className="text-sm text-[#F8FAFC] mb-3">
              {defaultMusicName ? `🎵 ${defaultMusicName}` : <span className="text-[#94A3B8]">{tx('default_music_none')}</span>}
            </div>
            <div className="flex gap-2">
              <label className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#1B1204] cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}>
                {uploading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {defaultMusicName ? tx('default_music_replace') : tx('default_music_upload')}
                <input type="file" accept="audio/*" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
              </label>
              {defaultMusicName && (
                <button onClick={handleDeleteDefault} className="p-2.5 rounded-xl bg-[rgba(239,68,68,0.1)] text-[#FCA5A5] shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {topics.length === 0 ? (
        <div className="glass p-8 text-center text-[#94A3B8] text-sm">{tx('no_topics')}</div>
      ) : (
      <>
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
      </>
      )}
    </div>
  );
}

// ── UsersTab (контроль доступа — уровни 1/2/3 + модератор) ────
function UsersTab({ users, tx, isFullAdmin, onSetLevel, onSetRole, onAddPoints }: any) {
  // Moderator huquqi berish/qaytarib olish — bosilishi bilan emas,
  // avval ConfirmModal orqali (yuqori huquq, tasodifan bosilib qolmasin).
  // Faqat haqiqiy admin (isFullAdmin) ko'radi/bosa oladi — moderator boshqa
  // hech kimning darajasi yoki rolini o'zgartira olmaydi.
  const [roleTarget, setRoleTarget] = useState<{ id: number; name: string; role: StaffRole; grant: boolean } | null>(null);
  // ID yoki @username bo'yicha qidiruv — 200 nafar foydalanuvchi ro'yxatida
  // kerakli odamni topish qiyin bo'lgani uchun.
  const [search, setSearch] = useState('');

  const filtered = (() => {
    const q = search.trim().toLowerCase().replace(/^@/, '');
    if (!q) return users;
    return users.filter((u: any) =>
      String(u.telegram_id).includes(q) ||
      String(u.id) === q ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q)
    );
  })();

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

      {/* Qidiruv — ID yoki @username */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tx('search_users_placeholder')}
          className="w-full rounded-2xl pl-10 pr-9 py-3 text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B]"
          style={{ background: 'rgba(27,27,48,0.8)', border: '1px solid rgba(148,163,184,0.16)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Очистить"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="glass p-6 text-center text-[#94A3B8] text-sm">{tx('search_no_results')}</div>
      )}

      {filtered.map((u: any) => (
        <div key={u.id} className="glass rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#F8FAFC] truncate">
                {u.display_name || u.username || `ID ${u.telegram_id}`}
                {u.role === 'admin' && <span className="ml-1.5 text-[10px] font-bold text-[#EAB308]">👑 {tx('main_admin_badge')}</span>}
                {u.role === 'moderator' && <span className="ml-1.5 text-[10px] font-bold text-[#38BDF8]">🛡 {tx('moderator_badge')}</span>}
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
          {/* Level tugmalari — raqamli darajalar (1/2/3). Moderator buni
              ko'radi, lekin faqat rasm sifatida — bosib bo'lmaydi. */}
          <div className="flex gap-1.5 mb-1.5">
            {[1, 2, 3].map(lvl => isFullAdmin ? (
              <button key={lvl} onClick={() => onSetLevel(u.id, lvl)}
                className={`flex-1 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                  u.level === lvl
                    ? 'bg-gradient-to-r from-[#FB923C] to-[#F97316] text-[#1B1204]'
                    : 'glass text-[#94A3B8]'
                }`}>
                {tx(`lvl${lvl}`)}
              </button>
            ) : (
              <div key={lvl} className={`flex-1 py-1.5 rounded-xl text-[12px] font-bold text-center ${
                  u.level === lvl
                    ? 'bg-gradient-to-r from-[#FB923C] to-[#F97316] text-[#1B1204]'
                    : 'glass text-[#94A3B8] opacity-50'
                }`}>
                {tx(`lvl${lvl}`)}
              </div>
            ))}
          </div>
          {/* Moderator huquqi — faqat haqiqiy admin bera/qaytarib ola oladi.
              Yagona role==='admin' (egasi) uchun hech qanday tugma yo'q —
              hattoki o'zi ham bu yerdan o'z rolini o'zgartira olmaydi. */}
          {u.role === 'admin' ? null : isFullAdmin ? (
            <button
              onClick={() => setRoleTarget({
                id: u.id,
                name: u.display_name || u.username || `ID ${u.telegram_id}`,
                role: u.role === 'moderator' ? 'none' : 'moderator',
                grant: u.role !== 'moderator',
              })}
              className={`w-full py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                u.role === 'moderator'
                  ? 'bg-[rgba(239,68,68,0.1)] text-[#FCA5A5]'
                  : 'bg-[rgba(56,189,248,0.12)] text-[#38BDF8]'
              }`}
            >
              {u.role === 'moderator' ? tx('revoke_moderator') : `🛡 ${tx('make_moderator')}`}
            </button>
          ) : u.role === 'moderator' ? (
            <div className="w-full py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 bg-[rgba(56,189,248,0.08)] text-[#38BDF8] opacity-60">
              🛡 {tx('moderator_badge')}
            </div>
          ) : null}
        </div>
      ))}

      {roleTarget && (
        <ConfirmModal
          tx={tx}
          message={tx(roleTarget.grant ? 'confirm_grant_admin' : 'confirm_revoke_admin')}
          onConfirm={() => { onSetRole(roleTarget.id, roleTarget.role); setRoleTarget(null); }}
          onCancel={() => setRoleTarget(null)}
        />
      )}
    </div>
  );
}

// ── PaymentTab — admin поинт оплатасини қандай ишлашини белгилайди ──
function PaymentTab({ tx, settings, packages, pricing, flash, onReload }: {
  tx: any; settings: PaymentSettings | null; packages: AdminPackage[]; pricing: Pricing | null;
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

      <PricingEditor tx={tx} pricing={pricing} flash={flash} onReload={onReload} />
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

// ── PricingEditor — xizmatlar narxi (matn/ovoz xabar, efir soati).
// FAQAT haqiqiy admin ko'radi (PaymentTab shu tarzda ekaniga ishonch hosil
// qilingan) — "сколько поинтов будет сниматься... это решает только админ".
function PricingEditor({ tx, pricing, flash, onReload }: {
  tx: any; pricing: Pricing | null; flash: (m: string) => void; onReload: () => Promise<void>;
}) {
  const [text, setText] = useState(pricing?.price_text_message ?? '');
  const [voice, setVoice] = useState(pricing?.price_voice_message ?? '');
  const [slot, setSlot] = useState(pricing?.price_slot_per_hour ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(pricing?.price_text_message ?? '');
    setVoice(pricing?.price_voice_message ?? '');
    setSlot(pricing?.price_slot_per_hour ?? '');
  }, [pricing]);

  async function save() {
    const t = parseFloat(text), v = parseFloat(voice), s = parseFloat(slot);
    if (!(t >= 0) || !(v >= 0) || !(s >= 0)) return;
    setSaving(true);
    try {
      await adminUpdatePricing({ price_text_message: t, price_voice_message: v, price_slot_per_hour: s });
      flash('✅ ' + tx('pricing_saved'));
      await onReload();
    } catch { flash('❌'); }
    finally { setSaving(false); }
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wide mb-1">{tx('pricing_title')}</div>
      <div className="text-[11px] text-[#94A3B8] mb-3">{tx('pricing_hint')}</div>
      <div className="flex flex-col gap-2.5">
        {([
          ['text', text, setText, tx('pricing_text')],
          ['voice', voice, setVoice, tx('pricing_voice')],
          ['slot', slot, setSlot, tx('pricing_slot')],
        ] as const).map(([key, value, setValue, label]) => (
          <div key={key} className="flex items-center gap-3">
            <label className="flex-1 text-sm text-[#F8FAFC]">{label}</label>
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 rounded-lg px-3 py-2 text-sm text-right text-[#F8FAFC] outline-none"
              style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(249,115,22,0.18)' }}
            />
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold text-[#1B1204] disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
      >
        {saving ? <Loader className="w-3.5 h-3.5 animate-spin mx-auto" /> : tx('save')}
      </button>
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

// ── GrantAccessModal — header'dagi tez tugma: qidirish → tanlash →
// "Выбрать" → tasdiqlash (ConfirmModal). Faqat isFullAdmin ko'radi (tugma
// o'zi header'da shunga qarab yashiringan), backend ham require_admin.
function GrantAccessModal({ tx, onClose, flash, onGranted }: {
  tx: any; onClose: () => void; flash: (m: string) => void; onGranted: () => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    getUsers().then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false));
  }, []);

  // Haqiqiy admin (yagona) ro'yxatda ko'rsatilmaydi — unga huquq berish
  // ma'nosiz (u allaqachon hammasiga ega).
  const candidates = users.filter((u: any) => u.role !== 'admin');
  const filtered = (() => {
    const q = search.trim().toLowerCase().replace(/^@/, '');
    if (!q) return candidates;
    return candidates.filter((u: any) =>
      String(u.telegram_id).includes(q) ||
      String(u.id) === q ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q)
    );
  })();

  // Kim tanlansa — o'sha kishining joriy roliga qarab harakat o'zi
  // aniqlanadi: moderator emas → beramiz, moderator → olib qo'yamiz
  // (bitta oyna orqali ikkalasi ham — "исключить" aynan shu yerda).
  const willRevoke = selected?.role === 'moderator';

  async function handleConfirm() {
    if (!selected) return;
    setGranting(true);
    try {
      await adminSetStaffRole(selected.id, willRevoke ? 'none' : 'moderator');
      flash('✅');
      onGranted();
      onClose();
    } catch (e: any) {
      flash('❌ ' + (e.message || ''));
      setConfirming(false);
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[400px] max-h-[80vh] flex flex-col glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1 shrink-0">
          <h3 className="text-base font-bold text-[#F97316]">{tx('grant_access_title')}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-[#94A3B8] mb-3 shrink-0">{tx('grant_access_hint')}</p>

        <div className="relative mb-3 shrink-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tx('search_users_placeholder')}
            className="w-full rounded-2xl pl-10 pr-9 py-2.5 text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B]"
            style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(148,163,184,0.16)' }}
          />
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {loading ? (
            <div className="text-center text-xs text-[#94A3B8] py-6">…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-xs text-[#94A3B8] py-6">
              {candidates.length === 0 ? tx('no_candidates') : tx('search_no_results')}
            </div>
          ) : filtered.map((u: any) => {
            const isSelected = selected?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all"
                style={{
                  background: isSelected ? 'rgba(249,115,22,0.12)' : 'rgba(15,15,35,0.5)',
                  border: isSelected ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#F8FAFC] truncate">
                    {u.display_name || u.username || `ID ${u.telegram_id}`}
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">
                    {tx('level_label')} {u.level}
                    {u.role === 'moderator' && <span className="ml-1.5 text-[#38BDF8]">🛡 {tx('moderator_badge')}</span>}
                  </div>
                </div>
                {isSelected && <CheckCircle className="w-4 h-4 text-[#F97316] shrink-0" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => selected && setConfirming(true)}
          disabled={!selected}
          className="w-full mt-3 py-3 rounded-xl font-bold text-sm disabled:opacity-40 shrink-0"
          style={willRevoke
            ? { background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }
            : { background: 'linear-gradient(135deg, #FB923C, #F97316)', color: '#1B1204' }}
        >
          {selected ? (willRevoke ? tx('revoke_moderator') : tx('make_moderator')) : tx('grant_access_pick')}
        </button>
      </div>

      {confirming && selected && (
        <ConfirmModal
          tx={tx}
          message={tx(willRevoke ? 'confirm_revoke_admin' : 'confirm_grant_admin')}
          onConfirm={handleConfirm}
          onCancel={() => !granting && setConfirming(false)}
        />
      )}
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
