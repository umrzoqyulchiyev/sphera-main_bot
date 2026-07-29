import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { Send, X, Loader, Coffee, Activity, Users, Sparkles, Square, Check, Mic } from 'lucide-react';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { RoomsButton } from './RoomsScreen';
import { Visualizer } from './Visualizer';
import { GoLiveButton, type SlotHint } from './GoLiveButton';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useToast } from '../../hooks/useToast';
import { useTelegramBackButton } from '../../hooks/useTelegramBackButton';
import { Toast } from '../ui/Toast';
import { FullScreenModal } from '../ui/FullScreenModal';
import { getRadioStatus, getChatHistory, getMySlots, sendOpinionVoice, sendChatMessage, sendVoiceMessage, type BroadcastSlot } from '../../lib/api';
import { DEFAULT_CITY, LS_CITY } from '../../lib/config';
import { useTranslation } from '../../hooks/useTranslation';
import type { User, RadioStatus, ChatMessage, Screen } from '../../types';

interface PendingChatSend {
  tempId: number;
  kind: 'text' | 'voice';
  content: string;
  blobUrl?: string;
}

interface EfirScreenProps {
  user: User | null;
  onPointsUpdate: (points: number) => void;
  onNavigate?: (screen: Screen) => void;
  // Efir holati Radio.tsx darajasida saqlanadi (useLiveBroadcast) —
  // shu ekran boshqasiga almashtirilib qaytilganda ham efir uzilmaydi.
  isLive: boolean;
  liveRemainingSec: number | null;
  // Efirga chiqqandan beri o'tgan vaqt (slot bo'lmagan holatda — masalan
  // admin — countdown yo'q, shu son o'rniga hisoblanadi).
  liveElapsedSec?: number;
  onToggleLive: () => void;
  // Efirni vaqtincha to'xtatish (mikrofon jim, sessiya ochiq qoladi).
  isLivePaused?: boolean;
  onToggleLivePause?: () => void;
  // Tinglash (audio pleer) holati ham Radio.tsx darajasida — boshqa tabga
  // o'tilganda ham <audio> elementi uzilmasligi uchun. Shu ekran faqat
  // ko'rsatadi/boshqaradi, lekin o'zi yaratmaydi.
  radioStatus: RadioStatus | null;
  setRadioStatus: Dispatch<SetStateAction<RadioStatus | null>>;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
}

