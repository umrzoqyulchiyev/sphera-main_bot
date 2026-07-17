import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, X, Award, Globe, IdCard, User as UserIcon, AtSign, Focus, Smile, Tag,
  ArrowDown, ArrowUp, Edit, ShoppingCart, ChevronRight, History, ArrowUpRight, ArrowDownLeft,
  Gift, MessageSquare, Mic, Radio, Music, type LucideIcon,
} from 'lucide-react';
import {
  updateProfile, transferPoints, requestPoints, getMyRequests,
  decideRequest, getPackages, getMe, updateLanguage, getPointsHistory,
} from '../../lib/api';
import { getLang, setLang as setI18nLang } from '../../lib/i18n';
import { LanguageSelector } from '../announcements/LanguageSelector';
import type { User, PointsRequest, PointPackage, Language, PointsTransaction } from '../../types';

interface ProfileScreenProps {
  user: User | null;
  onUserUpdate?: (user: User) => void;
}

// Ko'p tilli yorliqlar (dizaynga ta'sir qilmaydi)
const L: Record<string, Record<string, string>> = {
  ru: {
    balance: 'Ваш баланс', points: 'Баллы', level: 'Уровень', language: 'Язык', id: 'ID',
    name: 'Имя', username: 'Никнейм', edit: 'Редактировать профиль', save: 'Сохранить',
    request: 'Запросить', give: 'Отправить', buy: 'Купить', requests: 'Запросы ко мне',
    user_id: 'ID пользователя', amount: 'Количество', msg: 'Сообщение', approve: 'Одобрить',
    reject: 'Отклонить', no_req: 'Нет новых запросов', from_you: 'запрашивает у вас',
    admin: '👑 Admin Panel', saved: 'Сохранено', sent: 'Отправлено', error: 'Ошибка', requested: 'Запрос отправлен',
    lang_ru: 'Русский', lang_en: 'English', lang_lt: 'Lietuvių',
    history: 'История', history_title: 'История операций', no_history: 'Пока нет операций',
    tx_transfer_out: 'Перевод пользователю', tx_transfer_in: 'Перевод от пользователя',
    tx_purchase: 'Покупка поинтов', tx_gift: 'Подарок от админа',
    tx_text_message: 'Сообщение в чат', tx_voice_message: 'Голосовое в чат',
    tx_studio: 'Заявка в студию', tx_opinion_text: 'Мнение в студию', tx_opinion_voice: 'Голосовое мнение',
    tx_music_nominate: 'Номинация трека', tx_music_vote: 'Голос за трек',
    tx_slot_booking: 'Оплата слота эфира', tx_other: 'Операция',
  },
  en: {
    balance: 'Your balance', points: 'Points', level: 'Level', language: 'Language', id: 'ID',
    name: 'Name', username: 'Username', edit: 'Edit profile', save: 'Save',
    request: 'Request', give: 'Send', buy: 'Buy', requests: 'Requests to me',
    user_id: 'User ID', amount: 'Amount', msg: 'Message', approve: 'Approve',
    reject: 'Reject', no_req: 'No new requests', from_you: 'requests from you',
    admin: '👑 Admin Panel', saved: 'Saved', sent: 'Sent', error: 'Error', requested: 'Request sent',
    lang_ru: 'Русский', lang_en: 'English', lang_lt: 'Lietuvių',
    history: 'History', history_title: 'Transaction history', no_history: 'No transactions yet',
    tx_transfer_out: 'Transfer to user', tx_transfer_in: 'Transfer from user',
    tx_purchase: 'Points purchase', tx_gift: 'Gift from admin',
    tx_text_message: 'Chat message', tx_voice_message: 'Chat voice message',
    tx_studio: 'Studio request', tx_opinion_text: 'Studio opinion', tx_opinion_voice: 'Studio voice opinion',
    tx_music_nominate: 'Track nomination', tx_music_vote: 'Track vote',
    tx_slot_booking: 'Broadcast slot payment', tx_other: 'Transaction',
  },
  lt: {
    balance: 'Jūsų balansas', points: 'Taškai', level: 'Lygis', language: 'Kalba', id: 'ID',
    name: 'Vardas', username: 'Slapyvardis', edit: 'Redaguoti profilį', save: 'Išsaugoti',
    request: 'Prašyti', give: 'Siųsti', buy: 'Pirkti', requests: 'Prašymai man',
    user_id: 'Vartotojo ID', amount: 'Kiekis', msg: 'Žinutė', approve: 'Patvirtinti',
    reject: 'Atmesti', no_req: 'Naujų prašymų nėra', from_you: 'prašo iš jūsų',
    admin: '👑 Admin Panel', saved: 'Išsaugota', sent: 'Išsiųsta', error: 'Klaida', requested: 'Prašymas išsiųstas',
    lang_ru: 'Русский', lang_en: 'English', lang_lt: 'Lietuvių',
    history: 'Istorija', history_title: 'Operacijų istorija', no_history: 'Kol kas nėra operacijų',
    tx_transfer_out: 'Pervedimas vartotojui', tx_transfer_in: 'Pervedimas iš vartotojo',
    tx_purchase: 'Taškų pirkimas', tx_gift: 'Dovana iš admino',
    tx_text_message: 'Žinutė pokalbyje', tx_voice_message: 'Balso žinutė pokalbyje',
    tx_studio: 'Užklausa studijai', tx_opinion_text: 'Nuomonė studijai', tx_opinion_voice: 'Balso nuomonė',
    tx_music_nominate: 'Dainos nominacija', tx_music_vote: 'Balsas už dainą',
    tx_slot_booking: 'Eterio slot apmokėjimas', tx_other: 'Operacija',
  },
};

