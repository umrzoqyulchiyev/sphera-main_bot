import { useEffect, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import {
  updateProfile, transferPoints, requestPoints, getMyRequests,
  decideRequest, getPackages, getMe,
} from '../../lib/api';
import { getLang } from '../../lib/i18n';
import type { User, PointsRequest, PointPackage } from '../../types';

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
  },
  en: {
    balance: 'Your balance', points: 'Points', level: 'Level', language: 'Language', id: 'ID',
    name: 'Name', username: 'Username', edit: 'Edit profile', save: 'Save',
    request: 'Request', give: 'Send', buy: 'Buy', requests: 'Requests to me',
    user_id: 'User ID', amount: 'Amount', msg: 'Message', approve: 'Approve',
    reject: 'Reject', no_req: 'No new requests', from_you: 'requests from you',
    admin: '👑 Admin Panel', saved: 'Saved', sent: 'Sent', error: 'Error', requested: 'Request sent',
    lang_ru: 'Русский', lang_en: 'English', lang_lt: 'Lietuvių',
  },
  lt: {
    balance: 'Jūsų balansas', points: 'Taškai', level: 'Lygis', language: 'Kalba', id: 'ID',
    name: 'Vardas', username: 'Slapyvardis', edit: 'Redaguoti profilį', save: 'Išsaugoti',
    request: 'Prašyti', give: 'Siųsti', buy: 'Pirkti', requests: 'Prašymai man',
    user_id: 'Vartotojo ID', amount: 'Kiekis', msg: 'Žinutė', approve: 'Patvirtinti',
    reject: 'Atmesti', no_req: 'Naujų prašymų nėra', from_you: 'prašo iš jūsų',
    admin: '👑 Admin Panel', saved: 'Išsaugota', sent: 'Išsiųsta', error: 'Klaida', requested: 'Prašymas išsiųstas',
    lang_ru: 'Русский', lang_en: 'English', lang_lt: 'Lietuvių',
  },
};

type Modal = null | 'edit' | 'give' | 'request' | 'buy';