export function EfirScreen({ user, onPointsUpdate, onNavigate, isLive, liveRemainingSec, liveElapsedSec, onToggleLive, isLivePaused, onToggleLivePause, radioStatus, setRadioStatus, audioPlayer }: EfirScreenProps) {
  const { t, lang } = useTranslation();
  const { message, showToast } = useToast();
  const [city] = useState(localStorage.getItem(LS_CITY) || DEFAULT_CITY);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // O'zimiz optimistik qo'shgan (hali serverdan tasdiqlanmagan) chat
  // xabarlari — asosiy chat ekranidagi bilan bir xil 1/2 galochka mexanizmi.
  const pendingChatRef = useRef<PendingChatSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [showStudioModal, setShowStudioModal] = useState(false);
  const [studioText, setStudioText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoice, setPendingVoice] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Vediushiyning eng dolzarb bron qilingan sloti — "ЗАПИСАЛСЯ Я ИЛИ НЕТ"
  // savoliga tugma rangi/podsказka orqali javob berish uchun (faqat
  // doverenniy/admin uchun kerak — ular efirga chiqa oladi).
  const canGoLive = user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'doverenniy';
  const [mySlot, setMySlot] = useState<BroadcastSlot | null>(null);
  const [, forceTick] = useState(0);

  // O'zi efirga chiqqanda — agar oldin tinglab turgan bo'lsa, pleer
  // avtomatik to'xtaydi (aks holda o'z ovozini eshitib qoladi). Efirda
  // ekan pastdagi play tugmasi ham butunlay o'chirilgan (pastroqda).
  useEffect(() => {
    if (isLive && audioPlayer.isPlaying) {
      audioPlayer.togglePlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  useEffect(() => {
    if (!canGoLive) return;
    let cancelled = false;
    const load = () => {
      getMySlots().then((slots) => {
        if (cancelled) return;
        const now = Date.now();
        let best: BroadcastSlot | null = null;
        let bestDiff = Infinity;
        for (const s of slots) {
          if (s.status !== 'scheduled' && s.status !== 'live') continue;
          const start = new Date(s.scheduled_at).getTime();
          const end = start + s.duration_min * 60000;
          if (now < end) {
            const diff = Math.abs(start - now);
            // Hozir faol (start<=now<end) bo'lgan slot doim ustuvor;
            // aks holda eng yaqin kelajakdagisini tanlaymiz.
            const active = now >= start && now < end;
            if (active) { best = s; bestDiff = -1; break; }
            if (diff < bestDiff) { best = s; bestDiff = diff; }
          }
        }
        setMySlot(best);
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [canGoLive]);

  // Podsказka har soniyada yangilanib tursin (countdown/"hozir mumkin" o'tishi).
  useEffect(() => {
    if (!canGoLive) return;
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [canGoLive]);

  const slotHint: SlotHint | null = (() => {
    if (!mySlot) return null;
    const start = new Date(mySlot.scheduled_at).getTime();
    const end = start + mySlot.duration_min * 60000;
    const now = Date.now();
    const ready = now >= start && now < end;
    if (ready) return { ready: true, text: t('slot_ready_now') };
    const time = new Date(mySlot.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { ready: false, text: t('slot_starts_at').replace('{title}', mySlot.title).replace('{time}', time) };
  })();

  const { send: wsSend } = useWebSocket({ city, onMessage: handleWSMessage });

  // Telegram'ning tabiiy "orqaga" tugmasi — DOM ichidagi tugmalardan farqli
  // o'laroq, uni Telegram'ning o'zi chizadi va boshqaradi, shuning uchun
  // ilova tepasidagi native "Закрыть"/menyu paneli bilan hech qachon
  // to'qnashmaydi (eski klientlarda mavjud bo'lmasa — jim o'tkazib
  // yuboriladi, pastdagi DOM tugmasi fallback bo'ladi).
  useTelegramBackButton(showChatModal, () => setShowChatModal(false));
  useTelegramBackButton(showStreamModal, () => setShowStreamModal(false));

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        await Promise.all([
          getRadioStatus(city).then(setRadioStatus).catch(console.error),
          getChatHistory(city).then(msgs => {
            // id bo'yicha dedup (bir xil xabarlar bo'lmasin)
            const unique = msgs.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
            setMessages(unique);
          }).catch(console.error),
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [city]);

  function handleWSMessage(wsMessage: { type: string; data?: any }) {
    if (!wsMessage.data) return;
    switch (wsMessage.type) {
      case 'chat':
        setMessages(prev => {
          // Bir xil id li xabar allaqachon bor bo'lsa qo'shmaymiz (WS reconnect duplikatlari)
          const newMsg = wsMessage.data;
          if (newMsg?.id && prev.some(m => m.id === newMsg.id)) return prev;

          // O'zimiz optimistik qo'shgan yozuv bo'lsa — o'sha bilan almashtiramiz
          // (dublikat qo'shmaymiz, 2-galochka).
          const kind = newMsg.message_type === 'voice' ? 'voice' : 'text';
          const pendingIdx = pendingChatRef.current.findIndex(
            (p) => p.kind === kind && (kind === 'voice' || p.content === (newMsg.message || ''))
          );
          if (pendingIdx !== -1) {
            const { tempId, blobUrl } = pendingChatRef.current[pendingIdx];
            pendingChatRef.current.splice(pendingIdx, 1);
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            return prev.map((m) => (m.id === tempId ? { ...newMsg, status: 'delivered' as const } : m));
          }
          return [...prev, newMsg];
        });
        break;
      case 'radio_status':
      case 'presence':
        setRadioStatus(wsMessage.data.radio || wsMessage.data);
        break;
      case 'new_segment':
        if (wsMessage.data.url) audioPlayer.addSegment(wsMessage.data);
        if (wsMessage.data.is_live !== undefined)
          setRadioStatus(prev => prev ? { ...prev, ...wsMessage.data } : null);
        break;
      case 'studio_ack':
        onPointsUpdate(wsMessage.data.points);
        break;
      case 'limit_exceeded':
        onPointsUpdate(wsMessage.data.points);
        showToast(t('toast_limit'));
        break;
      case 'studio_denied':
        showToast(t('studio_denied_role'));
        break;
      case 'balance':
        onPointsUpdate(wsMessage.data.points);
        break;
    }
  }

  const handleSendMessage = useCallback(async (msg: string, destination: 'chat' | 'studio') => {
    // Faqat "chat" uchun darhol ko'rsatamiz — asosiy chat ekrani bilan bir xil.
    let tempId: number | null = null;
    if (destination === 'chat') {
      tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
      pendingChatRef.current.push({ tempId, kind: 'text', content: msg });
      setMessages((prev) => [
        ...prev,
        {
          id: tempId!,
          username: user?.username ?? null,
          display_name: user?.display_name || user?.full_name || null,
          message: msg,
          message_type: 'text',
          voice_url: null,
          created_at: new Date().toISOString(),
          status: 'sending',
        },
      ]);
    }
    const markSent = () => {
      if (tempId === null) return;
      const id = tempId;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'sent' as const } : m)));
    };
    const rollback = () => {
      if (tempId === null) return;
      const id = tempId;
      pendingChatRef.current = pendingChatRef.current.filter((p) => p.tempId !== id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    // 1-urinish: WebSocket (real-time). Ulanmagan bo'lsa — HTTP fallback.
    const sentViaWs = wsSend({ type: destination, message: msg, lang });
    if (sentViaWs) {
      markSent();
      return;
    }

    // WS yopiq — HTTP orqali yuboramiz (xabar yo'qolmasin)
    try {
      const res: any = await sendChatMessage('global', msg);
      if (res?.points !== undefined) onPointsUpdate(Number(res.points));
      // Tarixni yangilash (WS yo'q, shuning uchun qo'lda qo'shamiz)
      getChatHistory(city).then(msgs => {
        const unique = msgs.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
        setMessages(unique);
      }).catch(() => {});
    } catch (e: any) {
      rollback();
      if (e?.status === 402) showToast(t('toast_limit'));
      else showToast(t('send_error'));
    }
  }, [wsSend, lang, onPointsUpdate, showToast, t, city, user]);

  const handleSendVoiceToChat = useCallback(async (blob: Blob) => {
    const tempId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
    const blobUrl = URL.createObjectURL(blob);
    pendingChatRef.current.push({ tempId, kind: 'voice', content: '', blobUrl });
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        username: user?.username ?? null,
        display_name: user?.display_name || user?.full_name || null,
        message: '',
        message_type: 'voice',
        voice_url: blobUrl,
        created_at: new Date().toISOString(),
        status: 'sending',
      },
    ]);

    try {
      const res: any = await sendVoiceMessage(city, blob, 'chat', lang);
      if (res?.points !== undefined) onPointsUpdate(Number(res.points));
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sent' as const } : m)));
    } catch (e: any) {
      pendingChatRef.current = pendingChatRef.current.filter((p) => p.tempId !== tempId);
      URL.revokeObjectURL(blobUrl);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (e?.status === 402) {
        const data = await e.response?.json().catch(() => ({}));
        if (data?.detail?.points !== undefined) onPointsUpdate(Number(data.detail.points));
        showToast(t('toast_limit'));
      } else {
        showToast(t('send_error'));
      }
    }
  }, [city, lang, onPointsUpdate, showToast, t, user]);

  // Golosovoe mikrofon tugmasi — bosilsa yozib boshlaydi, yana bosilsa
  // to'xtatadi. Darhol yubormaydi: yozilgan ovoz "ОТПРАВИТЬ" tugmasi
  // bosilguncha kutib turadi (pendingVoice).
  const handleVoiceMessage = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    if (isLive) {
      showToast(t('toast_mic_live'));
      return;
    }
    try {
      // Telegram WebApp mikrofon ruxsati
      const tgApp = (window as any).Telegram?.WebApp;
      if (tgApp?.requestMicrophoneAccess) {
        const granted: boolean = await new Promise(resolve => {
          tgApp.requestMicrophoneAccess((ok: boolean) => resolve(ok));
        });
        if (!granted) {
          showToast('Микрофон рұқсаты берілмеді');
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 800) { showToast(t('toast_short')); return; }
        setPendingVoice(blob);
        showToast(t('voice_ready'));
      };
      rec.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Mic error:', err);
      if (err?.name === 'NotAllowedError') {
        showToast('Микрофон рұқсаты жоқ');
      } else {
        showToast(t('toast_mic_denied'));
      }
    }
  };

  const discardPendingVoice = () => setPendingVoice(null);

  // "ОТПРАВИТЬ" tugmasi: yozilgan (hali yuborilmagan) ovoz bo'lsa — studiyaga
  // shuni yuboradi; bo'lmasa — matn kiritish modalini ochadi (eski xatti-harakat).
  const handleSendToStudio = async () => {
    if (pendingVoice) {
      const blob = pendingVoice;
      setPendingVoice(null);
      try {
        const res = await sendOpinionVoice(blob);
        if (res?.points !== undefined) onPointsUpdate(Number(res.points));
      } catch (err: any) {
        if (err.status === 403) showToast(t('studio_denied_role'));
        else if (err.status === 402) showToast(t('toast_limit'));
        else showToast('⚠️');
      }
      return;
    }
    setStudioText('');
    setShowStudioModal(true);
  };

  // Chat modalni ochish — har ochilganda tarixni yangilaymiz
  const openChat = useCallback(() => {
    setShowChatModal(true);
    getChatHistory(city).then(msgs => {
      const unique = msgs.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);
      setMessages(unique);
    }).catch(() => {});
  }, [city]);

  const submitStudioMessage = () => {
    const msg = studioText.trim();
    if (msg) handleSendMessage(msg, 'studio');
    setShowStudioModal(false);
    setStudioText('');
  };

  const level = user?.level || 1;
  const broadcasterName = radioStatus?.is_live
    ? radioStatus.broadcaster_type === 'doverenniy'
      ? radioStatus.broadcaster_name || '🔴 LIVE'
      : t('ai_host')
    : t('activation');

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Waveform for stream modal
  const waveformBars = [3,5,8,12,17,22,28,32,35,32,28,22,17,12,8,5,3];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader className="w-10 h-10 text-[#F97316] animate-spin" />
        <p className="text-xs text-[#94A3B8] tracking-widest uppercase">Загрузка эфира...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative select-none">

      {/* ── УРОВЕНЬ / ПОТОК REAL TIME ── */}
      <div className="text-center pt-2 pb-4">
        <div className="text-[11px] font-semibold tracking-[3px] text-[#94A3B8] uppercase mb-0.5">
          УРОВЕНЬ {level}
        </div>
        <div className="text-[11px] tracking-[2px] uppercase">
          <span className="text-[#94A3B8]">ПОТОК </span>
          <span className="text-[#F97316] font-bold">REAL TIME</span>
        </div>
      </div>

      {/* ── Тинглаётганлар сони — плеер тугмасидан ТЕПАДА ── */}
      <div className="flex items-center justify-center gap-1.5 text-[#94A3B8]">
        <Users className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold tabular-nums">{radioStatus?.listeners_count || 0}</span>
      </div>

      {/* ── КОЛЬЦО + VISUALIZER (кнопка play) — o'zi efirda ekan
          o'chirilgan: o'z ovozini eshitmasin, faqat boshqalar efirda
          bo'lganda tinglay oladi. Kichikroq (200px) — tepasida tinglovchilar
          soni ko'rinsin deb. ── */}
      <div className="flex items-center justify-center py-1">
        <button
          onClick={isLive ? undefined : audioPlayer.togglePlay}
          disabled={isLive}
          className="relative flex items-center justify-center active:scale-95 transition-transform duration-150 disabled:active:scale-100 disabled:cursor-default"
          aria-label={isLive ? 'own-broadcast' : (audioPlayer.isPlaying ? 'pause' : 'play')}
        >
          <Visualizer isPlaying={audioPlayer.isPlaying && !isLive} size={200} />
          {isLive ? (
            <span className="absolute z-10 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(15,15,35,0.5)', backdropFilter: 'blur(4px)' }}>
              <Mic className="w-4.5 h-4.5 text-[#F97316]" />
            </span>
          ) : audioPlayer.isLoading ? (
            <span className="absolute z-10 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(15,15,35,0.5)', backdropFilter: 'blur(4px)' }}>
              <Loader className="w-4.5 h-4.5 text-[#F97316] animate-spin" />
            </span>
          ) : !audioPlayer.isPlaying && (
            <span className="absolute z-10 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(15,15,35,0.5)', backdropFilter: 'blur(4px)' }}>
              <svg className="w-4.5 h-4.5 text-[#F97316] ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </span>
          )}
        </button>
      </div>

      {/* ── ID + ЗАГОЛОВОК ── */}
      <div className="text-center px-4 mt-2 mb-3">
        <div className="text-[10px] text-[#94A3B8] tracking-widest mb-1">
          ID: {user?.telegram_id || '-----'}
        </div>
        <div className="text-[15px] font-bold tracking-wide text-[#F8FAFC] leading-tight font-display">
          {radioStatus?.is_live ? 'Активация переосмысления' : 'Ожидание потока'}
        </div>
        <div className="text-[11px] text-[#94A3B8] mt-1 tracking-wide">
          {broadcasterName}
        </div>
      </div>

      {/* ── TIMER — faqat efirga chiqa oladiganlar (admin/moderator/
          doverenniy) uchun, va faqat o'zi hozir jonli bo'lganda: qolgan
          vaqtini ko'rsatadi. Oddiy tinglovchiga umuman ko'rinmaydi — avval
          hammaga statik "00:00" ko'rsatilardi, ma'nosiz edi. Slot bo'lmagan
          holatda (masalan admin — countdown yo'q) o'rniga QANCHA VAQT
          efirda bo'lgani (o'sib boruvchi hisoblagich) ko'rsatiladi, efir
          tugaganda esa umumiy davomiylik toast orqali chiqadi. */}
      {canGoLive && isLive && (
        <div className="text-center mb-4">
          <div className="text-[28px] font-black text-[#F97316] tabular-nums tracking-widest"
            style={{ textShadow: '0 0 10px rgba(249,115,22,0.35)' }}>
            {formatTime(liveRemainingSec ?? liveElapsedSec ?? 0)}
          </div>
          <div className="text-[9px] tracking-[3px] text-[#94A3B8] uppercase mt-0.5">
            {isLivePaused ? 'Пауза' : 'Поток активен'}
          </div>
        </div>
      )}

      {/* ── Группы — ведущий эфир вақтида ҳам guruh chatlariga kira oladi ── */}
      <div className="px-4 mb-3 flex justify-end">
        <RoomsButton user={user} isLive={isLive} />
      </div>

      {/* Голос записалган — hali yuborilmagan, "ОТПРАВИТЬ" bosilguncha kutadi */}
      {pendingVoice && (
        <div className="mx-4 mb-3 glass px-4 py-2.5 rounded-2xl flex items-center justify-between border border-dashed border-[#F97316]">
          <span className="text-xs text-[#F97316] flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> {t('voice_ready')}
          </span>
          <button onClick={discardPendingVoice} className="text-[#94A3B8] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 3 КНОПКИ (точно как на рисунке) ── */}
      <div className="flex items-center justify-around px-6 pb-4 gap-3">

        {/* Чай / Сверхмощность — левая */}
        <button
          onClick={openChat}
          className="flex flex-col items-center gap-2 group flex-1"
        >
          <div
            className="w-full h-[58px] rounded-2xl flex flex-col items-center justify-center gap-1 relative transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(27,27,48,0.8)',
              border: '1px solid rgba(148,163,184,0.14)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <Coffee className="w-5 h-5 text-[#94A3B8] group-hover:text-[#F97316] transition-colors" strokeWidth={1.8} />
            {messages.length > 0 && (
              <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-[#F8FAFC]"
                style={{ background: '#2A2A45', border: '1px solid rgba(148,163,184,0.25)' }}>
                {messages.length > 9 ? '9+' : messages.length}
              </div>
            )}
          </div>
          <span className="text-[8px] text-[#94A3B8] tracking-wide text-center leading-tight">
            Чай<br/>сверхмощность
          </span>
        </button>

        {/* Голосовое сообщение — центр (крупнее). Yozayotganda shakli
            mikrofon → to'xtatish (kvadrat) belgisiga o'zgaradi. */}
        <button
          onClick={handleVoiceMessage}
          className="flex flex-col items-center gap-2 group flex-1"
          style={isLive && !isRecording ? { opacity: 0.45 } : undefined}
        >
          <div
            className="w-full h-[58px] rounded-2xl flex flex-col items-center justify-center gap-1.5 relative transition-all duration-200 active:scale-95"
            style={{
              background: isRecording
                ? 'rgba(239,68,68,0.15)'
                : pendingVoice
                ? 'rgba(34,197,94,0.12)'
                : 'rgba(27,27,48,0.8)',
              border: isRecording
                ? '1px solid rgba(239,68,68,0.5)'
                : pendingVoice
                ? '1px solid rgba(34,197,94,0.4)'
                : '1px solid rgba(148,163,184,0.16)',
              boxShadow: isRecording
                ? '0 0 14px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.04)'
                : 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {isRecording ? (
              <Square className="w-6 h-6 text-[#ef4444]" fill="currentColor" />
            ) : pendingVoice ? (
              <Check className="w-6 h-6 text-[#22C55E]" strokeWidth={2} />
            ) : (
              <svg className="w-7 h-7 text-[#94A3B8] group-hover:text-[#F97316] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
              </svg>
            )}
            {isRecording && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
            )}
          </div>
          <span className="text-[8px] tracking-wide text-center leading-tight"
            style={{ color: isRecording ? '#ef4444' : pendingVoice ? '#22C55E' : '#94A3B8' }}>
            Голосовое<br/>сообщение
          </span>
        </button>

        {/* Отправить — правая. Yozilgan ovoz bo'lsa shu tugma studiyaga
            yuboradi (matn modalini o'rniga). */}
        <button
          onClick={handleSendToStudio}
          className="flex flex-col items-center gap-2 group flex-1"
        >
          <div
            className="w-full h-[58px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95"
            style={{
              background: pendingVoice ? 'rgba(249,115,22,0.13)' : 'rgba(27,27,48,0.8)',
              border: pendingVoice ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(148,163,184,0.14)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <Send className={`w-5 h-5 transition-colors ${pendingVoice ? 'text-[#F97316]' : 'text-[#94A3B8] group-hover:text-[#F97316]'}`} strokeWidth={1.8} />
          </div>
          <span className="text-[8px] tracking-wide text-center leading-tight"
            style={{ color: pendingVoice ? '#F97316' : '#94A3B8' }}>
            Отправить
          </span>
        </button>
      </div>

      {/* ── ПОТОК REAL TIME кнопка (иконка для второго экрана) ── */}
      <div className="px-4 pb-2">
        {/* 🔴 LIVE tugmasi — faqat admin/doverenniy uchun, qolganlarga kasting taklifi */}
        {(user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'doverenniy') ? (
          <div className="mb-2">
            <GoLiveButton
              isLive={isLive}
              remainingSec={liveRemainingSec}
              onToggle={onToggleLive}
              isPaused={isLivePaused}
              onTogglePause={onToggleLivePause}
              slot={slotHint}
            />
          </div>
        ) : (
          <button
            onClick={() => onNavigate?.('casting')}
            className="w-full mb-2 py-3 rounded-2xl font-semibold text-sm tracking-wide flex items-center justify-center gap-2 glass active:scale-[0.97] transition-all"
            style={{ color: '#F8FAFC' }}
          >
            <Sparkles className="w-4 h-4 text-[#F97316]" strokeWidth={1.8} />
            Пройти кастинг — стать ведущим
          </button>
        )}
        <button
          onClick={() => setShowStreamModal(true)}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(148,163,184,0.1)' }}>
              <Activity className="w-4 h-4 text-[#94A3B8]" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[2px] text-[#F8FAFC] uppercase">Поток Real Time</div>
              <div className="text-[9px] text-[#94A3B8]">Статистика потока</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-[10px] text-[#94A3B8]">{radioStatus?.listeners_count || 0}</span>
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </button>
      </div>

      {/* ── OFFLINE ── */}
      {!isOnline && (
        <div className="mx-4 glass rounded-xl p-2 mb-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="flex items-center justify-center gap-2 text-xs text-[#ef4444]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
            <span>Нет соединения</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: ПОТОК REAL TIME
      ══════════════════════════════════════════════════ */}
      {showStreamModal && (
        <FullScreenModal>

          {/* Header — Telegram'ning tepadagi native paneli bilan to'qnashmasin */}
          <div className="flex items-center px-4 pb-3 border-b"
            style={{ borderColor: 'rgba(148,163,184,0.12)', paddingTop: 'calc(76px + env(safe-area-inset-top))' }}>
            <button onClick={() => setShowStreamModal(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center mr-3"
              style={{ background: 'rgba(148,163,184,0.1)' }}>
              <svg className="w-4 h-4 text-[#F8FAFC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <span className="text-sm font-bold text-[#94A3B8]">Поток </span>
              <span className="text-sm font-bold text-[#F97316]">Real Time</span>
            </div>
            <div className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(148,163,184,0.1)' }}>
              <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {/* Points + Level */}
            <div className="flex items-start gap-4 py-4">
              <div>
                <div className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-1">POINT</div>
                <div className="text-3xl font-black text-[#F8FAFC]">
                  {Number(user?.points || 0).toFixed(0)}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-1">УРОВЕНЬ</div>
                <div className="text-3xl font-black text-[#F8FAFC] mb-2">{level}</div>
                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden mt-1"
                  style={{ background: 'rgba(249,115,22,0.12)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(2, Math.min(Number(user?.points || 0) / 500 * 100, 100))}%`,
                      background: 'linear-gradient(90deg, #FB923C, #F97316)',
                      boxShadow: '0 0 8px rgba(249,115,22,0.7)',
                      minWidth: '6px',
                    }} />
                </div>
                <div className="flex justify-between text-[9px] text-[#94A3B8] mt-1">
                  <span>{Number(user?.points || 0).toFixed(4)} pts</span>
                  <span>500 → next level</span>
                </div>
              </div>
            </div>

            {/* ID + Title */}
            <div className="mb-4">
              <div className="text-[10px] text-[#94A3B8] mb-0.5">
                ID: {user?.telegram_id || '-----'}
              </div>
              <div className="text-[16px] font-bold text-[#F8FAFC] tracking-wide font-display">
                {radioStatus?.is_live ? 'Активация переосмысления' : 'Ожидание потока'}
              </div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">
                {broadcasterName}
              </div>
            </div>

            {/* Waveform */}
            <div className="glass rounded-2xl px-4 py-4 mb-4">
              <div className="flex items-center justify-center gap-[4px]" style={{ height: '50px' }}>
                {waveformBars.map((h, i) => (
                  <div key={i}
                    style={{
                      width: '5px',
                      height: `${h * 1.3}px`,
                      background: 'linear-gradient(180deg, #fff 0%, #F97316 50%, #FB923C 100%)',
                      borderRadius: '3px',
                      boxShadow: '0 0 4px rgba(249,115,22,0.4)',
                      animation: audioPlayer.isPlaying
                        ? `wave ${0.7+(i%3)*0.15}s ease-in-out ${i*0.07}s infinite`
                        : 'none',
                      opacity: audioPlayer.isPlaying ? 1 : 0.4,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 3 buttons */}
            <div className="flex items-end justify-around gap-3 mb-5">
              <button onClick={() => { setShowStreamModal(false); openChat(); }}
                className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-[58px] rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(27,27,48,0.8)', border: '1px solid rgba(148,163,184,0.14)' }}>
                  <Coffee className="w-5 h-5 text-[#94A3B8]" strokeWidth={1.8} />
                </div>
                <span className="text-[8px] text-[#94A3B8] tracking-wide text-center leading-tight">
                  Чай<br/>сверхмощность
                </span>
              </button>

              <button onClick={() => { setShowStreamModal(false); handleVoiceMessage(); }}
                className="flex flex-col items-center gap-2" style={{ flex: '1.4' }}>
                <div className="w-full h-[72px] rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'rgba(27,27,48,0.8)',
                    border: '1px solid rgba(148,163,184,0.16)',
                  }}>
                  <svg className="w-7 h-7 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                </div>
                <span className="text-[8px] text-[#94A3B8] tracking-wide text-center leading-tight">
                  Голосовое<br/>сообщение
                </span>
              </button>

              <button onClick={() => { setShowStreamModal(false); handleSendToStudio(); }}
                className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-[58px] rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(27,27,48,0.8)', border: '1px solid rgba(148,163,184,0.14)' }}>
                  <Send className="w-5 h-5 text-[#94A3B8]" strokeWidth={1.8} />
                </div>
                <span className="text-[8px] text-[#94A3B8] tracking-wide text-center leading-tight">
                  Отправить
                </span>
              </button>
            </div>

            {/* СТАТИСТИКА ПОТОКА */}
            <div className="mb-3">
              <div className="text-[10px] font-bold tracking-[2px] text-[#94A3B8] uppercase mb-3">
                Статистика потока
              </div>
              <div className="grid grid-cols-3 gap-2">
                {/* Активность */}
                <div className="glass rounded-2xl p-3">
                  <div className="text-[9px] text-[#94A3B8] uppercase tracking-wide mb-2">Активность</div>
                  <div className="text-xl font-black text-[#F8FAFC]">
                    {radioStatus?.is_live ? '78%' : '0%'}
                  </div>
                  {/* Mini chart */}
                  <div className="flex items-end gap-[2px] mt-2" style={{ height: '20px' }}>
                    {[4,6,3,8,5,10,7,12,9,14].map((h, i) => (
                      <div key={i} style={{
                        flex: 1, height: `${h}px`,
                        background: 'rgba(148,163,184,0.3)',
                        borderRadius: '1px',
                      }} />
                    ))}
                  </div>
                </div>

                {/* Энергия */}
                <div className="glass rounded-2xl p-3">
                  <div className="text-[9px] text-[#94A3B8] uppercase tracking-wide mb-2">Энергия</div>
                  <div className="text-xl font-black text-[#F8FAFC]">
                    {radioStatus?.is_live ? 'HIGH' : 'LOW'}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(148,163,184,0.1)' }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: radioStatus?.is_live ? '80%' : '20%',
                        background: 'linear-gradient(90deg, #FB923C, #F97316)',
                      }} />
                  </div>
                </div>

                {/* Сообщений */}
                <div className="glass rounded-2xl p-3">
                  <div className="text-[9px] text-[#94A3B8] uppercase tracking-wide mb-2">Сообщений</div>
                  <div className="text-xl font-black text-[#F8FAFC]">
                    {messages.length}
                  </div>
                  <div className="flex items-end gap-[2px] mt-2" style={{ height: '20px' }}>
                    {[3,7,5,9,6,11,8,13,10,15].map((h, i) => (
                      <div key={i} style={{
                        flex: 1, height: `${h}px`,
                        background: 'rgba(148,163,184,0.3)',
                        borderRadius: '1px',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pastki "Закрыть" tugmasi — yuqoridagi orqaga tugmasi ba'zi
              Telegram klientlarida ekranning eng tepasidagi native
              "Закрыть" paneli bilan to'qnashib, bosilmay qolishi mumkin
              (native chrome tegishlarni ushlab qolishi). Shu joy — kirish
              maydoni bilan bir xil, kafolatlangan bosiladigan zona. */}
          <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'rgba(148,163,184,0.12)' }}>
            <button
              onClick={() => setShowStreamModal(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#94A3B8] active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.14)' }}
            >
              Закрыть
            </button>
          </div>

          <style>{`
            @keyframes wave {
              0%,100% { transform: scaleY(0.4); }
              50% { transform: scaleY(1.5); }
            }
          `}</style>
        </FullScreenModal>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: ЧАТ
      ══════════════════════════════════════════════════ */}
      {showChatModal && (
        <FullScreenModal>

          {/* Sarlavhasiz, chegarasiz — toza ko'rinish. Yopish Telegram'ning
              o'z native chrome/BackButton'i orqali. */}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4" ref={(el) => {
            // FAQAT modal birinchi ochilganda pastga scroll (keyinroq foydalanuvchi o'zi scroll qiladi)
            if (el && !el.dataset.scrolled) {
              el.dataset.scrolled = '1';
              setTimeout(() => el.scrollTop = el.scrollHeight, 50);
            }
          }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)' }}>
                  <Coffee className="w-8 h-8 text-[#94A3B8]" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-[#94A3B8]">Чат пуст</p>
                <p className="text-xs text-[#94A3B8]/60 mt-1">Начните диалог</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((m) => (
                  <ChatMessageComponent key={m.id} message={m} currentUser={user} />
                ))}
              </div>
            )}
          </div>

          {/* Input — asosiy "Живой чат" bilan bir xil komponent (Telegram
              uslubidagi doira tugma, darhol ko'rinish, galochka statusi). */}
          <div className="px-4 pb-6 pt-3 border-t" style={{ borderColor: 'rgba(148,163,184,0.12)' }}>
            <ChatInput
              onSendMessage={(msg) => handleSendMessage(msg, 'chat')}
              onSendVoice={handleSendVoiceToChat}
              onToast={showToast}
              city={city}
              micDisabled={isLive}
            />
          </div>
        </FullScreenModal>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: ОТПРАВИТЬ В ЭФИР (matn yuborish)
      ══════════════════════════════════════════════════ */}
      {showStudioModal && (
        <div
          className="fixed z-[10000] flex items-center justify-center px-6"
          style={{
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15,15,35,0.75)',
            backdropFilter: 'blur(6px)',
            isolation: 'isolate',
          }}
          onClick={() => setShowStudioModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{
              background: 'rgba(27,27,48,0.98)',
              border: '1px solid rgba(148,163,184,0.16)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(148,163,184,0.1)' }}>
                <Send className="w-4 h-4 text-[#94A3B8]" strokeWidth={2} />
              </div>
              <div className="text-[13px] font-semibold tracking-wide text-[#F8FAFC]">
                Сообщение для эфира
              </div>
              <button onClick={() => setShowStudioModal(false)}
                className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(148,163,184,0.1)' }}>
                <X className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              autoFocus
              value={studioText}
              onChange={(e) => setStudioText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitStudioMessage();
                }
              }}
              placeholder="Введите сообщение..."
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] resize-none outline-none placeholder:text-[#94A3B8]"
              style={{
                background: 'rgba(15,15,35,0.6)',
                border: '1px solid rgba(148,163,184,0.16)',
              }}
            />

            {/* Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowStudioModal(false)}
                className="flex-1 h-11 rounded-xl text-sm font-semibold text-[#94A3B8] active:scale-95 transition-transform"
                style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.14)' }}
              >
                Отмена
              </button>
              <button
                onClick={submitStudioMessage}
                disabled={!studioText.trim()}
                className="flex-1 h-11 rounded-xl text-sm font-bold text-[#1B1204] active:scale-95 transition-transform disabled:opacity-40"
                style={{
                  background: 'linear-gradient(90deg, #FB923C, #F97316)',
                  boxShadow: '0 2px 10px rgba(249,115,22,0.25)',
                }}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={message} />
    </div>
  );
}
