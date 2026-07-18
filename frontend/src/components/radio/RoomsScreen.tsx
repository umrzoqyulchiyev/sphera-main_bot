import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, X, Plus, ArrowLeft, Lock } from 'lucide-react';
import {
  getRooms, createRoom, closeRoom, getRoomMessages, sendRoomMessage, sendRoomVoice,
} from '../../lib/api';
import { getLang } from '../../lib/i18n';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { FullScreenModal } from '../ui/FullScreenModal';
import type { User, ChatRoom, ChatMessage } from '../../types';

const L: Record<string, Record<string, string>> = {
  ru: {
    rooms: 'Группы', create: 'Создать группу', no_rooms: 'Пока нет активных групп',
    title_ph: 'Название группы', desc_ph: 'Описание (необязательно)',
    host_only: 'Создавать группы может только ведущий', close_room: 'Закрыть группу',
    confirm_close: 'Закрыть эту группу? Новые сообщения будут недоступны.',
    cancel: 'Отмена', confirm: 'Подтвердить', by: 'Ведущий',
  },
  en: {
    rooms: 'Groups', create: 'Create group', no_rooms: 'No active groups yet',
    title_ph: 'Group title', desc_ph: 'Description (optional)',
    host_only: 'Only hosts can create groups', close_room: 'Close group',
    confirm_close: 'Close this group? New messages will be unavailable.',
    cancel: 'Cancel', confirm: 'Confirm', by: 'Host',
  },
  lt: {
    rooms: 'Grupės', create: 'Sukurti grupę', no_rooms: 'Kol kas nėra aktyvių grupių',
    title_ph: 'Grupės pavadinimas', desc_ph: 'Aprašymas (neprivalomas)',
    host_only: 'Grupes gali kurti tik vedėjas', close_room: 'Uždaryti grupę',
    confirm_close: 'Uždaryti šią grupę? Naujos žinutės bus nepasiekiamos.',
    cancel: 'Atšaukti', confirm: 'Patvirtinti', by: 'Vedėjas',
  },
};

const ROOM_POLL_MS = 3000;

interface RoomsButtonProps {
  user: User | null;
}

// O'zi holatini boshqaradigan komponent — chaqiruvchi ekran faqat
// <RoomsButton user={user} /> qo'yadi, qolgan hammasi shu ichida.
export function RoomsButton({ user }: RoomsButtonProps) {
  const lang = getLang();
  const tx = (k: string) => L[lang]?.[k] || L.ru[k] || k;
  const [showList, setShowList] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);

  return (
    <>
      <button
        onClick={() => setShowList(true)}
        className="stitch-card px-3.5 py-2 flex items-center gap-1.5 text-[11px] font-bold text-[#5e6ad2] active:scale-95 transition-transform shrink-0"
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
  const canCreate = user?.role === 'admin' || user?.role === 'doverenniy' || (user?.level ?? 1) >= 3;

  const load = useCallback(() => {
    getRooms().then(setRooms).catch(() => setRooms([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <FullScreenModal zIndex={500}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(94,106,210,0.1)' }}>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(94,106,210,0.08)' }}>
          <ArrowLeft className="w-4 h-4 text-[#5e6ad2]" />
        </button>
        <div className="flex-1 text-sm font-bold text-[#ededef]">{tx('rooms')}</div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(94,106,210,0.12)' }}
          >
            <Plus className="w-4 h-4 text-[#5e6ad2]" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="text-center text-xs text-[#8a8f98] py-8">…</div>
        ) : rooms.length === 0 ? (
          <div className="text-center text-xs text-[#8a8f98] py-8">{tx('no_rooms')}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => onOpenRoom(r)}
                className="glass rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
              >
                <div className="text-sm font-bold text-[#ededef]">{r.title}</div>
                {r.description && <div className="text-[11px] text-[#8a8f98] mt-1">{r.description}</div>}
                <div className="text-[10px] text-[#5e6ad2] mt-1.5">{tx('by')}: {r.host_display_name || '—'}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRoomModal
          tx={tx}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
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
      <div className="w-full max-w-[360px] glass rounded-3xl p-5 bg-[#101014]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#5e6ad2]">{tx('create')}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.06)] text-[#9a9fa8]">
            <X size={16} />
          </button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tx('title_ph')}
          className="w-full bg-[rgba(5,5,6,0.7)] border border-[rgba(110,118,220,0.18)] rounded-xl px-4 py-3 text-sm text-[#ededef] outline-none focus:border-[#5e6ad2] mb-3"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={tx('desc_ph')}
          className="w-full bg-[rgba(5,5,6,0.7)] border border-[rgba(110,118,220,0.18)] rounded-xl px-4 py-3 text-sm text-[#ededef] outline-none focus:border-[#5e6ad2] mb-3"
        />
        {error && <div className="text-xs text-[#ff9fb0] mb-3">{error}</div>}
        <button
          onClick={submit}
          disabled={busy || !title.trim()}
          className="w-full py-3 rounded-xl font-bold text-[#020203] text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7b85e8, #5e6ad2)' }}
        >
          {tx('create')}
        </button>
      </div>
    </div>
  );
}

function RoomChatModal({ room, user, tx, onClose, onClosedRoom }: {
  room: ChatRoom; user: User | null; tx: (k: string) => string; onClose: () => void; onClosedRoom: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingClose, setPendingClose] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isHost = user && (room.host_user_id === user.id || user.role === 'admin');

  const load = useCallback(() => {
    getRoomMessages(room.id).then(setMessages).catch(() => {});
  }, [room.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, ROOM_POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(94,106,210,0.1)' }}>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(94,106,210,0.08)' }}>
          <ArrowLeft className="w-4 h-4 text-[#5e6ad2]" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[#ededef] truncate">{room.title}</div>
          <div className="text-[10px] text-[#8a8f98]">{tx('by')}: {room.host_display_name || '—'}</div>
        </div>
        {isHost && (
          <button
            onClick={() => setPendingClose(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,77,109,0.1)' }}
            aria-label={tx('close_room')}
          >
            <Lock className="w-4 h-4 text-[#ff9fb0]" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {messages.map((m) => (
          <ChatMessageComponent key={m.id} message={m} currentUser={user} />
        ))}
      </div>

      <div className="px-4 pb-6 pt-3 border-t" style={{ borderColor: 'rgba(94,106,210,0.1)' }}>
        <ChatInput
          onSendMessage={(msg) => handleSendText(msg)}
          onSendVoice={handleSendVoice}
          onToast={() => {}}
          city=""
        />
      </div>

      {pendingClose && (
        <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPendingClose(false)}>
          <div className="w-full max-w-[340px] glass rounded-3xl p-5 bg-[#101014]" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-[#9a9fa8] mb-5">{tx('confirm_close')}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setPendingClose(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#9a9fa8] glass">
                {tx('cancel')}
              </button>
              <button
                onClick={async () => { await closeRoom(room.id).catch(() => {}); setPendingClose(false); onClosedRoom(); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #ff6b81, #ef4444)' }}
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
