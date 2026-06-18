import { useRef, useEffect, useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { API_URL } from '../../lib/config';
import type { ChatMessage } from '../../types';

interface ChatMessagesProps {
  messages: ChatMessage[];
  onPlayVoice?: (url: string) => void;
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-3xl mb-3 opacity-20">🎤</div>
        <p className="text-xs text-[#6b7c9e]">Чат пока пуст</p>
        <p className="text-[10px] text-[#6b7c9e]/50 mt-1">Начните общение!</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-2 py-1"
      style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {messages.map((msg, idx) => {
        const isAI = msg.username?.includes('ИИ') || msg.username?.includes('AI');
        const isStudio = msg.message_type === 'studio' || msg.message_type === 'studio_voice';

        return (
          <div
            key={idx}
            className="flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl"
            style={{
              background: isAI
                ? 'rgba(124,92,255,0.1)'
                : 'rgba(14,24,44,0.85)',
              border: `1px solid ${isAI ? 'rgba(124,92,255,0.2)' : isStudio ? 'rgba(245,158,11,0.2)' : 'rgba(56,225,255,0.08)'}`,
            }}
          >
            {/* Имя + время */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{
                color: isAI ? '#a78bfa' : isStudio ? '#f59e0b' : '#38e1ff'
              }}>
                {isStudio && <span className="mr-1 opacity-60 text-[9px]">[СТУДИЯ]</span>}
                {msg.username || 'Гость'}
              </span>
              <span className="text-[9px] text-[#4a5a7a]">{formatTime(msg.created_at)}</span>
            </div>

            {/* Контент */}
            {msg.voice_url ? (
              <VoiceMiniPlayer url={msg.voice_url} duration={msg.duration_sec} />
            ) : msg.file_url ? (
              <FileCard url={msg.file_url} name={msg.file_name || 'Файл'} />
            ) : (
              <p className="text-[13px] text-[#c8d8f0] leading-relaxed break-words">
                {msg.message}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Голосовой мини-плеер ─────────────────────────────────────────
   Telegram uslubida: play tugma + progress + waveform + vaqt
   React state bilan boshqariladi (DOM manipulation yo'q)
──────────────────────────────────────────────────────────────────── */
function VoiceMiniPlayer({ url, duration }: { url: string | null; duration?: number | null }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);        // 0..100
  const [currentTime, setCurrentTime] = useState(0);  // sekund
  const [totalDuration, setTotalDuration] = useState(duration ?? 0);
  const [error, setError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const fullUrl = url
    ? (url.startsWith('http') ? url : `${API_URL}${url}`)
    : '';

  // Audio elementini bir marta yaratish
  const getAudio = useCallback(() => {
    if (!audioRef.current && fullUrl) {
      const a = new Audio(fullUrl);
      a.preload = 'metadata';

      a.addEventListener('loadedmetadata', () => {
        if (a.duration && isFinite(a.duration)) {
          setTotalDuration(a.duration);
        }
      });
      a.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        cancelAnimationFrame(rafRef.current);
      });
      a.addEventListener('error', () => {
        setError(true);
        setIsPlaying(false);
      });
      audioRef.current = a;
    }
    return audioRef.current;
  }, [fullUrl]);

  // Progress animatsiyasi
  const startRaf = useCallback(() => {
    const tick = () => {
      const a = audioRef.current;
      if (a && !a.paused && a.duration) {
        const p = (a.currentTime / a.duration) * 100;
        setProgress(p);
        setCurrentTime(a.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const togglePlay = useCallback(() => {
    if (!fullUrl || error) return;
    const audio = getAudio();
    if (!audio) return;

    if (audio.paused) {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          startRaf();
        })
        .catch((e) => {
          console.error('Audio play error:', e);
          setError(true);
        });
    } else {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
    }
  }, [fullUrl, error, getAudio, startRaf]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const fmtSec = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Waveform balandliklari (Telegram uslubi — o'rtada baland)
  const bars = [2, 3, 5, 7, 10, 8, 12, 9, 14, 11, 16, 13, 18, 14, 16, 13, 18, 15, 12, 10, 8, 6, 4, 3, 2];
  const filledCount = Math.round((progress / 100) * bars.length);

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{
        background: 'rgba(10,20,40,0.6)',
        border: '1px solid rgba(56,225,255,0.12)',
      }}
    >
      {/* Play / Pause tugma */}
      <button
        onClick={togglePlay}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{
          background: error
            ? 'rgba(239,68,68,0.2)'
            : 'linear-gradient(135deg, #1a6aff 0%, #38e1ff 100%)',
          boxShadow: isPlaying ? '0 0 12px rgba(56,225,255,0.5)' : 'none',
        }}
        title={error ? 'Ошибка загрузки' : isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        {error ? (
          <span className="text-[#ef4444] text-xs">!</span>
        ) : isPlaying ? (
          /* Pause icon */
          <svg width="12" height="14" viewBox="0 0 12 14" fill="white">
            <rect x="0" y="0" width="4" height="14" rx="1.5"/>
            <rect x="8" y="0" width="4" height="14" rx="1.5"/>
          </svg>
        ) : (
          /* Play icon */
          <svg width="12" height="14" viewBox="0 0 12 14" fill="white" style={{ marginLeft: 2 }}>
            <path d="M0 0 L12 7 L0 14 Z"/>
          </svg>
        )}
      </button>

      {/* Waveform + progress */}
      <div className="flex-1 flex flex-col gap-1.5">
        {/* Waveform bars */}
        <div className="flex items-center gap-[2.5px]" style={{ height: '20px' }}>
          {bars.map((h, i) => {
            const filled = i < filledCount;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}px`,
                  borderRadius: '2px',
                  background: filled
                    ? 'linear-gradient(180deg, #38e1ff 0%, #2ea8ff 100%)'
                    : 'rgba(56,225,255,0.25)',
                  transition: 'background 0.1s',
                }}
              />
            );
          })}
        </div>

        {/* Progress bar ingichka */}
        <div
          className="h-[2px] rounded-full overflow-hidden"
          style={{ background: 'rgba(56,225,255,0.12)' }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #2ea8ff, #38e1ff)',
              borderRadius: '2px',
              transition: 'width 0.05s linear',
            }}
          />
        </div>
      </div>

      {/* Вaqt */}
      <span
        className="shrink-0 tabular-nums text-[10px]"
        style={{ color: '#4a5a7a', minWidth: '28px', textAlign: 'right' }}
      >
        {isPlaying ? fmtSec(currentTime) : fmtSec(totalDuration)}
      </span>
    </div>
  );
}

/* ─── Fayl ──────────────────────────────────────────────── */
function FileCard({ url, name }: { url: string; name: string }) {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  const clean = name.replace(/^📎\s*/, '');

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 no-underline active:scale-[0.98] transition-transform"
      style={{
        background: 'rgba(56,225,255,0.05)',
        border: '1px solid rgba(56,225,255,0.1)',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(56,225,255,0.1)' }}
      >
        <FileText className="w-4 h-4 text-[#38e1ff]" />
      </div>
      <span className="text-[12px] text-[#8baad0] truncate">{clean}</span>
    </a>
  );
}
