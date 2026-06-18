import { useEffect, useState, type ReactNode } from 'react';
import { Zap, Pencil, Send, HandCoins, ShoppingCart, Check, X } from 'lucide-react';
import {
  updateProfile, transferPoints, requestPoints, getMyRequests,
  decideRequest, getPackages, purchasePackage, getMe,
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

  const levelName = user.level_name || `${tx('level')} ${user.level ?? 1}`;
  const langLabel = tx(`lang_${user.language || 'ru'}`);

  return (
    <div className="flex flex-col gap-3">
      {/* Balance card */}
      <div
        className="glass rounded-2xl p-5 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(46,168,255,0.12), rgba(56,225,255,0.04))' }}
      >
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Zap className="w-4 h-4 text-[#38e1ff]" strokeWidth={2} />
          <span className="text-[10px] tracking-wide text-[#6b7c9e] uppercase">{tx('balance')}</span>
        </div>
        <div className="text-4xl font-black text-[#38e1ff] text-glow">
          {Number(user.points).toFixed(3)}
        </div>
        <div className="text-[11px] text-[#6b7c9e] tracking-[2px] mt-1 uppercase">{tx('points')}</div>
      </div>

      {/* Info card — TZ tartibi: 1.Level 2.Til 3.ID */}
      <div className="glass rounded-2xl p-4 flex flex-col gap-2.5">
        <ProfileRow label={`1 · ${tx('level')}`} value={levelName} highlight />
        <ProfileRow label={`2 · ${tx('language')}`} value={langLabel} />
        <ProfileRow label={`3 · ${tx('id')}`} value={String(user.telegram_id)} />
        <ProfileRow label={tx('name')} value={user.display_name || user.full_name || '—'} />
        <ProfileRow label={tx('username')} value={user.username ? `@${user.username}` : '—'} />
      </div>

      {/* TZ §4: Psixologik profil (AI analitika) — mavjud bo'lsa ko'rsatish */}
      {(user.focus_of_attention || user.emotional_tone) && (
        <div className="glass rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="text-[11px] font-bold text-[#38e1ff] uppercase tracking-wide mb-1">
            🧠 {lang === 'ru' ? 'Психопрофиль' : lang === 'lt' ? 'Psichotipas' : 'Psychotype'}
          </div>
          {user.focus_of_attention && (
            <ProfileRow
              label={lang === 'ru' ? 'Фокус внимания' : lang === 'lt' ? 'Dėmesio fokusas' : 'Focus'}
              value={
                user.focus_of_attention === 'vnutrenniy'
                  ? (lang === 'ru' ? 'Внутренний' : lang === 'lt' ? 'Vidinis' : 'Internal')
                  : (lang === 'ru' ? 'Внешний' : lang === 'lt' ? 'Išorinis' : 'External')
              }
            />
          )}
          {user.emotional_tone && (
            <ProfileRow
              label={lang === 'ru' ? 'Эмоц. тон' : lang === 'lt' ? 'Emocinis tonas' : 'Emotion'}
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
            <ProfileRow
              label={lang === 'ru' ? 'Тема' : lang === 'lt' ? 'Tema' : 'Topic'}
              value={user.key_topic}
            />
          )}
        </div>
      )}

      {/* Tahrirlash */}
      <button
        onClick={() => setModal('edit')}
        className="glass rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-semibold text-[#dbe9ff] hover:border-[rgba(56,225,255,0.3)] transition-all active:scale-[0.98]"
      >
        <Pencil className="w-4 h-4 text-[#38e1ff]" /> {tx('edit')}
      </button>

      {/* Point amallar */}
      <div className="grid grid-cols-3 gap-2">
        <ActionBtn icon={HandCoins} label={tx('request')} onClick={() => setModal('request')} />
        <ActionBtn icon={Send} label={tx('give')} onClick={() => setModal('give')} />
        <ActionBtn icon={ShoppingCart} label={tx('buy')} onClick={() => setModal('buy')} />
      </div>

      {/* Menga kelgan so'rovlar */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold text-[#38e1ff] uppercase tracking-wide">{tx('requests')}</div>
        {requests.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-center text-xs text-[#6b7c9e]">{tx('no_req')}</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-3.5">
              <div className="text-sm text-[#dbe9ff]">
                <b>{r.from_display_name || `#${r.from_user_id}`}</b> {tx('from_you')}{' '}
                <b className="text-[#38e1ff]">{Number(r.amount).toFixed(3)}</b>
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
        <a href="/admin" className="glass rounded-2xl py-3 text-center text-sm font-bold text-[#38e1ff] hover:border-[rgba(56,225,255,0.3)] transition-all">
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

function ProfileRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-[#6b7c9e]">{label}</span>
      {highlight ? (
        <span className="px-2.5 py-0.5 rounded-lg bg-[rgba(56,225,255,0.12)] text-[#38e1ff] text-xs font-bold">{value}</span>
      ) : (
        <span className="font-medium text-[#dbe9ff]">{value}</span>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: typeof Send; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass rounded-2xl py-3 flex flex-col items-center gap-1.5 active:scale-[0.97] hover:border-[rgba(56,225,255,0.3)] transition-all">
      <Icon className="w-5 h-5 text-[#38e1ff]" />
      <span className="text-[10px] text-[#dbe9ff] text-center leading-tight">{label}</span>
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

function BuyModal({ tx, packages, onClose, onDone, onError }: { tx: TX; packages: PointPackage[]; onClose: () => void; onDone: () => void; onError: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  async function buy(id: number) {
    setBusy(id);
    try { await purchasePackage(id); onDone(); }
    catch { onError(); } finally { setBusy(null); }
  }
  return (
    <ModalShell title={tx('buy')} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {packages.map((p) => (
          <button key={p.id} onClick={() => buy(p.id)} disabled={busy !== null}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-[rgba(80,160,255,0.18)] bg-[rgba(6,10,20,0.5)] active:scale-[0.98] disabled:opacity-50">
            <span className="font-semibold text-[#dbe9ff]">{p.label}</span>
            <span className="text-[#38e1ff] font-bold">€{Number(p.price_eur).toFixed(2)}</span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
