import { useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { RoomsButton } from './RoomsScreen';
import type { ChatMessage as ChatMessageType, User } from '../../types';

interface ChatProps {
  messages: ChatMessageType[];
  currentUser: User | null;
  onSendMessage: (message: string, destination: 'chat' | 'studio') => void;
  onSendVoice: (blob: Blob) => void;
  onToast: (message: string) => void;
  city: string;
  // Berilsa — sarlavha yonida chiqish tugmasi ko'rsatiladi (asosiy "Живой
  // чат" ekranida BottomNav o'rniga shu orqali oldingi ekranga qaytiladi).
  onExit?: () => void;
  isLive?: boolean;
}

export function Chat({
  messages,
  currentUser,
  onSendMessage,
  onSendVoice,
  onToast,
  city,
  onExit,
  isLive,
}: ChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-[var(--bg)] p-3 flex flex-col flex-1 min-h-0">
      {/* Sarlavhasiz, chegarasiz — Efir'dagi "ЧАЙ СВЕРХМОЩНОСТЬ" bilan bir
          xil toza ko'rinish uchun. Faqat funksional tugmalar (chiqish,
          guruhlar) qoladi, matn/border yo'q. Yuqoridan qo'shimcha bo'sh joy
          (safe-area + o'zi) — Telegram'ning o'z "⋮ ⌄ ✕" native paneli aynan
          shu burchakda bo'lgani uchun, tugmalar shu bilan to'qnashmasin. */}
      <div
        className="flex items-center justify-between mb-2"
        style={{ paddingTop: 'calc(76px + env(safe-area-inset-top))' }}
      >
        {onExit ? (
          <button
            onClick={onExit}
            aria-label="Выйти из чата"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(148,163,184,0.1)' }}
          >
            <svg className="w-4 h-4 text-[var(--text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : <span />}
        <RoomsButton user={currentUser} isLive={isLive} />
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-[60px] scroll-smooth"
           style={{ WebkitOverflowScrolling: 'touch' }}>
        {messages.map((msg) => (
          <ChatMessageComponent
            key={msg.id}
            message={msg}
            currentUser={currentUser}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSendMessage={onSendMessage}
        onSendVoice={onSendVoice}
        onToast={onToast}
        city={city}
        micDisabled={isLive}
      />
    </div>
  );
}
