import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, X, Plus, ArrowLeft, Lock, UserPlus, Crown, Trash2 } from 'lucide-react';
import {
  getRooms, createRoom, closeRoom, deleteRoom, getRoomMessages, sendRoomMessage, sendRoomVoice,
  getRoomMembers, inviteToRoom, kickFromRoom, type RoomMember,
} from '../../lib/api';
import { getLang } from '../../lib/i18n';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { FullScreenModal } from '../ui/FullScreenModal';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import type { User, ChatRoom, ChatMessage } from '../../types';

const L: Record<string, Record<string, string>> = {
  ru: {
    rooms: 'Группы', create: 'Создать группу', no_rooms: 'Пока нет активных групп',
    title_ph: 'Название группы', desc_ph: 'Описание (необязательно)',
    host_only: 'Создавать группы может только ведущий', close_room: 'Закрыть группу',
    confirm_close: 'Закрыть эту группу? Новые сообщения будут недоступны.',
    cancel: 'Отмена', confirm: 'Подтвердить', by: 'Ведущий',
    members: 'Участники', invite_ph: 'Telegram ID', invite: 'Пригласить',
    invite_hint: 'ID виден в профиле пользователя', kick_confirm: 'Исключить этого участника из группы?',
    removed_from_room: 'Вас исключили из группы', no_members: 'Пока нет участников',
    you_are_kicked: 'Больше нет доступа к этой группе', back: 'Назад',
    delete_room: 'Удалить группу', confirm_delete_room: 'Удалить эту группу навсегда? Вся переписка будет стёрта без возможности восстановить.',
  },
  en: {
    rooms: 'Groups', create: 'Create group', no_rooms: 'No active groups yet',
    title_ph: 'Group title', desc_ph: 'Description (optional)',
    host_only: 'Only hosts can create groups', close_room: 'Close group',
    confirm_close: 'Close this group? New messages will be unavailable.',
    cancel: 'Cancel', confirm: 'Confirm', by: 'Host',
    members: 'Members', invite_ph: 'Telegram ID', invite: 'Invite',
    invite_hint: 'ID is shown on the user\'s profile', kick_confirm: 'Remove this member from the group?',
    removed_from_room: 'You were removed from the group', no_members: 'No members yet',
    you_are_kicked: 'No longer have access to this group', back: 'Back',
    delete_room: 'Delete group', confirm_delete_room: 'Permanently delete this group? All messages will be erased and cannot be recovered.',
  },
  lt: {
    rooms: 'Grupės', create: 'Sukurti grupę', no_rooms: 'Kol kas nėra aktyvių grupių',
    title_ph: 'Grupės pavadinimas', desc_ph: 'Aprašymas (neprivalomas)',
    host_only: 'Grupes gali kurti tik vedėjas', close_room: 'Uždaryti grupę',
    confirm_close: 'Uždaryti šią grupę? Naujos žinutės bus nepasiekiamos.',
    cancel: 'Atšaukti', confirm: 'Patvirtinti', by: 'Vedėjas',
    members: 'Nariai', invite_ph: 'Telegram ID', invite: 'Pakviesti',
    invite_hint: 'ID matomas vartotojo profilyje', kick_confirm: 'Pašalinti šį narį iš grupės?',
    removed_from_room: 'Jūs buvote pašalintas iš grupės', no_members: 'Kol kas nėra narių',
    you_are_kicked: 'Nebeturite prieigos prie šios grupės', back: 'Atgal',
    delete_room: 'Ištrinti grupę', confirm_delete_room: 'Visam laikui ištrinti šią grupę? Visas susirašinėjimas bus ištrintas negrįžtamai.',
  },
};

const ROOM_POLL_MS = 3000;

interface RoomsButtonProps {
  user: User | null;
  isLive?: boolean;
}

// O'zi holatini boshqaradigan komponent — chaqiruvchi ekran faqat
// <RoomsButton user={user} /> qo'yadi, qolgan hammasi shu ichida.
export function RoomsButton({ user, isLive }: RoomsButtonProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const [showList, setShowList] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);

  return (
    <>
      <button
        onClick={() => setShowList(true)}
        className="stitch-card px-3.5 py-2 flex items-center gap-1.5 text-[11px] font-bold text-[#F97316] active:scale-95 transition-transform shrink-0"
      >
        <Users size={14} />
        {tx('rooms')}
      </button>

      {showList && !activeRoom && (
        <RoomsListModal
          user={user}
          tx={tx}
          onClose={() => setShowList(false)}
          onOpenRoom={(room) => setActiveRoom(room)}
        />
      )}

      {activeRoom && (
        <RoomChatModal
          room={activeRoom}
          user={user}
          tx={tx}
          onClose={() => setActiveRoom(null)}
          onClosedRoom={() => { setActiveRoom(null); }}
          isLive={isLive}
        />
      )}
    </>
  );
}

