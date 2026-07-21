import { useState, useRef } from 'react';
import { Check, CheckCheck, Clock, Play, Pause, AlertTriangle, Music2, Download, Paperclip } from 'lucide-react';
import { API_URL } from '../../lib/config';
import { useTranslation } from '../../hooks/useTranslation';
import type { ChatMessage, User } from '../../types';

interface ChatMessageProps {
  message: ChatMessage;
  currentUser: User | null;
}

export function ChatMessage({ message, currentUser }: ChatMessageProps) {
  const { t } = useTranslation('radio');
  const isAI = message.kind === 'ai' || message.username?.includes('ИИ');
  const isMine = currentUser && message.username === (currentUser.username || currentUser.full_name || `id${currentUser.telegram_id}`);

  const time = new Date(message.created_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let messageClass = 'flex text-sm leading-relaxed';
  if (isAI) messageClass += ' justify-center';
  else if (isMine) messageClass += ' justify-end';
  else messageClass += ' justify-start';

  let bubbleClass = 'max-w-[80%] px-3 py-2 rounded-2xl';
  if (isAI) {
    bubbleClass += ' bg-[rgba(167,139,250,0.1)] border border-dashed border-[var(--ai)] text-center max-w-[92%]';
  } else if (isMine) {
    bubbleClass += ' bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-[#1B1204] rounded-br-sm';
  } else {
    bubbleClass += ' bg-[rgba(251,146,60,0.12)] border border-[var(--glass-border)] rounded-bl-sm';
  }

  const renderContent = () => {
    if (message.voice_url) {
      return <VoicePlayer url={message.voice_url} duration={message.duration_sec ?? null} voiceLabel={t('voice_label')} />;
    }
    if (message.file_url) {
      return <FileAttachment url={message.file_url} name={message.file_name || 'файл'} isMine={!!isMine} />;
    }
    return <div className="break-words">{message.message}</div>;
  };

  return (
    <div className={messageClass}>
      <div className={bubbleClass}>
        {!isMine && !isAI && (
          <div className="text-[11px] font-bold text-[var(--accent-light)] mb-0.5">
            {message.username || t('guest')}
          </div>
        )}
        {renderContent()}
        <div className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${isMine ? 'text-[rgba(15,15,35,0.65)]' : 'text-[var(--muted)]'}`}>
          {time}
          {isMine && message.status && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}

// Telegram uslubidagi galochkalar — faqat shu sessiyada yuborilgan xabarlar
// uchun (status maydoni bo'lgan xabarlarda). "Delivered" WS orqali xabar
// serverdan qaytib kelganini bildiradi (haqiqiy "o'qildi" holati emas —
// guruh chatida bittalab o'qilganlikni kuzatish yo'q).
function StatusTicks({ status }: { status: 'sending' | 'sent' | 'delivered' }) {
  if (status === 'sending') return <Clock className="w-3 h-3 shrink-0" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 shrink-0" />;
  return <Check className="w-3.5 h-3.5 shrink-0" />;
}

function VoicePlayer({ url, duration, voiceLabel }: { url: string; duration: number | null; voiceLabel: string }) {
  // blob: — hali serverga yuklanmagan, optimistik ko'rsatilayotgan ovoz
  // (mahalliy URL, o'zgartirmasdan ishlatiladi).
  const fullUrl = url.startsWith('http') || url.startsWith('blob:') ? url : `${API_URL}${url}`;
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = () => {
    if (!audioRef.current) {
      const audio = new Audio(fullUrl);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setFailed(true);
        setPlaying(false);
      };
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play()
        .then(() => setPlaying(true))
        .catch(() => setFailed(true));
    }
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[130px]">
      <button
        onClick={handlePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          failed ? 'bg-[var(--danger)] text-white' : 'bg-[rgba(15,15,35,0.3)]'
        }`}
      >
        {failed ? <AlertTriangle className="w-3.5 h-3.5" /> : playing ? <Pause className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />}
      </button>
      <span className="text-xs opacity-85 flex items-center gap-1">
        <Music2 className="w-3 h-3" /> {duration ? `${duration}ʺ` : voiceLabel}
      </span>
      {failed && (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-white">
          <Download className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

function FileAttachment({ url, name, isMine }: { url: string; name: string; isMine: boolean }) {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  const fileName = name.replace(/^📎\s*/, '');

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 min-w-[120px] no-underline"
    >
      <div className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 ${
        isMine ? 'bg-[rgba(15,15,35,0.25)]' : 'bg-[var(--accent)] text-[#1B1204]'
      }`}>
        <Paperclip className="w-3.5 h-3.5" />
      </div>
      <span className="text-[13px] underline break-all">{fileName}</span>
    </a>
  );
}
