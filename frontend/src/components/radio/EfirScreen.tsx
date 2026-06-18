import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, X, Loader, Coffee, Activity, Users } from 'lucide-react';
import { ChatMessages } from './ChatMessages';
import { Visualizer } from './Visualizer';
import { GoLiveButton } from './GoLiveButton';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../ui/Toast';
import { getRadioStatus, getChatHistory, sendVoiceMessage } from '../../lib/api';
import { authHeaders } from '../../lib/auth';
import { DEFAULT_CITY, LS_CITY } from '../../lib/config';
import { useTranslation } from '../../hooks/useTranslation';
import type { User, RadioStatus, ChatMessage } from '../../types';

interface EfirScreenProps {
  user: User | null;
  onPointsUpdate: (points: number) => void;
}

export function EfirScreen({ user, onPointsUpdate }: EfirScreenProps) {
  const { t, lang } = useTranslation();
  const { message, showToast } = useToast();
  const [city] = useState(localStorage.getItem(LS_CITY) || DEFAULT_CITY);
  const [radioStatus, setRadioStatus] = useState<RadioStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const audioPlayer = useAudioPlayer({
    city,
    language: lang,
    useIcecast: radioStatus?.use_icecast || false,
  });

  const { send: wsSend } = useWebSocket({ city, onMessage: handleWSMessage });

  useEffect(() => {
    if (radioStatus?.is_live && audioPlayer.isPlaying) {
      const interval = setInterval(() => setStreamDuration(prev => prev + 1), 1000);
      return () => clearInterval(interval);
    } else {
      setStreamDuration(0);
    }
  }, [radioStatus?.is_live, audioPlayer.isPlaying]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        await Promise.all([
          getRadioStatus(city).then(setRadioStatus).catch(console.error),
          getChatHistory(city).then(setMessages).catch(console.error),
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
        setMessages(prev => [...prev, wsMessage.data]);
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
        showToast(t('toast_sent_studio'));
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

  const handleSendMessage = useCallback((msg: string, destination: 'chat' | 'studio') => {
    wsSend({ type: destination, message: msg, lang });
  }, [wsSend, lang]);

  const handleVoiceMessage = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 800) { showToast(t('toast_short')); return; }
        try {
          const res = await sendVoiceMessage(city, blob, 'chat', lang);
          if (res?.points !== undefined) onPointsUpdate(Number(res.points));
          showToast(t('toast_sent_chat'));
        } catch (err: any) {
          if (err.status === 402) showToast(t('toast_limit'));
          else showToast('⚠️');
        }
      };
      rec.start();
      setIsRecording(true);
      showToast(t('toast_recording'));
    } catch (err: any) {
      console.error('Mic error:', err);
      if (err?.name === 'NotAllowedError') {
        showToast('Микрофон рұқсаты жоқ');
      } else {
        showToast(t('toast_mic_denied'));
      }
    }
  };

  const handleSendToStudio = () => {
    const msg = prompt('Введите сообщение для эфира:');
    if (msg?.trim()) handleSendMessage(msg.trim(), 'studio');
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader className="w-10 h-10 text-[#38e1ff] animate-spin" />
        <p className="text-xs text-[#6b7c9e] tracking-widest uppercase">Загрузка эфира...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative select-none" style={{ minHeight: 'calc(100vh - 100px)' }}>

      {/* ── УРОВЕНЬ / ПОТОК REAL TIME ── */}
      <div className="text-center pt-2 pb-4">
        <div className="text-[11px] font-semibold tracking-[3px] text-[#6b7c9e] uppercase mb-0.5">
          УРОВЕНЬ {level}
        </div>
        <div className="text-[11px] tracking-[2px] uppercase">
          <span className="text-[#6b7c9e]">ПОТОК </span>
          <span className="text-[#38e1ff] font-bold">REAL TIME</span>
        </div>
      </div>

      {/* ── КОЛЬЦО + VISUALIZER (кнопка play) ── */}
      <div className="flex items-center justify-center py-2">
        <button
          onClick={audioPlayer.togglePlay}
          className="relative flex items-center justify-center active:scale-95 transition-transform duration-150"
          aria-label={audioPlayer.isPlaying ? 'pause' : 'play'}
        >
          <Visualizer isPlaying={audioPlayer.isPlaying} />
          {!audioPlayer.isPlaying && (
            <span className="absolute z-10 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(6,10,20,0.5)', backdropFilter: 'blur(4px)' }}>
              <svg className="w-6 h-6 text-[#38e1ff] ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </span>
          )}
        </button>
      </div>

      {/* ── ID + ЗАГОЛОВОК ── */}
      <div className="text-center px-4 mt-2 mb-3">
        <div className="text-[10px] text-[#6b7c9e] tracking-widest mb-1">
          ID: {user?.telegram_id || '-----'}
        </div>
        <div className="text-[15px] font-black tracking-wider text-[#dbe9ff] uppercase leading-tight">
          {radioStatus?.is_live ? 'АКТИВАЦИЯ ВРЕОСМИСЛА' : 'ОЖИДАНИЕ ПОТОКА'}
        </div>
        <div className="text-[11px] text-[#6b7c9e] mt-1 tracking-wide">
          {broadcasterName}
        </div>
      </div>

      {/* ── TIMER ── */}
      <div className="text-center mb-4">
        <div className="text-[28px] font-black text-[#38e1ff] tabular-nums tracking-widest"
          style={{ textShadow: '0 0 20px rgba(56,225,255,0.6)' }}>
          {formatTime(streamDuration)}
        </div>
        <div className="text-[9px] tracking-[3px] text-[#6b7c9e] uppercase mt-0.5">
          {audioPlayer.isPlaying ? 'ПОТОК АКТИВЕН' : 'ПАУЗА'}
        </div>
      </div>

      {/* ── 3 КНОПКИ (точно как на рисунке) ── */}
      <div className="flex items-end justify-around px-6 pb-4 gap-3">

        {/* Чай / Сверхмощность — левая */}
        <button
          onClick={() => setShowChatModal(true)}
          className="flex flex-col items-center gap-2 group flex-1"
        >
          <div
            className="w-full h-[58px] rounded-2xl flex flex-col items-center justify-center gap-1 relative transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(16,28,52,0.8)',
              border: '1px solid rgba(56,225,255,0.15)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <Coffee className="w-5 h-5 text-[#6b7c9e] group-hover:text-[#38e1ff] transition-colors" strokeWidth={1.8} />
            {messages.length > 0 && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#38e1ff] flex items-center justify-center text-[9px] font-bold text-[#060a14]">
                {messages.length > 9 ? '9+' : messages.length}
              </div>
            )}
          </div>
          <span className="text-[8px] text-[#6b7c9e] uppercase tracking-wide text-center leading-tight">
            ЧАЙ<br/>СВЕРХ<br/>МОЩНОСТЬ
          </span>
        </button>

        {/* Голосовое сообщение — центр (крупнее) */}
        <button
          onClick={handleVoiceMessage}
          className="flex flex-col items-center gap-2 group"
          style={{ flex: '1.4' }}
        >
          <div
            className="w-full h-[72px] rounded-2xl flex flex-col items-center justify-center gap-1.5 relative transition-all duration-200 active:scale-95"
            style={{
              background: isRecording
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(16,28,52,0.8)',
              border: isRecording
                ? '1px solid rgba(239,68,68,0.5)'
                : '1px solid rgba(56,225,255,0.2)',
              boxShadow: isRecording
                ? '0 0 20px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
                : '0 0 20px rgba(56,225,255,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* Mic icon SVG */}
            <svg className={`w-7 h-7 ${isRecording ? 'text-[#ef4444]' : 'text-[#38e1ff]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
            </svg>
            {isRecording && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
            )}
          </div>
          <span className="text-[8px] uppercase tracking-wide text-center leading-tight"
            style={{ color: isRecording ? '#ef4444' : '#38e1ff' }}>
            ГОЛОСОВОЕ<br/>СООБЩЕНИЕ
          </span>
        </button>

        {/* Отправить — правая */}
        <button
          onClick={handleSendToStudio}
          className="flex flex-col items-center gap-2 group flex-1"
        >
          <div
            className="w-full h-[58px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(16,28,52,0.8)',
              border: '1px solid rgba(56,225,255,0.15)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <Send className="w-5 h-5 text-[#6b7c9e] group-hover:text-[#38e1ff] transition-colors" strokeWidth={1.8} />
          </div>
          <span className="text-[8px] text-[#6b7c9e] uppercase tracking-wide text-center leading-tight">
            ОТПРАВИТЬ
          </span>
        </button>
      </div>

      {/* ── ПОТОК REAL TIME кнопка (иконка для второго экрана) ── */}
      <div className="px-4 pb-2">
        {/* 🔴 LIVE tugmasi — faqat admin/doverenniy uchun */}
        {(user?.role === 'admin' || user?.role === 'doverenniy') && (
          <div className="mb-2">
            <GoLiveButton city={city} onToast={showToast} />
          </div>
        )}
        <button
          onClick={() => setShowStreamModal(true)}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-transform"
          style={{ border: '1px solid rgba(56,225,255,0.12)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(56,225,255,0.1)' }}>
              <Activity className="w-4 h-4 text-[#38e1ff]" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[2px] text-[#38e1ff] uppercase">ПОТОК REAL TIME</div>
              <div className="text-[9px] text-[#6b7c9e]">Статистика потока</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#6b7c9e]" />
            <span className="text-[10px] text-[#6b7c9e]">{radioStatus?.listeners_count || 0}</span>
            <svg className="w-4 h-4 text-[#6b7c9e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        <div
          className="fixed z-[9999] flex flex-col"
          style={{
            top: 0, left: 0, right: 0, bottom: 0,
            background: '#060a14',
            // Telegram mini app ichida karta orqasidan ko'rinmaslik uchun
            isolation: 'isolate',
          }}
        >

          {/* Header */}
          <div className="flex items-center px-4 pt-4 pb-3 border-b"
            style={{ borderColor: 'rgba(56,225,255,0.1)' }}>
            <button onClick={() => setShowStreamModal(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center mr-3"
              style={{ background: 'rgba(56,225,255,0.08)' }}>
              <svg className="w-4 h-4 text-[#38e1ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <span className="text-sm font-bold text-[#6b7c9e]">ПОТОК </span>
              <span className="text-sm font-bold text-[#38e1ff]">REAL TIME</span>
            </div>
            <div className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(56,225,255,0.08)' }}>
              <svg className="w-4 h-4 text-[#6b7c9e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {/* Points + Level */}
            <div className="flex items-start gap-4 py-4">
              <div>
                <div className="text-[10px] text-[#6b7c9e] uppercase tracking-wide mb-1">POINT</div>
                <div className="text-3xl font-black text-[#dbe9ff]"
                  style={{ textShadow: '0 0 20px rgba(56,225,255,0.4)' }}>
                  {Number(user?.points || 0).toFixed(0)}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-[#6b7c9e] uppercase tracking-wide mb-1">УРОВЕНЬ</div>
                <div className="text-3xl font-black text-[#38e1ff] mb-2">{level}</div>
                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden mt-1"
                  style={{ background: 'rgba(56,225,255,0.12)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(2, Math.min(Number(user?.points || 0) / 500 * 100, 100))}%`,
                      background: 'linear-gradient(90deg, #2ea8ff, #38e1ff)',
                      boxShadow: '0 0 8px rgba(56,225,255,0.7)',
                      minWidth: '6px',
                    }} />
                </div>
                <div className="flex justify-between text-[9px] text-[#6b7c9e] mt-1">
                  <span>{Number(user?.points || 0).toFixed(4)} pts</span>
                  <span>500 → next level</span>
                </div>
              </div>
            </div>

            {/* ID + Title */}
            <div className="mb-4">
              <div className="text-[10px] text-[#6b7c9e] mb-0.5">
                ID: {user?.telegram_id || '-----'}
              </div>
              <div className="text-[16px] font-black text-[#dbe9ff] uppercase tracking-wide">
                {radioStatus?.is_live ? 'АКТИВАЦИЯ ВРЕОСМИСЛА' : 'ОЖИДАНИЕ ПОТОКА'}
              </div>
              <div className="text-[11px] text-[#6b7c9e] mt-0.5">
                {broadcasterName}
              </div>
            </div>

            {/* Waveform */}
            <div className="glass rounded-2xl px-4 py-4 mb-4"
              style={{ border: '1px solid rgba(56,225,255,0.1)' }}>
              <div className="flex items-center justify-center gap-[4px]" style={{ height: '50px' }}>
                {waveformBars.map((h, i) => (
                  <div key={i}
                    style={{
                      width: '5px',
                      height: `${h * 1.3}px`,
                      background: 'linear-gradient(180deg, #fff 0%, #38e1ff 50%, #2ea8ff 100%)',
                      borderRadius: '3px',
                      boxShadow: '0 0 6px rgba(56,225,255,0.7)',
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
              <button onClick={() => { setShowStreamModal(false); setShowChatModal(true); }}
                className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-[58px] rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(16,28,52,0.8)', border: '1px solid rgba(56,225,255,0.15)' }}>
                  <Coffee className="w-5 h-5 text-[#6b7c9e]" strokeWidth={1.8} />
                </div>
                <span className="text-[8px] text-[#6b7c9e] uppercase tracking-wide text-center leading-tight">
                  ЧАЙ<br/>СВЕРХ<br/>МОЩНОСТЬ
                </span>
              </button>

              <button onClick={() => { setShowStreamModal(false); handleVoiceMessage(); }}
                className="flex flex-col items-center gap-2" style={{ flex: '1.4' }}>
                <div className="w-full h-[72px] rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'rgba(16,28,52,0.8)',
                    border: '1px solid rgba(56,225,255,0.2)',
                    boxShadow: '0 0 20px rgba(56,225,255,0.15)',
                  }}>
                  <svg className="w-7 h-7 text-[#38e1ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                </div>
                <span className="text-[8px] text-[#38e1ff] uppercase tracking-wide text-center leading-tight">
                  ГОЛОСОВОЕ<br/>СООБЩЕНИЕ
                </span>
              </button>

              <button onClick={() => { setShowStreamModal(false); handleSendToStudio(); }}
                className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-[58px] rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(16,28,52,0.8)', border: '1px solid rgba(56,225,255,0.15)' }}>
                  <Send className="w-5 h-5 text-[#6b7c9e]" strokeWidth={1.8} />
                </div>
                <span className="text-[8px] text-[#6b7c9e] uppercase tracking-wide text-center leading-tight">
                  ОТПРАВИТЬ
                </span>
              </button>
            </div>

            {/* СТАТИСТИКА ПОТОКА */}
            <div className="mb-3">
              <div className="text-[10px] font-bold tracking-[2px] text-[#6b7c9e] uppercase mb-3">
                СТАТИСТИКА ПОТОКА
              </div>
              <div className="grid grid-cols-3 gap-2">
                {/* Активность */}
                <div className="glass rounded-2xl p-3"
                  style={{ border: '1px solid rgba(56,225,255,0.1)' }}>
                  <div className="text-[9px] text-[#6b7c9e] uppercase tracking-wide mb-2">АКТИВНОСТЬ</div>
                  <div className="text-xl font-black text-[#38e1ff]">
                    {radioStatus?.is_live ? '78%' : '0%'}
                  </div>
                  {/* Mini chart */}
                  <div className="flex items-end gap-[2px] mt-2" style={{ height: '20px' }}>
                    {[4,6,3,8,5,10,7,12,9,14].map((h, i) => (
                      <div key={i} style={{
                        flex: 1, height: `${h}px`,
                        background: 'rgba(56,225,255,0.4)',
                        borderRadius: '1px',
                      }} />
                    ))}
                  </div>
                </div>

                {/* Энергия */}
                <div className="glass rounded-2xl p-3"
                  style={{ border: '1px solid rgba(56,225,255,0.1)' }}>
                  <div className="text-[9px] text-[#6b7c9e] uppercase tracking-wide mb-2">ЭНЕРГИЯ</div>
                  <div className="text-xl font-black text-[#38e1ff]">
                    {radioStatus?.is_live ? 'HIGH' : 'LOW'}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(56,225,255,0.1)' }}>
                    <div className="h-full rounded-full"
                      style={{
                        width: radioStatus?.is_live ? '80%' : '20%',
                        background: 'linear-gradient(90deg, #2ea8ff, #38e1ff)',
                      }} />
                  </div>
                </div>

                {/* Сообщений */}
                <div className="glass rounded-2xl p-3"
                  style={{ border: '1px solid rgba(56,225,255,0.1)' }}>
                  <div className="text-[9px] text-[#6b7c9e] uppercase tracking-wide mb-2">СООБЩЕНИЙ</div>
                  <div className="text-xl font-black text-[#38e1ff]">
                    {messages.length}
                  </div>
                  <div className="flex items-end gap-[2px] mt-2" style={{ height: '20px' }}>
                    {[3,7,5,9,6,11,8,13,10,15].map((h, i) => (
                      <div key={i} style={{
                        flex: 1, height: `${h}px`,
                        background: 'rgba(46,168,255,0.4)',
                        borderRadius: '1px',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes wave {
              0%,100% { transform: scaleY(0.4); }
              50% { transform: scaleY(1.5); }
            }
          `}</style>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: ЧАТ
      ══════════════════════════════════════════════════ */}
      {showChatModal && (
        <div
          className="fixed z-[9999] flex flex-col"
          style={{
            top: 0, left: 0, right: 0, bottom: 0,
            background: '#060a14',
            isolation: 'isolate',
          }}
        >

          {/* Header */}
          <div className="flex items-center px-4 pt-4 pb-3 border-b"
            style={{ borderColor: 'rgba(56,225,255,0.1)' }}>
            <button onClick={() => setShowChatModal(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center mr-3"
              style={{ background: 'rgba(56,225,255,0.08)' }}>
              <svg className="w-4 h-4 text-[#38e1ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <span className="text-sm font-bold text-[#6b7c9e]">ЧАЙ </span>
              <span className="text-sm font-bold text-[#38e1ff]">СВЕРХМОЩНОСТЬ</span>
            </div>
            <button onClick={() => setShowChatModal(false)}
              className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(56,225,255,0.08)' }}>
              <X className="w-4 h-4 text-[#6b7c9e]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(56,225,255,0.08)', border: '1px solid rgba(56,225,255,0.1)' }}>
                  <Coffee className="w-8 h-8 text-[#6b7c9e]" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-[#6b7c9e]">Чат пуст</p>
                <p className="text-xs text-[#6b7c9e]/60 mt-1">Начните диалог</p>
              </div>
            ) : (
              <ChatMessages messages={messages} onPlayVoice={() => {}} />
            )}
          </div>

          {/* Input */}
          <div className="px-4 pb-6 pt-3 border-t" style={{ borderColor: 'rgba(56,225,255,0.1)' }}>
            <ChatInputBar
              city={city}
              lang={lang}
              onSendText={(msg) => handleSendMessage(msg, 'chat')}
              onPointsUpdate={onPointsUpdate}
              onToast={showToast}
            />
          </div>
        </div>
      )}

      <Toast message={message} />
    </div>
  );
}

/* ── Chat input (matn + ovoz yozish + yuborish) ── */
interface ChatInputBarProps {
  city: string;
  lang: string;
  onSendText: (msg: string) => void;
  onPointsUpdate: (pts: number) => void;
  onToast: (msg: string) => void;
}

function ChatInputBar({ city: _city, lang: _lang, onSendText, onPointsUpdate, onToast }: ChatInputBarProps) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ovoz yozishni boshlash/to'xtatish
  const toggleRecording = async () => {
    if (recording && recRef.current) {
      recRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      return;
    }
    try {
      // Telegram WebApp da mikrofon ruxsati so'rash
      const tgApp = (window as any).Telegram?.WebApp;
      if (tgApp?.requestMicrophoneAccess) {
        const granted: boolean = await new Promise(resolve => {
          tgApp.requestMicrophoneAccess((ok: boolean) => resolve(ok));
        });
        if (!granted) {
          onToast('Микрофон рұқсаты берілмеді. Telegram настройкаларыдан рұқсат беріңіз.');
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 500) {
          onToast('Запись слишком короткая');
          return;
        }
        setPendingBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setRecSeconds(0);
      };
      mr.start(100);
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err: any) {
      console.error('Mic error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        onToast('Микрофон рұқсаты жоқ. Telegram → Настройки → Конфиденциальность → Микрофон');
      } else if (err?.name === 'NotFoundError') {
        onToast('Микрофон табылмады');
      } else {
        onToast('Микрофонга қол жетімді емес');
      }
    }
  };

  // Preview ni o'chirish
  const discardVoice = () => {
    setPendingBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecSeconds(0);
  };

  // Preview tinglash
  const playPreview = () => {
    if (previewUrl) new Audio(previewUrl).play().catch(() => {});
  };

  // Ovozni serverga yuborish
  const sendVoice = async () => {
    if (!pendingBlob || sendingVoice) return;
    setSendingVoice(true);
    try {
      const fd = new FormData();
      fd.append('audio_file', pendingBlob, 'voice.webm');
      const resp = await fetch('/chat/voice', {
        method: 'POST',
        headers: { ...authHeaders() },
        body: fd,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 402) onToast('Недостаточно поинтов');
        else onToast('Ошибка отправки голосового');
        console.error('Voice send error:', err);
      } else {
        const data = await resp.json();
        const pts = data?.detail?.points;
        if (pts !== undefined) onPointsUpdate(Number(pts));
        onToast('Голосовое отправлено ✅');
        discardVoice();
      }
    } catch (e) {
      onToast('Ошибка отправки');
      console.error(e);
    } finally {
      setSendingVoice(false);
    }
  };

  // Matn yuborish
  const sendText = async () => {
    if (!val.trim() || busy) return;
    setBusy(true);
    try { onSendText(val.trim()); setVal(''); }
    finally { setBusy(false); }
  };

  const fmtSec = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-2">

      {/* Ovoz preview (yozilgandan keyin) */}
      {pendingBlob && previewUrl && (
        <div
          className="rounded-2xl px-3 py-2.5 flex items-center gap-3"
          style={{ background: 'rgba(16,28,52,0.9)', border: '1px solid rgba(56,225,255,0.2)' }}
        >
          {/* Tinglash */}
          <button
            onClick={playPreview}
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center active:scale-90"
            style={{ background: 'linear-gradient(135deg,#1a6aff,#38e1ff)' }}
          >
            <svg width="11" height="13" fill="white" viewBox="0 0 11 13" style={{ marginLeft: 2 }}>
              <path d="M0 0 L11 6.5 L0 13 Z"/>
            </svg>
          </button>

          {/* Waveform ko'rinish */}
          <div className="flex-1 flex items-center gap-[2px]" style={{ height: '20px' }}>
            {[3,5,8,6,10,7,12,9,14,11,12,8,10,6,7,4,5].map((h, i) => (
              <div key={i} style={{
                flex: 1, height: `${h}px`,
                background: 'rgba(56,225,255,0.5)',
                borderRadius: '2px',
              }} />
            ))}
          </div>

          <span className="text-[10px] text-[#6b7c9e] shrink-0">готово</span>

          {/* Yuborish */}
          <button
            onClick={sendVoice}
            disabled={sendingVoice}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-50 active:scale-95 transition-all shrink-0"
            style={{ background: 'linear-gradient(135deg,#2ea8ff,#38e1ff)', color: '#02101f' }}
          >
            {sendingVoice ? '...' : 'Отправить'}
          </button>

          {/* O'chirish */}
          <button
            onClick={discardVoice}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 active:scale-90"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <X className="w-3.5 h-3.5 text-[#ef4444]" />
          </button>
        </div>
      )}

      {/* Matn input + yuborish */}
      <div className="flex gap-2">
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendText())}
          placeholder="Введите сообщение..."
          disabled={busy}
          className="flex-1 px-4 py-3 rounded-2xl text-sm text-[#dbe9ff] placeholder:text-[#4a5a7a] outline-none disabled:opacity-50"
          style={{ background: 'rgba(14,24,44,0.9)', border: '1px solid rgba(56,225,255,0.12)' }}
        />
        <button
          onClick={sendText}
          disabled={!val.trim() || busy}
          className="w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
          style={{
            background: val.trim() ? 'linear-gradient(135deg,#2ea8ff,#38e1ff)' : 'rgba(14,24,44,0.9)',
            border: '1px solid rgba(56,225,255,0.15)',
          }}
        >
          {busy
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send className="w-4 h-4" style={{ color: val.trim() ? '#060a14' : '#4a5a7a' }} strokeWidth={2} />
          }
        </button>
      </div>

      {/* Mic tugmasi — har doim ko'rinadi */}
      <button
        onClick={toggleRecording}
        className="w-full rounded-2xl py-3 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        style={{
          background: recording ? 'rgba(239,68,68,0.1)' : 'rgba(14,24,44,0.7)',
          border: recording ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(56,225,255,0.12)',
          boxShadow: recording ? '0 0 16px rgba(239,68,68,0.2)' : 'none',
        }}
      >
        <svg width="16" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"
          strokeWidth={1.8} style={{ color: recording ? '#ef4444' : '#38e1ff' }}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
        </svg>

        {recording ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-[2px]">
              {[5,8,6,10,7].map((h, i) => (
                <div key={i} style={{
                  width: '3px', height: `${h}px`,
                  background: '#ef4444', borderRadius: '2px',
                  animation: `recWave ${0.5 + i * 0.1}s ease-in-out ${i * 0.1}s infinite`,
                }} />
              ))}
            </div>
            <span className="text-sm font-bold text-[#ef4444] tabular-nums">{fmtSec(recSeconds)}</span>
            <span className="text-[11px] text-[#ef4444]/70">Нажмите чтобы остановить</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-[#38e1ff]">Голосовое сообщение</span>
        )}
      </button>

      <style>{`
        @keyframes recWave {
          0%,100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.6); }
        }
      `}</style>
    </div>
  );
}
