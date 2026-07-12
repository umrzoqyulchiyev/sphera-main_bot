import { useState, useRef } from 'react';
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
    bubbleClass += ' bg-[rgba(94,106,210,0.1)] border border-dashed border-[#5e6ad2] text-center max-w-[92%]';
  } else if (isMine) {
    bubbleClass += ' bg-gradient-to-br from-[#7b85e8] to-[#5e6ad2] text-[#020203] rounded-br-sm';
  } else {
    bubbleClass += ' bg-[rgba(123,133,232,0.12)] border border-[var(--glass-border)] rounded-bl-sm';
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
          <div className="text-[11px] font-bold text-[#5e6ad2] mb-0.5">
            {message.username || t('guest')}
          </div>
        )}
        {renderContent()}
        <div className={`text-[10px] text-right mt-0.5 ${isMine ? 'text-[rgba(2,2,3,0.6)]' : 'text-[#8a8f98]'}`}>
          {time}
        </div>
      </div>
    </div>
  );
}

function VoicePlayer({ url, duration, voiceLabel }: { url: string; duration: number | null; voiceLabel: string }) {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
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
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] ${
          failed ? 'bg-[#ff4d6d] text-white' : 'bg-[rgba(2,2,3,0.25)]'
        }`}
      >
        {failed ? '!' : playing ? '❚❚' : '▶'}
      </button>
      <span className="text-xs opacity-85">
        🎵 {duration ? `${duration}ʺ` : voiceLabel}
      </span>
      {failed && (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] underline text-white">
          ⬇
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
      <div className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[15px] flex-shrink-0 ${
        isMine ? 'bg-[rgba(2,2,3,0.2)]' : 'bg-[var(--accent)] text-[#020203]'
      }`}>
        📎
      </div>
      <span className="text-[13px] underline break-all">{fileName}</span>
    </a>
  );
}