type Modal = null | 'edit' | 'give' | 'request' | 'buy' | 'lang' | 'history';

export function ProfileScreen({ user, onUserUpdate }: ProfileScreenProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const navigate = useNavigate();
  const [modal, setModal] = useState<Modal>(null);
  const [requests, setRequests] = useState<PointsRequest[]>([]);
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [history, setHistory] = useState<PointsTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    getMyRequests().then(setRequests).catch(() => {});
    getPackages().then(setPackages).catch(() => {});
  }, []);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(''), 2500);
  }

  async function refresh() {
    try {
      const u = await getMe();
      onUserUpdate?.(u);
    } catch {}
    getMyRequests().then(setRequests).catch(() => {});
  }

  async function handleLangChange(newLang: Language) {
    setI18nLang(newLang);
    try {
      await updateLanguage(newLang);
      if (user) onUserUpdate?.({ ...user, language: newLang });
    } catch {
      showToast(tx('error'));
    } finally {
      setModal(null);
    }
  }

  async function openHistory() {
    setModal('history');
    setHistoryLoading(true);
    try { setHistory(await getPointsHistory()); }
    catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }

  async function handleDecide(id: number, approve: boolean) {
    try {
      await decideRequest(id, approve);
      await refresh();
      showToast(tx('saved'));
    } catch {
      showToast(tx('error'));
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-[#8a8f98] text-sm">Loading...</div>
      </div>
    );
  }

  const langLabel = tx(`lang_${user.language || 'ru'}`);

  // Uровень отображается числом (1/2/3), а не словом — по требованию клиента
  const lvl = user.level ?? 1;
  const levelDisplay = String(lvl);

  return (
    <div className="flex flex-col gap-6">
      {/* Balance card — avatar + neon balance (Stitch) */}
      <section className="stitch-card p-8 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#5e6ad2]/5 to-transparent pointer-events-none" />
        <div className="relative z-10 w-full flex flex-col items-center justify-center">
          {/* Avatar */}
          <div className="w-28 h-28 rounded-full overflow-hidden avatar-glow bg-[rgba(37,42,53,0.5)] flex items-center justify-center mb-4">
            <UserIcon size={48} className="text-[#5e6ad2]/50" />
          </div>
          <h2 className="text-[11px] text-[#9a9fa8] tracking-[0.2em] uppercase opacity-80 mb-2 font-mono">{tx('balance')}</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-[48px] font-extrabold text-[#6e78e1] neon-glow-text font-mono">
              {Number(user.points).toFixed(3)}
            </span>
            <span className="text-[18px] font-semibold text-[#c5c9f5]">PTS</span>
          </div>
        </div>
      </section>

      {/* Info rows — Level / Language / ID / Name / Username (TZ tartibi) */}
      <section className="stitch-card p-6 flex flex-col">
        <StitchRow icon={Award} label={tx('level')} value={levelDisplay} highlight />
        <button className="w-full" onClick={() => setModal('lang')}>
          <StitchRow icon={Globe} label={tx('language')} value={langLabel} clickable />
        </button>
        <StitchRow icon={IdCard} label={tx('id')} value={String(user.telegram_id)} mono />
        <StitchRow icon={UserIcon} label={tx('name')} value={user.display_name || user.full_name || '—'} />
        <StitchRow icon={AtSign} label={tx('username')} value={user.username ? `@${user.username}` : '—'} accent last />
      </section>

      {/* Psixoprofil — mavjud bo'lsa */}
      {(user.focus_of_attention || user.emotional_tone) && (
        <section className="stitch-card p-6 flex flex-col">
          <div className="text-[11px] font-bold text-[#6e78e1] uppercase tracking-wide mb-2 font-mono">
            🧠 {lang === 'ru' ? 'Психопрофиль' : lang === 'lt' ? 'Psichotipas' : 'Psychotype'}
          </div>
          {user.focus_of_attention && (
            <StitchRow icon={Focus}
              label={lang === 'ru' ? 'Фокус' : lang === 'lt' ? 'Fokusas' : 'Focus'}
              value={
                user.focus_of_attention === 'vnutrenniy'
                  ? (lang === 'ru' ? 'Внутренний' : lang === 'lt' ? 'Vidinis' : 'Internal')
                  : (lang === 'ru' ? 'Внешний' : lang === 'lt' ? 'Išorinis' : 'External')
              }
            />
          )}
          {user.emotional_tone && (
            <StitchRow icon={Smile}
              label={lang === 'ru' ? 'Тон' : lang === 'lt' ? 'Tonas' : 'Tone'}
              value={
                user.emotional_tone === 'optimist'
                  ? (lang === 'ru' ? 'Оптимист' : lang === 'lt' ? 'Optimistas' : 'Optimist')
                  : user.emotional_tone === 'melanxolik'
                  ? (lang === 'ru' ? 'Меланхолик' : lang === 'lt' ? 'Melancholikas' : 'Melancholic')
                  : (lang === 'ru' ? 'Рационал' : lang === 'lt' ? 'Racionalistas' : 'Rational')
              }
            />
          )}
          {user.key_topic && (
            <StitchRow icon={Tag}
              label={lang === 'ru' ? 'Тема' : lang === 'lt' ? 'Tema' : 'Topic'}
              value={user.key_topic} last
            />
          )}
        </section>
      )}

      {/* Tahrirlash */}
      <button
        onClick={() => setModal('edit')}
        className="stitch-card py-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-[#d5d6dc] active:scale-[0.98] transition-transform"
      >
        <Edit size={20} className="text-[#5e6ad2]" />
        {tx('edit')}
      </button>

      {/* Point amallar — Request / Send / Buy (Stitch) */}
      <section className="grid grid-cols-3 gap-4">
        <StitchAction icon={ArrowDown} label={tx('request')} onClick={() => setModal('request')} />
        <StitchAction icon={ArrowUp} label={tx('give')} onClick={() => setModal('give')} />
        <button
          onClick={() => setModal('buy')}
          className="rounded-[20px] p-4 flex flex-col items-center justify-center gap-2.5 btn-primary-glow active:scale-95 transition-transform"
        >
          <ShoppingCart size={28} />
          <span className="text-[11px] font-bold tracking-wider font-mono">{tx('buy')}</span>
        </button>
      </section>

      {/* Tranzaksiyalar tarixi */}
      <button
        onClick={openHistory}
        className="stitch-card py-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-[#d5d6dc] active:scale-[0.98] transition-transform"
      >
        <History size={20} className="text-[#5e6ad2]" />
        {tx('history')}
      </button>

      {/* Menga kelgan so'rovlar */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold text-[#6e78e1] uppercase tracking-wide font-mono">{tx('requests')}</div>
        {requests.length === 0 ? (
          <div className="stitch-card p-4 text-center text-xs text-[#8a8f98]">{tx('no_req')}</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="stitch-card p-3.5">
              <div className="text-sm text-[#d5d6dc]">
                <b>{r.from_display_name || `#${r.from_user_id}`}</b> {tx('from_you')}{' '}
                <b className="text-[#6e78e1]">{Number(r.amount).toFixed(3)}</b>
              </div>
              {r.message && <div className="text-xs text-[#8a8f98] mt-1">{r.message}</div>}
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => handleDecide(r.id, true)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[rgba(34,227,165,0.15)] text-[#22e3a5] text-xs font-semibold"
                >
                  <Check className="w-4 h-4" /> {tx('approve')}
                </button>
                <button
                  onClick={() => handleDecide(r.id, false)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[rgba(255,77,109,0.12)] text-[#ff9fb0] text-xs font-semibold"
                >
                  <X className="w-4 h-4" /> {tx('reject')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Admin link */}
      {user.role === 'admin' && (
        <button onClick={() => navigate('/admin', { state: { from: 'profile' } })} className="stitch-card py-3 text-center text-sm font-bold text-[#6e78e1] transition-all">
          {tx('admin')}
        </button>
      )}

      {/* Modallar */}
      {modal === 'edit' && (
        <EditModal user={user} tx={tx} onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await refresh(); showToast(tx('saved')); }}
          onError={() => showToast(tx('error'))} />
      )}
      {modal === 'give' && (
        <TransferModal tx={tx} onClose={() => setModal(null)}
          onDone={async () => { setModal(null); await refresh(); showToast(tx('sent')); }}
          onError={(m) => showToast(m)} />
      )}
      {modal === 'request' && (
        <RequestModal tx={tx} onClose={() => setModal(null)}
          onDone={() => { setModal(null); showToast(tx('requested')); }}
          onError={(m) => showToast(m)} />
      )}
      {modal === 'buy' && (
        <BuyModal tx={tx} packages={packages} onClose={() => setModal(null)}
          onDone={async () => { setModal(null); await refresh(); showToast(tx('saved')); }}
          onError={() => showToast(tx('error'))} />
      )}
      {modal === 'lang' && (
        <ModalShell title={tx('language')} onClose={() => setModal(null)}>
          <LanguageSelector selectedLang={lang} onLangChange={handleLangChange} />
        </ModalShell>
      )}
      {modal === 'history' && (
        <ModalShell title={tx('history_title')} onClose={() => setModal(null)}>
          <HistoryList tx={tx} lang={lang} items={history} loading={historyLoading} />
        </ModalShell>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-xl text-sm text-[#ededef] border border-[rgba(94,106,210,0.4)] z-[200]">
          {toast}
        </div>
      )}
    </div>
  );
}

// Stitch dizayni: ikonka + label (chap), value (o'ng), pastki chiziq
function StitchRow({ icon: Icon, label, value, highlight, accent, mono, last, clickable }: {
  icon: LucideIcon; label: string; value: string;
  highlight?: boolean; accent?: boolean; mono?: boolean; last?: boolean; clickable?: boolean;
}) {
  return (
    <div
      className="flex justify-between items-center py-4"
      style={last ? {} : { borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-[15px] text-[#9a9fa8] flex items-center gap-3">
        <Icon size={20} className="text-[#7d818a]" />
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        {highlight ? (
          <span className="px-3 py-1 rounded-lg bg-[rgba(94,106,210,0.12)] text-[#5e6ad2] text-[13px] font-bold">{value}</span>
        ) : (
          <span className={`text-[15px] font-semibold ${accent ? 'text-[#aaafe6]' : 'text-[#d5d6dc]'} ${mono ? 'font-mono' : ''}`}>
            {value}
          </span>
        )}
        {clickable && <ChevronRight size={16} className="text-[#5a5f68]" />}
      </span>
    </div>
  );
}

function StitchAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="stitch-card p-4 flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform"
    >
      <Icon size={28} className="text-[#5e6ad2]" />
      <span className="text-[11px] text-[#d5d6dc] tracking-wider font-mono">{label}</span>
    </button>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-[360px] max-h-[85vh] glass rounded-3xl p-5 bg-[#101014] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
          <h3 className="text-base font-bold text-[#5e6ad2]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(255,255,255,0.06)] text-[#9a9fa8] active:scale-90 transition-transform"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-[rgba(5,5,6,0.7)] border border-[rgba(110,118,220,0.18)] rounded-xl px-4 py-3 text-sm text-[#ededef] outline-none focus:border-[#5e6ad2] mb-3';
const primaryBtn = 'w-full py-3 rounded-xl font-bold text-[#020203] text-sm';
const primaryStyle = { background: 'linear-gradient(135deg, #7b85e8, #5e6ad2)' };
type TX = (k: string) => string;

function EditModal({ user, tx, onClose, onSaved, onError }: { user: User; tx: TX; onClose: () => void; onSaved: () => void; onError: () => void }) {
  const [name, setName] = useState(user.display_name || user.full_name || '');
  const [username, setUsername] = useState(user.username || '');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await updateProfile({ display_name: name.trim() || undefined, username: username.trim() || undefined });
      onSaved();
    } catch { onError(); } finally { setBusy(false); }
  }
  return (
    <ModalShell title={tx('edit')} onClose={onClose}>
      <label className="text-xs text-[#8a8f98]">{tx('name')}</label>
      <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      <label className="text-xs text-[#8a8f98]">{tx('username')}</label>
      <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} />
      <button className={primaryBtn} style={primaryStyle} onClick={save} disabled={busy}>{tx('save')}</button>
    </ModalShell>
  );
}

function TransferModal({ tx, onClose, onDone, onError }: { tx: TX; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    const id = parseInt(toId, 10), amt = parseFloat(amount);
    if (!id || !amt || amt <= 0) { onError(tx('error')); return; }
    setBusy(true);
    try { await transferPoints(id, amt); onDone(); }
    catch (e: any) { onError(e.message || tx('error')); } finally { setBusy(false); }
  }
  return (
    <ModalShell title={tx('give')} onClose={onClose}>
      <label className="text-xs text-[#8a8f98]">{tx('user_id')}</label>
      <input className={inputCls} value={toId} onChange={(e) => setToId(e.target.value)} inputMode="numeric" />
      <label className="text-xs text-[#8a8f98]">{tx('amount')}</label>
      <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      <button className={primaryBtn} style={primaryStyle} onClick={submit} disabled={busy}>{tx('give')}</button>
    </ModalShell>
  );
}

function RequestModal({ tx, onClose, onDone, onError }: { tx: TX; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [fromId, setFromId] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    const id = parseInt(fromId, 10), amt = parseFloat(amount);
    if (!id || !amt || amt <= 0) { onError(tx('error')); return; }
    setBusy(true);
    try { await requestPoints(id, amt, msg.trim()); onDone(); }
    catch (e: any) { onError(e.message || tx('error')); } finally { setBusy(false); }
  }
  return (
    <ModalShell title={tx('request')} onClose={onClose}>
      <label className="text-xs text-[#8a8f98]">{tx('user_id')}</label>
      <input className={inputCls} value={fromId} onChange={(e) => setFromId(e.target.value)} inputMode="numeric" />
      <label className="text-xs text-[#8a8f98]">{tx('amount')}</label>
      <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      <label className="text-xs text-[#8a8f98]">{tx('msg')}</label>
      <input className={inputCls} value={msg} onChange={(e) => setMsg(e.target.value)} />
      <button className={primaryBtn} style={primaryStyle} onClick={submit} disabled={busy}>{tx('request')}</button>
    </ModalShell>
  );
}

function BuyModal({ tx, packages, onClose }: { tx: TX; packages: PointPackage[]; onClose: () => void; onDone: () => void; onError: () => void }) {
  // To'lov botda bo'ladi (Telegram Payments faqat bot orqali) → botga yo'naltiramiz
  function buyViaBot() {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      // Bot'da /buy buyrug'i — paketlar ko'rinadi
      tg.openTelegramLink('https://t.me/mybot_12_bot?start=buy');
      tg.close?.();
    } else {
      window.open('https://t.me/mybot_12_bot', '_blank');
    }
  }

  return (
    <ModalShell title={tx('buy')} onClose={onClose}>
      <p className="text-xs text-[#8a8f98] mb-3 leading-relaxed">
        {/* Ru/En/Lt — to'lov bot orqali */}
        Оплата проходит через бота безопасно (Telegram Payments).
        Нажмите кнопку — откроется бот с пакетами.
      </p>
      <div className="flex flex-col gap-2 mb-3">
        {packages.map((p) => (
          <div key={p.id}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-[rgba(110,118,220,0.18)] bg-[rgba(5,5,6,0.5)]">
            <span className="font-semibold text-[#ededef]">{p.label}</span>
            <span className="text-[#5e6ad2] font-bold">⭐{Number(p.price_eur).toFixed(0)}</span>
          </div>
        ))}
      </div>
      <button className={primaryBtn} style={primaryStyle} onClick={buyViaBot}>
        {tx('buy')} →
      </button>
    </ModalShell>
  );
}

const TX_ICON: Record<string, LucideIcon> = {
  transfer_out: ArrowUpRight,
  transfer_in: ArrowDownLeft,
  purchase: ShoppingCart,
  gift: Gift,
  text_message: MessageSquare,
  voice_message: MessageSquare,
  studio: Mic,
  opinion_text: Mic,
  opinion_voice: Mic,
  music_nominate: Music,
  music_vote: Music,
  slot_booking: Radio,
};

function HistoryList({ tx, lang, items, loading }: { tx: TX; lang: Language; items: PointsTransaction[]; loading: boolean }) {
  if (loading) {
    return <div className="py-8 text-center text-xs text-[#8a8f98]">…</div>;
  }
  if (items.length === 0) {
    return <div className="py-8 text-center text-xs text-[#8a8f98]">{tx('no_history')}</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((t) => {
        const Icon = TX_ICON[t.event_type] || History;
        const positive = Number(t.amount) >= 0;
        const label = tx(`tx_${t.event_type}`) === `tx_${t.event_type}` ? tx('tx_other') : tx(`tx_${t.event_type}`);
        const date = new Date(t.created_at).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'lt' ? 'lt-LT' : 'en-GB', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
        return (
          <div key={t.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[rgba(5,5,6,0.5)] border border-[rgba(110,118,220,0.1)]">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${positive ? 'bg-[rgba(34,227,165,0.12)] text-[#22e3a5]' : 'bg-[rgba(255,77,109,0.1)] text-[#ff9fb0]'}`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#d5d6dc] truncate">{label}</div>
              <div className="text-[11px] text-[#8a8f98]">{date}</div>
            </div>
            <div className={`text-[13px] font-bold font-mono shrink-0 ${positive ? 'text-[#22e3a5]' : 'text-[#ff9fb0]'}`}>
              {positive ? '+' : ''}{Number(t.amount).toFixed(3)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