function RoomsListModal({ user, tx, onClose, onOpenRoom }: {
  user: User | null; tx: (k: string) => string; onClose: () => void; onOpenRoom: (r: ChatRoom) => void;
}) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatRoom | null>(null);
  const [deleting, setDeleting] = useState(false);
  const canCreate = user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'doverenniy' || (user?.level ?? 1) >= 3;
  const canDelete = (r: ChatRoom) => !!user && (r.host_user_id === user.id || user.role === 'admin' || user.role === 'moderator');

  const load = useCallback(() => {
    getRooms().then(setRooms).catch(() => setRooms([])).finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteRoom(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch {
      // xatolik bo'lsa ham modal yopiladi — ro'yxat qayta yuklanganda
      // guruh hali turgan bo'lsa, foydalanuvchi qayta urinib ko'radi
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  // Telegram'ning tabiiy "orqaga" tugmasi — tepadagi DOM tugmasi ba'zi
  // klientlarda native "Закрыть" paneli bilan to'qnashib bosilmay
  // qolishi mumkin, shuning uchun kafolatlangan qo'shimcha yo'l.
  useTelegramBackButton(true, onClose);

  return (
    <FullScreenModal zIndex={500}>
      {/* Yuqoridan qo'shimcha bo'sh joy — Telegram'ning o'z "⋮ ⌄ ✕" native
          paneli aynan shu burchakda bo'lgani uchun, tugmalar (ayniqsa
          "Создать") shu bilan to'qnashib bosilmay qolmasin. */}
      <div className="flex items-center gap-3 px-4 pb-3 border-b" style={{ borderColor: 'rgba(148,163,184,0.12)', paddingTop: 'calc(76px + env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(148,163,184,0.1)' }}>
          <ArrowLeft className="w-4 h-4 text-[#F8FAFC]" />
        </button>
        <div className="flex-1 text-sm font-bold text-[#F8FAFC]">{tx('rooms')}</div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(148,163,184,0.1)' }}
          >
            <Plus className="w-4 h-4 text-[#F8FAFC]" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="text-center text-xs text-[#94A3B8] py-8">…</div>
        ) : rooms.length === 0 ? (
          <div className="text-center text-xs text-[#94A3B8] py-8">{tx('no_rooms')}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((r) => (
              <div key={r.id} className="relative">
                <button
                  onClick={() => onOpenRoom(r)}
                  className="w-full glass rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
                  style={canDelete(r) ? { paddingRight: '3rem' } : undefined}
                >
                  <div className="text-sm font-bold text-[#F8FAFC]">{r.title}</div>
                  {r.description && <div className="text-[11px] text-[#94A3B8] mt-1">{r.description}</div>}
                  <div className="text-[10px] text-[#F97316] mt-1.5">{tx('by')}: {r.host_display_name || '—'}</div>
                </button>
                {canDelete(r) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(r); }}
                    aria-label={tx('delete_room')}
                    className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.1)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#FCA5A5]" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pastki "Закрыть" — tepadagi orqaga tugmasi native chrome bilan
          to'qnashsa ham, bu zona (ekran pastida) doim bosiladi. */}
      <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'rgba(148,163,184,0.12)' }}>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[#94A3B8] active:scale-[0.98] transition-transform"
          style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.14)' }}
        >
          Закрыть
        </button>
      </div>

      {showCreate && (
        <CreateRoomModal
          tx={tx}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !deleting && setPendingDelete(null)}>
          <div className="w-full max-w-[340px] glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-[#94A3B8] mb-5">{tx('confirm_delete_room')}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setPendingDelete(null)} disabled={deleting} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#94A3B8] glass disabled:opacity-50">
                {tx('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #F87171, #EF4444)' }}
              >
                {tx('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FullScreenModal>
  );
}

function CreateRoomModal({ tx, onClose, onCreated }: {
  tx: (k: string) => string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await createRoom(title.trim(), desc.trim());
      onCreated();
    } catch (e: any) {
      setError(e.message === 'Requires role \'doverenniy\' or higher' ? tx('host_only') : (e.message || 'Error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[550] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[360px] glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#F97316]">{tx('create')}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tx('title_ph')}
          className="w-full bg-[rgba(15,15,35,0.7)] border border-[rgba(249,115,22,0.18)] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] outline-none focus:border-[#F97316] mb-3"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={tx('desc_ph')}
          className="w-full bg-[rgba(15,15,35,0.7)] border border-[rgba(249,115,22,0.18)] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] outline-none focus:border-[#F97316] mb-3"
        />
        {error && <div className="text-xs text-[#FCA5A5] mb-3">{error}</div>}
        <button
          onClick={submit}
          disabled={busy || !title.trim()}
          className="w-full py-3 rounded-xl font-bold text-[#020203] text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
        >
          {tx('create')}
        </button>
      </div>
    </div>
  );
}

function RoomChatModal({ room, user, tx, onClose, onClosedRoom, isLive }: {
  room: ChatRoom; user: User | null; tx: (k: string) => string; onClose: () => void; onClosedRoom: () => void;
  isLive?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingClose, setPendingClose] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [kicked, setKicked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isHost = !!user && (room.host_user_id === user.id || user.role === 'admin' || user.role === 'moderator');

  const load = useCallback(() => {
    getRoomMessages(room.id).then(setMessages).catch((e: any) => {
      // 403 — chetlatilgan (endi a'zo emas), 404 — guruh yopilgan/o'chirilgan.
      // Ikkalasida ham polling'ni davom ettirishning ma'nosi yo'q.
      if (e?.status === 403 || e?.status === 404) setKicked(true);
    });
  }, [room.id]);

  useEffect(() => {
    if (kicked) return;
    load();
    const interval = setInterval(load, ROOM_POLL_MS);
    return () => clearInterval(interval);
  }, [load, kicked]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Telegram'ning tabiiy "orqaga" tugmasi — kafolatlangan qo'shimcha yo'l
  // (tepadagi DOM tugmasi native chrome bilan to'qnashsa ham ishlaydi).
  useTelegramBackButton(true, onClose);

  // Rooms'da WS yo'q (v1 — polling), shuning uchun "keyingi load() eskirgan
  // optimistik yozuvni asl ro'yxat bilan almashtiradi" prinsipiga tayanamiz —
  // xabar darhol ko'rinadi, xato bo'lsa olib tashlanadi.
  async function handleSendText(msg: string) {
    const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
    setMessages((prev) => [...prev, {
      id: tempId,
      username: user?.username ?? null,
      display_name: user?.display_name || user?.full_name || null,
      message: msg,
      message_type: 'text',
      voice_url: null,
      created_at: new Date().toISOString(),
      status: 'sent',
    }]);
    try { await sendRoomMessage(room.id, msg); load(); }
    catch { setMessages((prev) => prev.filter((m) => m.id !== tempId)); }
  }

  async function handleSendVoice(blob: Blob) {
    const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
    const blobUrl = URL.createObjectURL(blob);
    setMessages((prev) => [...prev, {
      id: tempId,
      username: user?.username ?? null,
      display_name: user?.display_name || user?.full_name || null,
      message: '',
      message_type: 'voice',
      voice_url: blobUrl,
      created_at: new Date().toISOString(),
      status: 'sent',
    }]);
    try { await sendRoomVoice(room.id, blob); load(); }
    catch { setMessages((prev) => prev.filter((m) => m.id !== tempId)); }
  }

  return (
    <FullScreenModal zIndex={500}>
      <div className="flex items-center gap-3 px-4 pb-3 border-b" style={{ borderColor: 'rgba(148,163,184,0.12)', paddingTop: 'calc(76px + env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(148,163,184,0.1)' }}>
          <ArrowLeft className="w-4 h-4 text-[#F8FAFC]" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[#F8FAFC] truncate">{room.title}</div>
          <div className="text-[10px] text-[#94A3B8]">{tx('by')}: {room.host_display_name || '—'}</div>
        </div>
        {!kicked && (
          <button
            onClick={() => setShowMembers(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(148,163,184,0.1)' }}
            aria-label={tx('members')}
          >
            <Users className="w-4 h-4 text-[#F8FAFC]" />
          </button>
        )}
        {isHost && !kicked && (
          <button
            onClick={() => setPendingClose(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)' }}
            aria-label={tx('close_room')}
          >
            <Lock className="w-4 h-4 text-[#FCA5A5]" />
          </button>
        )}
      </div>

      {kicked ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
          <div className="text-sm text-[#94A3B8]">{tx('you_are_kicked')}</div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#94A3B8]"
            style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.16)' }}
          >
            {tx('back')}
          </button>
        </div>
      ) : (
      <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.map((m) => (
          <ChatMessageComponent key={m.id} message={m} currentUser={user} />
        ))}
      </div>

      {/* Chapdagi ✕ — tepadagi orqaga tugmasi native "Закрыть" paneli
          bilan to'qnashib bosilmay qolgan hollar uchun kafolatlangan
          chiqish (bu zona kirish maydoni bilan bir xil — doim bosiladi). */}
      <div className="px-4 pb-6 pt-3 border-t flex items-center gap-2" style={{ borderColor: 'rgba(148,163,184,0.12)' }}>
        <button
          onClick={onClose}
          aria-label="Закрыть чат"
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(148,163,184,0.1)' }}
        >
          <X className="w-4 h-4 text-[#94A3B8]" />
        </button>
        <div className="flex-1 min-w-0">
          <ChatInput
            onSendMessage={(msg) => handleSendText(msg)}
            onSendVoice={handleSendVoice}
            onToast={() => {}}
            city=""
            micDisabled={isLive}
          />
        </div>
      </div>
      </>
      )}

      {showMembers && (
        <RoomMembersModal
          room={room}
          user={user}
          tx={tx}
          isHost={!!isHost}
          onClose={() => setShowMembers(false)}
          onSelfRemoved={() => { setShowMembers(false); setKicked(true); }}
        />
      )}

      {pendingClose && (
        <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPendingClose(false)}>
          <div className="w-full max-w-[340px] glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-[#94A3B8] mb-5">{tx('confirm_close')}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setPendingClose(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#94A3B8] glass">
                {tx('cancel')}
              </button>
              <button
                onClick={async () => { await closeRoom(room.id).catch(() => {}); setPendingClose(false); onClosedRoom(); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #F87171, #EF4444)' }}
              >
                {tx('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FullScreenModal>
  );
}

// ── RoomMembersModal — a'zolar ro'yxati + xost/staff uchun taklif/chetlatish.
// Guruh YOPIQ: har bir a'zo ro'yxatni ko'radi, lekin faqat xost/admin/moderator
// birovni qo'sha yoki chiqara oladi (backendda ham xuddi shu tekshiruv).
function RoomMembersModal({ room, user, tx, isHost, onClose, onSelfRemoved }: {
  room: ChatRoom; user: User | null; tx: (k: string) => string; isHost: boolean;
  onClose: () => void; onSelfRemoved: () => void;
}) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteId, setInviteId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [pendingKick, setPendingKick] = useState<RoomMember | null>(null);
  const [kicking, setKicking] = useState(false);

  const load = useCallback(() => {
    getRoomMembers(room.id).then(setMembers).catch(() => {}).finally(() => setLoading(false));
  }, [room.id]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite() {
    const tgId = parseInt(inviteId.trim(), 10);
    if (!tgId) return;
    setInviting(true);
    setError('');
    try {
      await inviteToRoom(room.id, tgId);
      setInviteId('');
      load();
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setInviting(false);
    }
  }

  async function handleKick() {
    if (!pendingKick) return;
    setKicking(true);
    try {
      await kickFromRoom(room.id, pendingKick.user_id);
      if (user && pendingKick.user_id === user.id) {
        onSelfRemoved();
        return;
      }
      setPendingKick(null);
      load();
    } catch {
      setPendingKick(null);
    } finally {
      setKicking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[400px] max-h-[80vh] flex flex-col glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-base font-bold text-[#F8FAFC]">{tx('members')}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] text-[#94A3B8]">
            <X size={16} />
          </button>
        </div>

        {isHost && (
          <div className="mb-3 shrink-0">
            <div className="flex gap-2">
              <input
                value={inviteId}
                onChange={(e) => setInviteId(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder={tx('invite_ph')}
                inputMode="numeric"
                className="flex-1 bg-[rgba(15,15,35,0.7)] border border-[rgba(249,115,22,0.18)] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#F97316]"
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteId.trim()}
                className="px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-[#1B1204] disabled:opacity-40 shrink-0"
                style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
              >
                <UserPlus className="w-3.5 h-3.5" /> {tx('invite')}
              </button>
            </div>
            <div className="text-[10px] text-[#94A3B8] mt-1.5">{tx('invite_hint')}</div>
            {error && <div className="text-[11px] text-[#FCA5A5] mt-1.5">{error}</div>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {loading ? (
            <div className="text-center text-xs text-[#94A3B8] py-6">…</div>
          ) : members.length === 0 ? (
            <div className="text-center text-xs text-[#94A3B8] py-6">{tx('no_members')}</div>
          ) : members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(15,15,35,0.5)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#F8FAFC] truncate">
                  {m.display_name || m.username || `ID ${m.telegram_id}`}
                </div>
              </div>
              {m.is_host && <Crown className="w-3.5 h-3.5 text-[#F97316] shrink-0" />}
              {isHost && !m.is_host && (
                <button
                  onClick={() => setPendingKick(m)}
                  className="p-1.5 rounded-lg bg-[rgba(239,68,68,0.1)] text-[#FCA5A5] shrink-0"
                  aria-label={tx('kick_confirm')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {pendingKick && (
          <div className="fixed inset-0 z-[650] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPendingKick(null)}>
            <div className="w-full max-w-[340px] glass rounded-3xl p-5 bg-[#1B1B30]" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-[#94A3B8] mb-5">{tx('kick_confirm')}</p>
              <div className="flex gap-2.5">
                <button onClick={() => setPendingKick(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#94A3B8] glass">
                  {tx('cancel')}
                </button>
                <button
                  onClick={handleKick}
                  disabled={kicking}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #F87171, #EF4444)' }}
                >
                  {tx('confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