export function ProfileScreen({ user, onUserUpdate }: ProfileScreenProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const [modal, setModal] = useState<Modal>(null);
  const [requests, setRequests] = useState<PointsRequest[]>([]);
  const [packages, setPackages] = useState<PointPackage[]>([]);
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
        <div className="text-[#6b7c9e] text-sm">Loading...</div>
      </div>
    );
  }

  const langLabel = tx(`lang_${user.language || 'ru'}`);

  // Level → rol nomi (TZ: 1/2 Слушатель, 3 Слушатель и ведущий)
  const lvl = user.level ?? 1;
  const levelDisplay =
    lvl >= 3
      ? (lang === 'ru' ? 'Слушатель и ведущий' : lang === 'lt' ? 'Klausytojas ir vedėjas' : 'Listener & Host')
      : (lang === 'ru' ? 'Слушатель' : lang === 'lt' ? 'Klausytojas' : 'Listener');

  return (
    <div className="flex flex-col gap-6">
      {/* Balance card — avatar + neon balance (Stitch) */}
      <section className="stitch-card p-8 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#38e1ff]/5 to-transparent pointer-events-none" />
        <div className="relative z-10 w-full flex flex-col items-center justify-center">
          {/* Avatar */}
          <div className="w-28 h-28 rounded-full overflow-hidden avatar-glow bg-[rgba(37,42,53,0.5)] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#38e1ff]/50" style={{ fontSize: 48 }}>person</span>
          </div>
          <h2 className="text-[11px] text-[#bbc9cd] tracking-[0.2em] uppercase opacity-80 mb-2 font-mono">{tx('balance')}</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-[48px] font-extrabold text-[#27d9f7] neon-glow-text font-mono">
              {Number(user.points).toFixed(3)}
            </span>
            <span className="text-[18px] font-semibold text-[#c2f3ff]">PTS</span>
          </div>
        </div>
      </section>

      {/* Info rows — Level / Language / ID / Name / Username (TZ tartibi) */}
      <section className="stitch-card p-6 flex flex-col">
        <StitchRow icon="military_tech" label={tx('level')} value={levelDisplay} highlight />
        <StitchRow icon="language" label={tx('language')} value={langLabel} />
        <StitchRow icon="badge" label={tx('id')} value={String(user.telegram_id)} mono />
        <StitchRow icon="person" label={tx('name')} value={user.display_name || user.full_name || '—'} />
        <StitchRow icon="alternate_email" label={tx('username')} value={user.username ? `@${user.username}` : '—'} accent last />
      </section>

      {/* Psixoprofil — mavjud bo'lsa */}
      {(user.focus_of_attention || user.emotional_tone) && (
        <section className="stitch-card p-6 flex flex-col">
          <div className="text-[11px] font-bold text-[#27d9f7] uppercase tracking-wide mb-2 font-mono">
            🧠 {lang === 'ru' ? 'Психопрофиль' : lang === 'lt' ? 'Psichotipas' : 'Psychotype'}
          </div>
          {user.focus_of_attention && (
            <StitchRow icon="center_focus_strong"
              label={lang === 'ru' ? 'Фокус' : lang === 'lt' ? 'Fokusas' : 'Focus'}
              value={
                user.focus_of_attention === 'vnutrenniy'
                  ? (lang === 'ru' ? 'Внутренний' : lang === 'lt' ? 'Vidinis' : 'Internal')
                  : (lang === 'ru' ? 'Внешний' : lang === 'lt' ? 'Išorinis' : 'External')
              }
            />
          )}
          {user.emotional_tone && (
            <StitchRow icon="mood"
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
            <StitchRow icon="tag"
              label={lang === 'ru' ? 'Тема' : lang === 'lt' ? 'Tema' : 'Topic'}
              value={user.key_topic} last
            />
          )}
        </section>
      )}

      {/* Tahrirlash */}
      <button
        onClick={() => setModal('edit')}
        className="stitch-card py-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-[#dfe2f1] active:scale-[0.98] transition-transform"
      >
        <span className="material-symbols-outlined text-[#38e1ff]" style={{ fontSize: 20 }}>edit</span>
        {tx('edit')}
      </button>

      {/* Point amallar — Request / Send / Buy (Stitch) */}
      <section className="grid grid-cols-3 gap-4">
        <StitchAction icon="arrow_downward" label={tx('request')} onClick={() => setModal('request')} />
        <StitchAction icon="arrow_upward" label={tx('give')} onClick={() => setModal('give')} />
        <button
          onClick={() => setModal('buy')}
          className="rounded-[20px] p-4 flex flex-col items-center justify-center gap-2.5 btn-primary-glow active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 28 }}>shopping_cart</span>
          <span className="text-[11px] font-bold tracking-wider font-mono">{tx('buy')}</span>
        </button>
      </section>

      {/* Menga kelgan so'rovlar */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold text-[#27d9f7] uppercase tracking-wide font-mono">{tx('requests')}</div>
        {requests.length === 0 ? (
          <div className="stitch-card p-4 text-center text-xs text-[#6b7c9e]">{tx('no_req')}</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="stitch-card p-3.5">
              <div className="text-sm text-[#dfe2f1]">
                <b>{r.from_display_name || `#${r.from_user_id}`}</b> {tx('from_you')}{' '}
                <b className="text-[#27d9f7]">{Number(r.amount).toFixed(3)}</b>
              </div>
              {r.message && <div className="text-xs text-[#6b7c9e] mt-1">{r.message}</div>}
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
        <a href="/admin" className="stitch-card py-3 text-center text-sm font-bold text-[#27d9f7] transition-all">
          {tx('admin')}
        </a>
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

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-xl text-sm text-[#dbe9ff] border border-[rgba(56,225,255,0.4)] z-[200]">
          {toast}
        </div>
      )}
    </div>
  );
}

// Stitch dizayni: ikonka + label (chap), value (o'ng), pastki chiziq
function StitchRow({ icon, label, value, highlight, accent, mono, last }: {
  icon: string; label: string; value: string;
  highlight?: boolean; accent?: boolean; mono?: boolean; last?: boolean;
}) {
  return (
    <div
      className="flex justify-between items-center py-4"
      style={last ? {} : { borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-[15px] text-[#bbc9cd] flex items-center gap-3">
        <span className="material-symbols-outlined text-[#859397]" style={{ fontSize: 20 }}>{icon}</span>
        {label}
      </span>
      {highlight ? (
        <span className="px-3 py-1 rounded-lg bg-[rgba(56,225,255,0.12)] text-[#38e1ff] text-[13px] font-bold">{value}</span>
      ) : (
        <span className={`text-[15px] font-semibold ${accent ? 'text-[#98cbff]' : 'text-[#dfe2f1]'} ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function StitchAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="stitch-card p-4 flex flex-col items-center justify-center gap-2.5 active:scale-95 transition-transform"
    >
      <span className="material-symbols-outlined text-[#38e1ff]" style={{ fontSize: 28 }}>{icon}</span>
      <span className="text-[11px] text-[#dfe2f1] tracking-wider font-mono">{label}</span>
    </button>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[360px] glass rounded-3xl p-5 bg-[#0e1729]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-[#38e1ff] mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-[rgba(6,10,20,0.7)] border border-[rgba(80,160,255,0.18)] rounded-xl px-4 py-3 text-sm text-[#dbe9ff] outline-none focus:border-[#38e1ff] mb-3';
const primaryBtn = 'w-full py-3 rounded-xl font-bold text-[#02101f] text-sm';
const primaryStyle = { background: 'linear-gradient(135deg, #2ea8ff, #38e1ff)' };
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
      <label className="text-xs text-[#6b7c9e]">{tx('name')}</label>
      <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      <label className="text-xs text-[#6b7c9e]">{tx('username')}</label>
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
      <label className="text-xs text-[#6b7c9e]">{tx('user_id')}</label>
      <input className={inputCls} value={toId} onChange={(e) => setToId(e.target.value)} inputMode="numeric" />
      <label className="text-xs text-[#6b7c9e]">{tx('amount')}</label>
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
      <label className="text-xs text-[#6b7c9e]">{tx('user_id')}</label>
      <input className={inputCls} value={fromId} onChange={(e) => setFromId(e.target.value)} inputMode="numeric" />
      <label className="text-xs text-[#6b7c9e]">{tx('amount')}</label>
      <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      <label className="text-xs text-[#6b7c9e]">{tx('msg')}</label>
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
      tg.openTelegramLink('https://t.me/sfera5radio_bot?start=buy');
      tg.close?.();
    } else {
      window.open('https://t.me/sfera5radio_bot', '_blank');
    }
  }

  return (
    <ModalShell title={tx('buy')} onClose={onClose}>
      <p className="text-xs text-[#8b9bb3] mb-3 leading-relaxed">
        {/* Ru/En/Lt — to'lov bot orqali */}
        Оплата проходит через бота безопасно (Telegram Payments).
        Нажмите кнопку — откроется бот с пакетами.
      </p>
      <div className="flex flex-col gap-2 mb-3">
        {packages.map((p) => (
          <div key={p.id}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-[rgba(80,160,255,0.18)] bg-[rgba(6,10,20,0.5)]">
            <span className="font-semibold text-[#dbe9ff]">{p.label}</span>
            <span className="text-[#38e1ff] font-bold">⭐{Number(p.price_eur).toFixed(0)}</span>
          </div>
        ))}
      </div>
      <button className={primaryBtn} style={primaryStyle} onClick={buyViaBot}>
        {tx('buy')} →
      </button>
    </ModalShell>
  );
}
